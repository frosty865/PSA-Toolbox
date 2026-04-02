#!/usr/bin/env python3
"""
Backfill module_sources.publisher from PDF metadata (scrape_source_metadata_from_content).

Database: RUNTIME only (module_sources). Corpus source_registry lives in CORPUS;
to backfill those, run: npx tsx scripts/backfill_source_registry_publisher.ts [--dry-run]
(uses CORPUS_DATABASE_URL).

Only updates rows where publisher IS NULL or '' and a file can be resolved
(storage_relpath or document_blobs.storage_relpath under MODULE_SOURCES_ROOT).

Usage:
    python tools/corpus/backfill_module_source_publishers.py [--limit N] [--dry-run] [--verbose]

The API POST /api/admin/module-sources/backfill-publishers invokes this script
with --limit set to the number of candidates; script queries DB and updates in place.
Prints "Updated: N" on stdout for the API to parse.
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path

# Project root (psa_rebuild)
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))


def _load_env():
    for p in (project_root / ".env.local", project_root / ".local.env", project_root / ".env"):
        if p.exists():
            with open(p, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
            return


_load_env()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

try:
    from model.ingest.pdf_citation_extractor import scrape_source_metadata_from_content
except ImportError:
    scrape_source_metadata_from_content = None


def get_runtime_conn():
    """RUNTIME DB connection."""
    dsn = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        try:
            from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
            dsn = sanitize_psycopg2_dsn(dsn)
        except ImportError:
            pass
        return psycopg2.connect(dsn)

    from urllib.parse import urlparse
    url = os.environ.get("SUPABASE_RUNTIME_URL")
    pw = os.environ.get("SUPABASE_RUNTIME_DB_PASSWORD")
    if not url or not pw:
        raise RuntimeError(
            "Set RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD)"
        )
    clean = pw.strip().strip('"').strip("'").replace("\\", "")
    u = urlparse(url.strip().strip('"').replace("\\", ""))
    ref = u.hostname.split(".")[0] if u.hostname else None
    if not ref:
        raise ValueError("Could not parse project_ref from SUPABASE_RUNTIME_URL")
    for port in (6543, 5432):
        try:
            return psycopg2.connect(
                f"postgresql://postgres:{clean}@db.{ref}.supabase.co:{port}/postgres?sslmode=require"
            )
        except psycopg2.OperationalError:
            continue
    raise RuntimeError("Could not connect to RUNTIME DB")


def get_module_sources_root() -> Path:
    root = os.environ.get("MODULE_SOURCES_ROOT")
    if root:
        return Path(root)
    return project_root / "storage" / "module_sources"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def build_raw_sha256_index(root: Path, verbose: bool) -> dict:
    """Index SHA256 -> path for all PDFs under root/raw/ (including subfolders like raw/MODULE_AS_EAP/)."""
    index = {}
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return index
    for pdf in raw_dir.rglob("*.pdf"):
        if not pdf.is_file():
            continue
        try:
            sha = sha256_file(pdf)
            index[sha] = pdf
        except Exception:
            continue
    if verbose and index:
        print(f"  Indexed {len(index)} PDFs under raw/ subfolders", file=sys.stderr)
    return index


def resolve_path(root: Path, r: dict, raw_sha256_index: dict) -> Path | None:
    """Resolve to an existing file: try DB paths first, then raw/ subfolder index by sha256."""
    local_path = (r.get("module_document_local_path") or "").strip()
    if local_path:
        p = Path(local_path)
        if p.is_file():
            return p
    for key in ("document_blob_relpath", "md_blob_relpath", "storage_relpath"):
        rel = (r.get(key) or "").strip().replace("\\", "/").lstrip("/")
        if rel:
            p = root / rel
            if p.is_file():
                return p
    sha = (r.get("sha256") or "").strip()
    if sha and sha in raw_sha256_index:
        return raw_sha256_index[sha]
    return None


def main():
    parser = argparse.ArgumentParser(description="Backfill module_sources.publisher from PDF metadata")
    parser.add_argument("--limit", type=int, default=1000, help="Max rows to process")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print counts: candidates, resolvable path, file exists, publisher found, updated")
    args = parser.parse_args()

    if not scrape_source_metadata_from_content:
        print("ERROR: scrape_source_metadata_from_content not available (model.ingest.pdf_citation_extractor)", file=sys.stderr)
        sys.exit(1)

    root = get_module_sources_root()
    if not root.exists():
        print("ERROR: MODULE_SOURCES_ROOT does not exist:", root, file=sys.stderr)
        sys.exit(1)

    conn = get_runtime_conn()
    updated = 0
    n_candidates = 0
    n_with_relpath = 0
    n_file_exists = 0
    n_publisher_found = 0
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Include path from document_blobs (via ms.sha256) or module_documents (local_path / blob)
            cur.execute(
                """
                SELECT DISTINCT ON (ms.id)
                  ms.id, ms.module_code, ms.storage_relpath, ms.sha256,
                  db.storage_relpath AS document_blob_relpath,
                  md.local_path AS module_document_local_path,
                  db_md.storage_relpath AS md_blob_relpath
                FROM public.module_sources ms
                LEFT JOIN public.document_blobs db ON db.sha256 = ms.sha256
                LEFT JOIN public.module_documents md ON md.module_code = ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
                LEFT JOIN public.document_blobs db_md ON db_md.id = md.document_blob_id
                WHERE ms.source_type = 'MODULE_UPLOAD'
                  AND (ms.publisher IS NULL OR ms.publisher = '')
                  AND (
                    ms.storage_relpath IS NOT NULL OR ms.sha256 IS NOT NULL
                    OR (md.id IS NOT NULL AND (md.local_path IS NOT NULL AND md.local_path <> '' OR md.document_blob_id IS NOT NULL))
                  )
                ORDER BY ms.id, (CASE WHEN md.local_path IS NOT NULL AND md.local_path <> '' THEN 0 ELSE 1 END), ms.created_at
                LIMIT %s
                """,
                (args.limit,),
            )
            rows = cur.fetchall()

        raw_sha256_index = build_raw_sha256_index(root, args.verbose)
        if len(rows) == 0 and raw_sha256_index:
            with conn.cursor(cursor_factory=RealDictCursor) as cur2:
                cur2.execute(
                    """
                    SELECT ms.id, ms.module_code, ms.storage_relpath, ms.sha256,
                           db.storage_relpath AS document_blob_relpath,
                           md.local_path AS module_document_local_path,
                           db_md.storage_relpath AS md_blob_relpath
                    FROM public.module_sources ms
                    LEFT JOIN public.document_blobs db ON db.sha256 = ms.sha256
                    LEFT JOIN public.module_documents md ON md.module_code = ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
                    LEFT JOIN public.document_blobs db_md ON db_md.id = md.document_blob_id
                    WHERE ms.source_type = 'MODULE_UPLOAD'
                      AND (ms.publisher IS NULL OR ms.publisher = '')
                      AND ms.sha256 = ANY(%s)
                    ORDER BY ms.created_at
                    LIMIT %s
                    """,
                    (list(raw_sha256_index.keys()), args.limit),
                )
                rows = cur2.fetchall()

        n_candidates = len(rows)
        for r in rows:
            abs_path = resolve_path(root, r, raw_sha256_index)
            if abs_path is None:
                continue
            n_with_relpath += 1
            n_file_exists += 1
            try:
                meta = scrape_source_metadata_from_content(str(abs_path))
            except Exception as e:
                print(f"WARN skip {r.get('id')}: {e}", file=sys.stderr)
                continue
            publisher = (meta.get("publisher") or "").strip() or None
            if not publisher:
                continue
            n_publisher_found += 1
            publisher = publisher[:200]
            if args.dry_run:
                updated += 1
                continue
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE public.module_sources SET publisher = %s WHERE id = %s",
                    (publisher, r["id"]),
                )
            conn.commit()
            updated += 1
    finally:
        conn.close()

    if args.verbose:
        # Diagnose why candidates might be 0
        n_upload = n_empty_pub = n_with_path = 0
        n_blobs = "?"
        conn2 = get_runtime_conn()
        try:
            with conn2.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD'"
                )
                n_upload = (cur.fetchone() or {}).get("n", 0)
                cur.execute(
                    "SELECT COUNT(*) AS n FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD' AND (publisher IS NULL OR publisher = '')"
                )
                n_empty_pub = (cur.fetchone() or {}).get("n", 0)
                cur.execute(
                    """
                    SELECT COUNT(*) AS n FROM public.module_sources ms
                    LEFT JOIN public.document_blobs db ON db.sha256 = ms.sha256
                    LEFT JOIN public.module_documents md ON md.module_code = ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
                    WHERE ms.source_type = 'MODULE_UPLOAD'
                      AND (ms.publisher IS NULL OR ms.publisher = '')
                      AND (
                        ms.storage_relpath IS NOT NULL OR ms.sha256 IS NOT NULL
                        OR (md.id IS NOT NULL AND (md.local_path IS NOT NULL AND md.local_path <> '' OR md.document_blob_id IS NOT NULL))
                      )
                    """
                )
                n_with_path = (cur.fetchone() or {}).get("n", 0)
                try:
                    cur.execute("SELECT COUNT(*) AS n FROM public.document_blobs")
                    n_blobs = (cur.fetchone() or {}).get("n", 0)
                except Exception:
                    n_blobs = "N/A (table missing?)"
        finally:
            conn2.close()
        print(
            f"MODULE_UPLOAD sources: {n_upload}; empty publisher: {n_empty_pub}; empty publisher + path/sha256: {n_with_path}; document_blobs rows: {n_blobs}",
            file=sys.stderr,
        )
        print(
            f"Candidates: {n_candidates}; with relpath: {n_with_relpath}; file exists: {n_file_exists}; publisher from PDF: {n_publisher_found}; updated: {updated}",
            file=sys.stderr,
        )
    print("Updated:", updated)


if __name__ == "__main__":
    main()
