#!/usr/bin/env python3
"""
Bulk run citation extractor on module sources, deduplicated by SHA256.

Each unique document (by sha256) is processed once; then all module_sources rows
with that sha256 are updated (publisher, and source_label when empty).

Usage:
    python tools/corpus/bulk_citation_module_sources.py [--limit N] [--dry-run] [--verbose]
"""

import argparse
import hashlib
import os
import sys
from pathlib import Path

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
        raise RuntimeError("Set RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD")
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


def resolve_path(
    root: Path,
    r: dict,
    raw_sha256_index: dict,
) -> Path | None:
    """Resolve to an existing file: try DB paths first, then raw/ subfolder index by sha256."""
    # 1) Absolute local_path from module_documents
    local_path = (r.get("module_document_local_path") or "").strip()
    if local_path:
        p = Path(local_path)
        if p.is_file():
            return p
    # 2) Relative paths under root
    for key in ("document_blob_relpath", "md_blob_relpath", "storage_relpath"):
        rel = (r.get(key) or "").strip().replace("\\", "/").lstrip("/")
        if rel:
            p = root / rel
            if p.is_file():
                return p
    # 3) Fallback: PDFs still in raw subfolders (e.g. raw/MODULE_AS_EAP/) — look up by sha256
    sha = (r.get("sha256") or "").strip()
    if sha and sha in raw_sha256_index:
        return raw_sha256_index[sha]
    return None


def main():
    parser = argparse.ArgumentParser(description="Bulk citation extract on module sources (dedupe by SHA256)")
    parser.add_argument("--limit", type=int, default=5000, help="Max unique documents (by sha256) to process")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print per-file progress")
    args = parser.parse_args()

    if not scrape_source_metadata_from_content:
        print("ERROR: scrape_source_metadata_from_content not available", file=sys.stderr)
        sys.exit(1)

    root = get_module_sources_root()
    if not root.exists():
        print("ERROR: MODULE_SOURCES_ROOT does not exist:", root, file=sys.stderr)
        sys.exit(1)

    conn = get_runtime_conn()
    # Collect all module_sources with resolvable path; then dedupe by sha256
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (ms.id)
                  ms.id, ms.module_code, ms.sha256, ms.storage_relpath, ms.source_label,
                  db.storage_relpath AS document_blob_relpath,
                  md.local_path AS module_document_local_path,
                  db_md.storage_relpath AS md_blob_relpath
                FROM public.module_sources ms
                LEFT JOIN public.document_blobs db ON db.sha256 = ms.sha256
                LEFT JOIN public.module_documents md ON md.module_code = ms.module_code AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
                LEFT JOIN public.document_blobs db_md ON db_md.id = md.document_blob_id
                WHERE ms.source_type = 'MODULE_UPLOAD'
                  AND (
                    ms.storage_relpath IS NOT NULL OR ms.sha256 IS NOT NULL
                    OR (md.id IS NOT NULL AND (md.local_path IS NOT NULL AND md.local_path <> '' OR md.document_blob_id IS NOT NULL))
                  )
                ORDER BY ms.id, (CASE WHEN md.local_path IS NOT NULL AND md.local_path <> '' THEN 0 ELSE 1 END), ms.created_at
                """
            )
            rows = cur.fetchall()

        # If no rows, run diagnostics so user can see why
        if len(rows) == 0 and args.verbose:
            with conn.cursor(cursor_factory=RealDictCursor) as dcur:
                dcur.execute("SELECT COUNT(*) AS n FROM public.module_sources")
                n_ms = (dcur.fetchone() or {}).get("n", 0)
                dcur.execute("SELECT COUNT(*) AS n FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD'")
                n_upload = (dcur.fetchone() or {}).get("n", 0)
                dcur.execute(
                    "SELECT COUNT(*) AS n FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD' AND (storage_relpath IS NOT NULL OR sha256 IS NOT NULL)"
                )
                n_with_path = (dcur.fetchone() or {}).get("n", 0)
                try:
                    dcur.execute("SELECT COUNT(*) AS n FROM public.document_blobs")
                    n_blobs = (dcur.fetchone() or {}).get("n", 0)
                except Exception:
                    n_blobs = "N/A (table missing?)"
                try:
                    dcur.execute("SELECT COUNT(*) AS n FROM public.module_documents WHERE status = 'INGESTED'")
                    n_md = (dcur.fetchone() or {}).get("n", 0)
                except Exception:
                    n_md = "N/A"
                print(
                    f"Diagnostics: module_sources total={n_ms}, MODULE_UPLOAD={n_upload}, "
                    f"with path/sha256={n_with_path}, document_blobs={n_blobs}, module_documents INGESTED={n_md}",
                    file=sys.stderr,
                )
                if n_upload > 0:
                    dcur.execute(
                        "SELECT id, module_code, sha256, storage_relpath FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD' LIMIT 3"
                    )
                    for r in dcur.fetchall() or []:
                        print(f"  Sample: id={r.get('id')} sha256={r.get('sha256')!r} storage_relpath={r.get('storage_relpath')!r}", file=sys.stderr)
                print(f"  MODULE_SOURCES_ROOT={root} exists={root.exists()}", file=sys.stderr)

        # Index PDFs under raw/ subfolders (e.g. raw/MODULE_AS_EAP/) so we can resolve when DB path is missing
        raw_sha256_index = build_raw_sha256_index(root, args.verbose)

        # If main query returned 0 rows but we have PDFs in raw/ subfolders, try to match by sha256
        if len(rows) == 0 and raw_sha256_index and args.verbose:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT ms.id, ms.module_code, ms.sha256, ms.storage_relpath, ms.source_label,
                           NULL AS document_blob_relpath, NULL AS module_document_local_path, NULL AS md_blob_relpath
                    FROM public.module_sources ms
                    WHERE ms.source_type = 'MODULE_UPLOAD' AND ms.sha256 IS NOT NULL AND ms.sha256 = ANY(%s)
                    """,
                    (list(raw_sha256_index.keys()),),
                )
                rows = cur.fetchall()
            if rows and args.verbose:
                print(f"  Found {len(rows)} module_sources rows matching {len(raw_sha256_index)} PDFs in raw/", file=sys.stderr)

        # Dedupe by sha256: one (abs_path, ids) per sha256
        by_sha256 = {}
        for r in rows:
            sha = (r.get("sha256") or "").strip()
            if not sha:
                continue
            abs_path = resolve_path(root, r, raw_sha256_index)
            if abs_path is None:
                continue
            if sha not in by_sha256:
                by_sha256[sha] = {"path": abs_path, "ids": []}
            by_sha256[sha]["ids"].append(r["id"])

        unique = list(by_sha256.items())[: args.limit]
        if args.verbose:
            print(f"Module source rows: {len(rows)}; unique documents (sha256): {len(by_sha256)}; processing: {len(unique)}", file=sys.stderr)

        files_processed = 0
        rows_updated = 0
        for sha256, info in unique:
            abs_path = info["path"]
            ids = info["ids"]
            try:
                meta = scrape_source_metadata_from_content(str(abs_path))
            except Exception as e:
                if args.verbose:
                    print(f"  skip {sha256[:12]}...: {e}", file=sys.stderr)
                continue
            publisher = (meta.get("publisher") or "").strip() or None
            title = (meta.get("title") or "").strip() or None
            if publisher:
                publisher = publisher[:200]
            if title:
                title = title[:500]
            files_processed += 1
            if args.dry_run:
                rows_updated += len(ids)
                if args.verbose:
                    print(f"  [dry-run] {sha256[:12]}... -> publisher={publisher!r} title={title!r} -> {len(ids)} rows", file=sys.stderr)
                continue
            n_updated = 0
            with conn.cursor() as cur:
                if publisher and title:
                    cur.execute(
                        """UPDATE public.module_sources
                           SET publisher = %s, source_label = COALESCE(NULLIF(trim(source_label), ''), %s)
                           WHERE sha256 = %s""",
                        (publisher, title, sha256),
                    )
                elif publisher:
                    cur.execute(
                        "UPDATE public.module_sources SET publisher = %s WHERE sha256 = %s",
                        (publisher, sha256),
                    )
                elif title:
                    cur.execute(
                        "UPDATE public.module_sources SET source_label = COALESCE(NULLIF(trim(source_label), ''), %s) WHERE sha256 = %s",
                        (title, sha256),
                    )
                else:
                    continue
                n_updated = cur.rowcount or 0
            conn.commit()
            rows_updated += n_updated
            if args.verbose:
                print(f"  {sha256[:12]}... -> {n_updated} rows (publisher={publisher!r})", file=sys.stderr)

        print(f"Files processed: {files_processed}; module_sources rows updated: {rows_updated}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
