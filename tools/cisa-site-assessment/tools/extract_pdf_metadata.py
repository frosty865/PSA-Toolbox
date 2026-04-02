#!/usr/bin/env python3
"""
Extract PDF metadata for source registry upload.
Outputs JSON: title, publisher, citation_short, citation_full, publication_date, year.

Title, publisher, and publication date are scraped from document content only
(PDF metadata + first two pages of text). File name is NEVER used.

Usage:
  python extract_pdf_metadata.py <file.pdf>              # Single file → one JSON object
  python extract_pdf_metadata.py <directory>              # Directory → recurse, output JSON array
  python extract_pdf_metadata.py --type corpus            # Recurse CORPUS_SOURCES_ROOT
  python extract_pdf_metadata.py --type module            # Recurse MODULE_SOURCES_ROOT
  python extract_pdf_metadata.py --type technology        # Recurse technology library dir
  python extract_pdf_metadata.py --type corpus --update-db   # Extract then UPDATE source_registry
  python extract_pdf_metadata.py --type module --update-db   # Extract then UPDATE module_sources
  python extract_pdf_metadata.py --type corpus --update-db --dry-run  # Report only, no writes
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent
sys.path.insert(0, str(_project_root))


def _load_env():
    """Load .env.local / .local.env / .env so CORPUS_DATABASE_URL etc. are set."""
    for name in (".env.local", ".local.env", ".env"):
        p = _project_root / name
        if p.exists():
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
            return


from model.ingest.pdf_citation_extractor import scrape_source_metadata_from_content


def _resolve_root(env_key: str, default_rel: str) -> Path:
    raw = os.environ.get(env_key, "").strip().strip('"').strip("'")
    if raw:
        p = Path(raw)
        return p if p.is_absolute() else (_project_root / raw).resolve()
    return (_project_root / default_rel).resolve()


def get_directory_for_type(library_type: str) -> Path:
    """Resolve the root directory for corpus, module, or technology. Uses env vars."""
    if library_type == "corpus":
        return _resolve_root("CORPUS_SOURCES_ROOT", "storage/corpus_sources")
    if library_type == "module":
        return _resolve_root("MODULE_SOURCES_ROOT", "storage/module_sources")
    if library_type == "technology":
        # CORPUS_TECHNOLOGY_INCOMING or corpus_sources/incoming/technology
        raw = os.environ.get("CORPUS_TECHNOLOGY_INCOMING", "").strip().strip('"').strip("'")
        if raw:
            p = Path(raw)
            return p if p.is_absolute() else (_project_root / raw).resolve()
        corpus = _resolve_root("CORPUS_SOURCES_ROOT", "storage/corpus_sources")
        return corpus / "incoming" / "technology"
    raise ValueError(f"Unknown type: {library_type}. Use corpus, module, or technology.")


def process_one(pdf_path: Path) -> dict:
    """Extract metadata for a single PDF. Returns result dict or error dict."""
    try:
        scraped = scrape_source_metadata_from_content(str(pdf_path))
        return {
            'path': str(pdf_path),
            'inferred_title': scraped.get('title'),
            'pdf_meta_title': scraped.get('pdf_meta_title'),
            'publisher': scraped.get('publisher'),
            'publication_date': scraped.get('publication_date'),
            'year': scraped.get('year'),
            'citation_short': scraped.get('citation_short'),
            'citation_full': scraped.get('citation_full'),
            'title_confidence': scraped.get('title_confidence'),
            'ingestion_warnings': scraped.get('ingestion_warnings', []),
        }
    except Exception as e:
        return {'path': str(pdf_path), 'error': str(e)}


def _norm_path(p: Path) -> str:
    """Normalize path for matching (resolve, forward slashes, lower on Windows)."""
    s = str(p.resolve()).replace("\\", "/")
    return s.lower() if os.name == "nt" else s


def update_db(results: list, library_type: str, dry_run: bool) -> int:
    """
    Update source_registry (corpus/technology) or module_sources (module) from extraction results.
    Matches by file path; returns count of rows updated.
    """
    _load_env()
    updated = 0
    # Only consider successful results with a path
    to_apply = [r for r in results if r.get("path") and "error" not in r]

    if library_type in ("corpus", "technology"):
        try:
            from tools.db.corpus_db import get_corpus_conn
        except ImportError:
            print(json.dumps({"error": "Cannot update DB: install psycopg2 and ensure tools.db.corpus_db is available"}), file=sys.stderr)
            return 0
        root = get_directory_for_type("corpus") if library_type == "corpus" else get_directory_for_type("technology")
        # For technology we still use corpus source_registry; technology dir is under corpus root
        corpus_root = get_directory_for_type("corpus") if library_type == "technology" else root
        conn = get_corpus_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, storage_relpath, local_path FROM public.source_registry WHERE storage_relpath IS NOT NULL AND storage_relpath <> '' OR local_path IS NOT NULL AND local_path <> ''"
                )
                rows = cur.fetchall()
            path_to_id = {}
            for row in rows:
                sr_id, storage_relpath, local_path = row
                for rel in (storage_relpath, local_path):
                    if not rel:
                        continue
                    rel = rel.replace("\\", "/").lstrip("/")
                    abs_p = (corpus_root / rel).resolve()
                    path_to_id[_norm_path(abs_p)] = sr_id
                if local_path and Path(local_path).is_absolute():
                    path_to_id[_norm_path(Path(local_path))] = sr_id
            for r in to_apply:
                abs_path = _norm_path(Path(r["path"]))
                sr_id = path_to_id.get(abs_path)
                if not sr_id:
                    continue
                title = (r.get("inferred_title") or r.get("pdf_meta_title") or "").strip() or None
                publisher = (r.get("publisher") or "").strip() or None
                pub_date = r.get("publication_date")
                if dry_run:
                    updated += 1
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.source_registry SET title = COALESCE(%s, title), publisher = COALESCE(%s, publisher), publication_date = COALESCE(%s, publication_date), updated_at = now() WHERE id = %s",
                        (title, publisher, pub_date, sr_id),
                    )
                conn.commit()
                updated += 1
        finally:
            conn.close()

    elif library_type == "module":
        try:
            from tools.db.runtime_db import get_runtime_conn
        except ImportError:
            print(json.dumps({"error": "Cannot update DB: install psycopg2 and ensure tools.db.runtime_db is available"}), file=sys.stderr)
            return 0
        root = get_directory_for_type("module")
        conn = get_runtime_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, storage_relpath FROM public.module_sources WHERE source_type = 'MODULE_UPLOAD' AND storage_relpath IS NOT NULL AND storage_relpath <> ''"
                )
                rows = cur.fetchall()
            path_to_id = {}
            for row in rows:
                ms_id, storage_relpath = row
                if not storage_relpath:
                    continue
                rel = storage_relpath.replace("\\", "/").lstrip("/")
                abs_p = (root / rel).resolve()
                path_to_id[_norm_path(abs_p)] = ms_id
            for r in to_apply:
                abs_path = _norm_path(Path(r["path"]))
                ms_id = path_to_id.get(abs_path)
                if not ms_id:
                    continue
                publisher = (r.get("publisher") or "").strip() or None
                title = (r.get("inferred_title") or r.get("pdf_meta_title") or "").strip() or None
                if dry_run:
                    updated += 1
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE public.module_sources SET publisher = COALESCE(%s, publisher), source_label = COALESCE(%s, source_label) WHERE id = %s",
                        (publisher, title, ms_id),
                    )
                conn.commit()
                updated += 1
        finally:
            conn.close()

    return updated


def main():
    argv = [a for a in sys.argv[1:] if a != '--recursive']
    update_db_flag = '--update-db' in argv
    dry_run = '--dry-run' in argv
    argv = [a for a in argv if a not in ('--update-db', '--dry-run')]

    type_arg = None
    if '--type' in argv:
        try:
            i = argv.index('--type')
            if i + 1 < len(argv):
                type_arg = argv[i + 1].lower()
            if type_arg not in ('corpus', 'module', 'technology'):
                type_arg = None
        except (ValueError, IndexError):
            type_arg = None

    if update_db_flag and not type_arg:
        print(json.dumps({"error": "When using --update-db you must specify --type corpus|module|technology"}), file=sys.stderr)
        sys.exit(1)

    if type_arg:
        target = get_directory_for_type(type_arg)
        if not target.is_dir():
            print(json.dumps({"error": f"Resolved path for --type {type_arg} is not a directory: {target}"}), file=sys.stderr)
            sys.exit(1)
    else:
        if not argv or argv[0].startswith('-'):
            print(json.dumps({"error": "PDF path, directory, or --type corpus|module|technology required"}), file=sys.stderr)
            sys.exit(1)
        target = Path(argv[0])
        if not target.exists():
            print(json.dumps({"error": f"File or directory not found: {target}"}), file=sys.stderr)
            sys.exit(1)

    if target.is_file():
        if target.suffix.lower() != '.pdf':
            print(json.dumps({"error": f"Not a PDF file: {target}"}), file=sys.stderr)
            sys.exit(1)
        result = process_one(target)
        if 'error' in result:
            print(json.dumps(result), file=sys.stderr)
            sys.exit(1)
        print(json.dumps(result))
        return

    # Directory: recurse and collect all PDFs
    if target.is_dir():
        pdfs = sorted(target.rglob('*.pdf'))
        if not pdfs:
            print(json.dumps({"error": f"No PDF files found under {target}"}), file=sys.stderr)
            sys.exit(1)
        results = []
        for pdf_path in pdfs:
            results.append(process_one(pdf_path))
        if update_db_flag:
            _load_env()
            n = update_db(results, type_arg, dry_run)
            if dry_run:
                print(json.dumps({"dry_run": True, "would_update": n, "results_count": len(results)}), file=sys.stderr)
            else:
                print(json.dumps({"updated": n, "results_count": len(results)}), file=sys.stderr)
        print(json.dumps(results))
        return

    print(json.dumps({"error": f"Not a file or directory: {target}"}), file=sys.stderr)
    sys.exit(1)


if __name__ == '__main__':
    main()
