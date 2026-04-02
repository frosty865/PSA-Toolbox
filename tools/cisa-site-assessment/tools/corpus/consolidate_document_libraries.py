#!/usr/bin/env python3
"""
Consolidate PDFs system-wide into raw/_blobs/ (one canonical library per root). Deprecate old folders.

- Module (RUNTIME): Discover PDFs in raw subfolders (e.g. raw/MODULE_AS_EAP/), ensure document_blobs row,
  then move each to raw/_blobs/<Title-Author-Year>.pdf and update document_blobs, module_sources, module_documents.
- Corpus (CORPUS): For each source_registry file, move to raw/_blobs/<Title-Author-Year>.pdf and update DB.
- --deprecate: After consolidation, move old raw subdirs (e.g. raw/MODULE_AS_EAP/) to raw/_deprecated/<name>.

Usage:
  python tools/corpus/consolidate_document_libraries.py --target module [--dry-run] [--limit N]
  python tools/corpus/consolidate_document_libraries.py --target corpus [--dry-run] [--limit N]
  python tools/corpus/consolidate_document_libraries.py --target all [--dry-run] [--limit N]
  python tools/corpus/consolidate_document_libraries.py --target all --deprecate [--dry-run]
"""

import argparse
import hashlib
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Load .env.local
for env_path in (project_root / ".env.local", project_root / ".local.env"):
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        break

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(1)

try:
    from model.ingest.pdf_citation_extractor import scrape_source_metadata_from_content
except ImportError:
    scrape_source_metadata_from_content = None


def _sanitize_for_filename(s: str, max_len: int = 120) -> str:
    if not s or not isinstance(s, str):
        return ""
    s = s.replace("\\", "_").replace("/", "_").replace(":", "-").replace("*", "_")
    s = s.replace("?", "_").replace('"', "_").replace("<", "_").replace(">", "_").replace("|", "_")
    s = " ".join(s.split()).strip()
    if len(s) > max_len:
        s = s[:max_len].rstrip()
    return s or ""


def _parsed_basename(title: Optional[str], publisher: Optional[str], year: Optional[int]) -> Optional[str]:
    title_clean = _sanitize_for_filename(title, max_len=100) if title else ""
    author_clean = _sanitize_for_filename(publisher, max_len=80) if publisher else ""
    year_str = str(year) if year and 1900 <= year <= 2100 else ""
    if not title_clean:
        return None
    parts = [title_clean]
    if author_clean:
        parts.append(author_clean)
    if year_str:
        parts.append(year_str)
    return "-".join(parts) if parts else None


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _resolve_corpus_file(path: Path) -> Optional[Path]:
    """If path is a directory (e.g. tier1 crawler layout), return the actual file inside (raw.bin or *.pdf)."""
    if not path.exists():
        return None
    if path.is_file():
        return path
    if path.is_dir():
        for name in ("raw.bin", "raw.pdf"):
            candidate = path / name
            if candidate.is_file():
                return candidate
        for p in path.iterdir():
            if p.is_file() and p.suffix.lower() == ".pdf":
                return p
    return None


def _resolve_parsed_relpath(pdf_path: Path, sha256: str, existing_relpaths: set, blob_dir: str = "raw/_blobs") -> str:
    """Build relpath Title-Author-Year.pdf; if collision append -<sha256[:8]>."""
    basename = None
    if scrape_source_metadata_from_content:
        try:
            meta = scrape_source_metadata_from_content(str(pdf_path))
            basename = _parsed_basename(
                meta.get("title"), meta.get("publisher"), meta.get("year")
            )
        except Exception:
            pass
    if basename:
        candidate = f"{blob_dir}/{basename}.pdf"
        if candidate in existing_relpaths:
            candidate = f"{blob_dir}/{basename}-{sha256[:8]}.pdf"
        return candidate
    return f"{blob_dir}/{sha256[:2]}/{sha256}.pdf"


def get_runtime_conn():
    url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if url:
        try:
            from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
            return psycopg2.connect(sanitize_psycopg2_dsn(url))
        except Exception:
            pass
    from urllib.parse import urlparse
    supabase_url = os.environ.get("SUPABASE_RUNTIME_URL")
    pw = os.environ.get("SUPABASE_RUNTIME_DB_PASSWORD")
    if not supabase_url or not pw:
        raise ValueError("Set RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD")
    pw = pw.strip().strip('"').strip("'").replace("\\", "")
    u = urlparse(supabase_url.strip().strip('"').replace("\\", ""))
    ref = u.hostname.split(".")[0] if u.hostname else None
    if not ref:
        raise ValueError("Could not parse project_ref from SUPABASE_RUNTIME_URL")
    for port in (6543, 5432):
        try:
            return psycopg2.connect(
                f"postgresql://postgres:{pw}@db.{ref}.supabase.co:{port}/postgres?sslmode=require"
            )
        except psycopg2.OperationalError:
            continue
    raise RuntimeError("Could not connect to RUNTIME DB")


def get_corpus_conn():
    url = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("CORPUS_DB_URL")
    if url:
        try:
            from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
            return psycopg2.connect(sanitize_psycopg2_dsn(url))
        except Exception:
            pass
    from urllib.parse import urlparse
    supabase_url = os.environ.get("SUPABASE_CORPUS_URL")
    pw = os.environ.get("SUPABASE_CORPUS_DB_PASSWORD")
    if not supabase_url or not pw:
        raise ValueError("Set CORPUS_DATABASE_URL or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD")
    pw = pw.strip().strip('"').strip("'").replace("\\", "")
    u = urlparse(supabase_url.strip().strip('"').replace("\\", ""))
    ref = u.hostname.split(".")[0] if u.hostname else None
    if not ref:
        raise ValueError("Could not parse project_ref from SUPABASE_CORPUS_URL")
    for port in (6543, 5432):
        try:
            return psycopg2.connect(
                f"postgresql://postgres:{pw}@db.{ref}.supabase.co:{port}/postgres?sslmode=require"
            )
        except psycopg2.OperationalError:
            continue
    raise RuntimeError("Could not connect to CORPUS DB")


def _discover_module_raw_subfolders(root: Path, dry_run: bool, limit: Optional[int]) -> int:
    """Discover PDFs in raw subfolders; insert missing document_blobs or repair broken storage_relpath. Returns count inserted + repaired."""
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return 0
    skip_names = {"_blobs", "_deprecated"}
    changed = 0
    conn = get_runtime_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT sha256, storage_relpath FROM public.document_blobs")
            rows = cur.fetchall()
        existing_sha = set(r[0] for r in rows)
        path_by_sha = {r[0]: r[1] for r in rows}
        for subdir in sorted(raw_dir.iterdir()):
            if subdir.name in skip_names or not subdir.is_dir():
                continue
            for pdf in subdir.rglob("*.pdf"):
                if not pdf.is_file() or limit is not None and changed >= limit:
                    continue
                try:
                    sha256 = _sha256_file(pdf)
                except Exception:
                    continue
                relpath = pdf.relative_to(root).as_posix()
                if sha256 in existing_sha:
                    old_relpath = path_by_sha.get(sha256)
                    old_abs = (root / (old_relpath or "").replace("\\", "/")).resolve() if old_relpath else None
                    if old_abs and old_abs.exists():
                        continue
                    if dry_run:
                        print(f"[DRY-RUN] Repair: {relpath} (sha256={sha256[:12]}...) -> update document_blobs.storage_relpath")
                        changed += 1
                        continue
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE public.document_blobs SET storage_relpath = %s WHERE sha256 = %s",
                            (relpath, sha256),
                        )
                        if cur.rowcount:
                            changed += 1
                            path_by_sha[sha256] = relpath
                            print(f"[REPAIR] {relpath} -> document_blobs (sha256={sha256[:12]}...)")
                    continue
                if dry_run:
                    print(f"[DRY-RUN] Discover: {relpath} (sha256={sha256[:12]}...) -> insert document_blobs")
                    changed += 1
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO public.document_blobs (sha256, storage_relpath) VALUES (%s, %s) ON CONFLICT (sha256) DO NOTHING",
                        (sha256, relpath),
                    )
                    if cur.rowcount:
                        changed += 1
                        existing_sha.add(sha256)
                        path_by_sha[sha256] = relpath
                        print(f"[DISCOVER] {relpath} -> document_blobs (sha256={sha256[:12]}...)")
        if changed:
            conn.commit()
    finally:
        conn.close()
    return changed


def _deprecate_old_raw_subdirs(root: Path, dry_run: bool, label: str) -> int:
    """Move raw subdirs (except _blobs, _deprecated) to raw/_deprecated/<name>. Returns count moved."""
    raw_dir = root / "raw"
    if not raw_dir.is_dir():
        return 0
    keep = {"_blobs", "_deprecated"}
    deprecated_root = raw_dir / "_deprecated"
    moved = 0
    for subdir in list(raw_dir.iterdir()):
        if not subdir.is_dir() or subdir.name in keep:
            continue
        dest = deprecated_root / subdir.name
        if dry_run:
            print(f"[DRY-RUN] Deprecate {label}: raw/{subdir.name} -> raw/_deprecated/{subdir.name}")
            moved += 1
            continue
        try:
            deprecated_root.mkdir(parents=True, exist_ok=True)
            if dest.exists():
                continue
            shutil.move(str(subdir), str(dest))
            print(f"[DEPRECATE] {label}: raw/{subdir.name} -> raw/_deprecated/{subdir.name}")
            moved += 1
        except (OSError, shutil.Error) as e:
            print(f"[WARN] Could not move raw/{subdir.name}: {e}", file=sys.stderr)
    return moved


def consolidate_module_library(dry_run: bool, limit: Optional[int]) -> int:
    root = Path(os.environ.get("MODULE_SOURCES_ROOT") or str(project_root / "storage" / "module_sources"))
    root = root.resolve()
    conn = get_runtime_conn()
    # Discover PDFs in raw subfolders (e.g. raw/MODULE_AS_EAP/) so they get consolidated
    n_discovered = _discover_module_raw_subfolders(root, dry_run, limit)
    if n_discovered and not dry_run:
        conn = get_runtime_conn()
    updated = 0
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, sha256, storage_relpath FROM public.document_blobs ORDER BY created_at"
            )
            rows = cur.fetchall()
            if limit:
                rows = rows[:limit]
            existing_relpaths = set()
            cur.execute("SELECT storage_relpath FROM public.document_blobs")
            for r in cur.fetchall():
                existing_relpaths.add(r[0])

        for blob_id, sha256, old_relpath in rows:
            if not old_relpath:
                continue
            old_abs = (root / old_relpath.replace("\\", "/")).resolve()
            if not old_abs.exists():
                print(f"[SKIP] File not found: {old_relpath}")
                continue
            new_relpath = _resolve_parsed_relpath(old_abs, sha256, existing_relpaths, "raw/_blobs")
            if new_relpath == old_relpath:
                print(f"[OK] Already named: {old_relpath}")
                continue
            new_abs = (root / new_relpath.replace("\\", "/")).resolve()
            # Collision: different file already at new path (only check samefile when new_abs exists)
            if new_abs.exists() and not old_abs.samefile(new_abs):
                stem = Path(new_relpath).stem
                new_relpath = f"raw/_blobs/{stem}-{sha256[:8]}.pdf"
                new_abs = (root / new_relpath.replace("\\", "/")).resolve()
                existing_relpaths.add(new_relpath)
            if dry_run:
                print(f"[DRY-RUN] Would: {old_relpath} -> {new_relpath}")
                updated += 1
                continue
            new_abs.parent.mkdir(parents=True, exist_ok=True)
            if not new_abs.exists() or not old_abs.samefile(new_abs):
                shutil.copy2(old_abs, new_abs)
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE public.document_blobs SET storage_relpath = %s WHERE id = %s",
                    (new_relpath, blob_id)
                )
                cur.execute(
                    "UPDATE public.module_sources SET storage_relpath = %s WHERE sha256 = %s",
                    (new_relpath, sha256)
                )
                cur.execute(
                    "UPDATE public.module_documents SET local_path = %s WHERE document_blob_id = %s",
                    (new_relpath, blob_id)
                )
            existing_relpaths.discard(old_relpath)
            existing_relpaths.add(new_relpath)
            if old_abs.exists() and new_abs.exists() and not old_abs.samefile(new_abs):
                try:
                    old_abs.unlink()
                except OSError:
                    pass
            print(f"[OK] {old_relpath} -> {new_relpath}")
            updated += 1
        conn.commit()
    finally:
        conn.close()
    return updated


def consolidate_corpus_library(dry_run: bool, limit: Optional[int]) -> int:
    root = Path(os.environ.get("CORPUS_SOURCES_ROOT") or str(project_root / "storage" / "corpus_sources"))
    root = root.resolve()
    conn = get_corpus_conn()
    updated = 0
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, source_key, doc_sha256, local_path, storage_relpath
                FROM public.source_registry
                WHERE doc_sha256 IS NOT NULL AND (local_path IS NOT NULL OR storage_relpath IS NOT NULL)
                ORDER BY id
            """)
            rows = cur.fetchall()
        # Group by doc_sha256 so we move each file once and update all rows
        by_sha: dict = {}
        for row in rows:
            sid, source_key, doc_sha256, local_path, storage_relpath = row
            path = None
            if local_path:
                path = Path(local_path)
            elif storage_relpath:
                path = root / storage_relpath.replace("\\", "/")
            if not path or not path.exists():
                continue
            # Resolve dir to actual file (tier1 crawler: sha256/raw.bin or *.pdf)
            file_path = _resolve_corpus_file(path)
            if not file_path or not file_path.is_file():
                continue
            key = doc_sha256
            if key not in by_sha:
                by_sha[key] = {"path": file_path, "rows": []}
            by_sha[key]["rows"].append((sid, source_key, storage_relpath))

        items = list(by_sha.items())
        if limit:
            items = items[:limit]
        existing_relpaths = set()
        with conn.cursor() as cur:
            cur.execute("SELECT storage_relpath FROM public.source_registry WHERE storage_relpath IS NOT NULL")
            for r in cur.fetchall():
                existing_relpaths.add(r[0])

        for sha256, data in items:
            path = data["path"]
            # Ensure we have a file (DB may point at tier1 dir; resolve again to be safe)
            if path.is_dir():
                path = _resolve_corpus_file(path) or path
            if not path.is_file():
                print(f"[SKIP] Not a file (or unreadable): {path}")
                continue
            rows_to_update = data["rows"]
            new_relpath = _resolve_parsed_relpath(path, sha256, existing_relpaths, "raw/_blobs")
            new_abs = (root / new_relpath.replace("\\", "/")).resolve()
            old_relpath = rows_to_update[0][2] if rows_to_update else None
            if new_relpath == old_relpath and new_abs.exists():
                continue
            if dry_run:
                print(f"[DRY-RUN] Would: {path.name} -> {new_relpath} (update {len(rows_to_update)} rows)")
                updated += len(rows_to_update)
                continue
            new_abs.parent.mkdir(parents=True, exist_ok=True)
            try:
                if not new_abs.exists() or (path.resolve() != new_abs and not (path.exists() and new_abs.exists() and path.samefile(new_abs))):
                    shutil.copy2(path, new_abs)
            except (PermissionError, OSError) as e:
                print(f"[SKIP] Cannot copy {path}: {e}")
                continue
            with conn.cursor() as cur:
                for sid, _sk, _ in rows_to_update:
                    cur.execute(
                        "UPDATE public.source_registry SET storage_relpath = %s, local_path = %s WHERE id = %s",
                        (new_relpath, str(new_abs), sid)
                    )
            existing_relpaths.add(new_relpath)
            # Only unlink if source is a file (not a dir like tier1 sha256 folder)
            if path.is_file() and path.resolve() != new_abs and path.exists():
                try:
                    path.unlink()
                except OSError:
                    pass
            print(f"[OK] {path.name} -> {new_relpath} ({len(rows_to_update)} rows)")
            updated += len(rows_to_update)
        conn.commit()
    finally:
        conn.close()
    return updated


def main():
    ap = argparse.ArgumentParser(description="Consolidate files into libraries, rename Title-Author-Year, fix DB")
    ap.add_argument("--target", choices=("module", "corpus", "all"), required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, help="Max items to process per target")
    ap.add_argument("--deprecate", action="store_true", help="After consolidation, move old raw subdirs to raw/_deprecated/")
    args = ap.parse_args()
    total = 0
    if args.target in ("module", "all"):
        print("--- Module library (RUNTIME) ---")
        total += consolidate_module_library(args.dry_run, args.limit)
        if args.deprecate:
            root = Path(os.environ.get("MODULE_SOURCES_ROOT") or str(project_root / "storage" / "module_sources")).resolve()
            total += _deprecate_old_raw_subdirs(root, args.dry_run, "module")
    if args.target in ("corpus", "all"):
        print("--- Corpus library (CORPUS) ---")
        total += consolidate_corpus_library(args.dry_run, args.limit)
        if args.deprecate:
            root = Path(os.environ.get("CORPUS_SOURCES_ROOT") or str(project_root / "storage" / "corpus_sources")).resolve()
            total += _deprecate_old_raw_subdirs(root, args.dry_run, "corpus")
    print(f"Done. Updated: {total}" + (" (dry-run)" if args.dry_run else ""))


if __name__ == "__main__":
    main()
