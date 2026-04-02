#!/usr/bin/env python3
"""
Ingest Module Sources from Storage

Ingests files that are already in module_sources table with valid storage_relpath.
This is for files that were uploaded/downloaded but not yet ingested.

For each module_source with valid storage_relpath:
1. Verify file exists at storage location
2. Register in CORPUS.source_registry (for ingestion)
3. Ingest into CORPUS (corpus_documents, document_chunks) via corpus_ingest_pdf.ingest_pdf
4. Link to module via module_source_documents and module_chunk_links

Usage:
    python tools/corpus/ingest_module_sources.py --module-code MODULE_EV_PARKING [--dry-run] [--limit N]

Note: Requires processor Python environment with dependencies installed.
      Use via: scripts\\ingest_module_sources.bat --module-code MODULE_EV_PARKING
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Project root (psa_rebuild)
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Load .env.local first
def _load_env():
    for p in (project_root / ".env.local", project_root / ".local.env"):
        if p.exists():
            with open(p, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip('"').strip("'")
    return


_load_env()

# Imports after env load
import importlib.util
import psycopg2
from urllib.parse import urlparse
from model.ingest.pdf_citation_extractor import is_hash_like_title

# Get MODULE_SOURCES_ROOT
MODULE_SOURCES_ROOT = os.getenv("MODULE_SOURCES_ROOT", "storage/module_sources")
if not Path(MODULE_SOURCES_ROOT).is_absolute():
    MODULE_SOURCES_ROOT = str(project_root / MODULE_SOURCES_ROOT)

# Dynamic imports
def _import_corpus_ingest():
    spec = importlib.util.spec_from_file_location(
        "corpus_ingest_pdf", project_root / "tools" / "corpus_ingest_pdf.py"
    )
    corpus_ingest_pdf = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(corpus_ingest_pdf)
    return corpus_ingest_pdf


def _import_html_ingest():
    """Import HTML ingestion from ingest_research_downloads."""
    # Need to add research directory to path first
    research_dir = project_root / "tools" / "research"
    if str(research_dir) not in sys.path:
        sys.path.insert(0, str(research_dir.parent))
    
    spec = importlib.util.spec_from_file_location(
        "ingest_research_downloads", research_dir / "ingest_research_downloads.py"
    )
    ingest_research = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ingest_research)
    return ingest_research


corpus_ingest_pdf = _import_corpus_ingest()
ingest_research = _import_html_ingest()

# link_module_documents for linking to module
# Import from research directory
research_dir = project_root / "tools" / "research"
if str(research_dir) not in sys.path:
    sys.path.insert(0, str(research_dir))
from link_module_documents import link_document_to_module


def get_db_connections():
    """Get both CORPUS and RUNTIME database connections."""
    # CORPUS
    corpus_dsn = os.getenv("CORPUS_DATABASE_URL")
    if not corpus_dsn:
        corpus_url = os.getenv("SUPABASE_CORPUS_URL")
        corpus_password = os.getenv("SUPABASE_CORPUS_DB_PASSWORD")
        if corpus_url and corpus_password:
            clean_password = corpus_password.strip().strip('"').strip("'").replace("\\", "")
            clean_url = corpus_url.strip().strip('"').strip("'").replace("\\", "").replace(" ", "")
            url = urlparse(clean_url)
            project_ref = url.hostname.split(".")[0] if url.hostname else None
            if not project_ref:
                raise ValueError(f"Could not parse project_ref from SUPABASE_CORPUS_URL: {corpus_url}")
            corpus_dsn = f"postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require"
        else:
            raise ValueError("Missing CORPUS_DATABASE_URL or (SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD)")
    
    corpus_conn = psycopg2.connect(corpus_dsn)
    
    # RUNTIME
    runtime_dsn = os.getenv("RUNTIME_DATABASE_URL")
    if not runtime_dsn:
        runtime_url = os.getenv("SUPABASE_RUNTIME_URL")
        runtime_password = os.getenv("SUPABASE_RUNTIME_DB_PASSWORD")
        if runtime_url and runtime_password:
            clean_password = runtime_password.strip().strip('"').strip("'").replace("\\", "")
            clean_url = runtime_url.strip().strip('"').strip("'").replace("\\", "").replace(" ", "")
            url = urlparse(clean_url)
            project_ref = url.hostname.split(".")[0] if url.hostname else None
            if not project_ref:
                raise ValueError(f"Could not parse project_ref from SUPABASE_RUNTIME_URL: {runtime_url}")
            runtime_dsn = f"postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require"
        else:
            raise ValueError("Missing RUNTIME_DATABASE_URL or (SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD)")
    
    runtime_conn = psycopg2.connect(runtime_dsn)
    
    return corpus_conn, runtime_conn


def compute_file_hash(file_path: Path) -> str:
    """Compute SHA-256 hash of file."""
    import hashlib
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def already_processed(runtime_conn, corpus_conn, module_code: str, sha256: str) -> bool:
    """Check if file has already been mirrored to CORPUS (module_source_documents is in CORPUS)."""
    with runtime_conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM public.module_sources WHERE module_code = %s AND sha256 = %s LIMIT 1",
            (module_code, sha256),
        )
        row = cur.fetchone()
    if not row:
        return False
    module_source_id = str(row[0])
    with corpus_conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM public.module_source_documents WHERE module_source_id = %s LIMIT 1",
            (module_source_id,),
        )
        return cur.fetchone() is not None


def register_module_source_in_source_registry(
    corpus_conn, file_path: Path, sha256: str, module_code: str, source_label: str, content_type: str, dry_run: bool = False
) -> Optional[str]:
    """Register module source in CORPUS.source_registry.

    Guardrail: module_code MUST be set (MODULE_*). Module ingestion MUST NOT clear
    module_code later. Rows with module_code set MUST NOT be treated as assessment corpus.
    We set scope_tags with module_code and source_type MODULE_UPLOAD so the canonical
    filter (Assessment Corpus = module_code IS NULL) excludes these rows.
    """
    if dry_run:
        return "dry-run-source-registry-id"
    if not module_code or not module_code.strip().upper().startswith("MODULE_"):
        raise ValueError("module_code is required and must be a MODULE_* code")

    with corpus_conn.cursor() as cur:
        # Check if already registered
        source_kind = "PDF" if content_type and "pdf" in content_type.lower() else "HTML"
        cur.execute(
            """
            SELECT id FROM public.source_registry
            WHERE doc_sha256 = %s
            LIMIT 1
            """,
            (sha256,),
        )
        existing = cur.fetchone()
        if existing:
            return str(existing[0])

        # Check for status and ingestion_stream columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='public' AND table_name='source_registry'
            AND column_name IN ('status','ingestion_stream','source_kind')
        """)
        cols = {r[0] for r in cur.fetchall()}

        # Register new — source_key prefix MOD_IN_ and scope_tags.module_code identify module sources
        source_key = f"MOD_IN_{module_code}_{sha256[:12]}"
        scope_tags = {"source_type": "MODULE_UPLOAD", "module_code": module_code}

        # source_registry.source_type must be one of: 'pdf', 'web', 'doc'
        if source_kind == "PDF":
            registry_source_type = "pdf"
        else:
            registry_source_type = "web"

        # Build fields and values dynamically based on schema
        flds = ["source_key", "publisher", "tier", "title", "source_type", "local_path", "doc_sha256", "scope_tags"]
        _title_raw = (source_label or file_path.stem or "").strip()
        _title_safe = _title_raw[:200] if _title_raw and not is_hash_like_title(_title_raw) else "Untitled document"
        vals = [
            source_key,
            "Module Source"[:120],
            3,  # tier
            _title_safe[:200],
            registry_source_type,
            str(file_path),
            sha256,
            json.dumps(scope_tags),
        ]

        if "source_kind" in cols:
            flds.append("source_kind")
            vals.append(source_kind)
        if "status" in cols:
            flds.append("status")
            vals.append("ACTIVE")
        if "ingestion_stream" in cols:
            flds.append("ingestion_stream")
            vals.append("CORPUS")

        placeholders = ", ".join(["%s"] * len(vals))
        cur.execute(
            f"""
            INSERT INTO public.source_registry ({", ".join(flds)})
            VALUES ({placeholders})
            RETURNING id
            """,
            vals,
        )
        sr_id = str(cur.fetchone()[0])
    corpus_conn.commit()
    return sr_id


def extract_title_from_file(file_path: Path) -> tuple[Optional[str], float]:
    """Extract title from file (basic implementation). Never return hash-like stem as title."""
    stem = (file_path.stem or "").strip()
    if not stem or is_hash_like_title(stem):
        return None, 0.0
    return stem.replace("_", " ").replace("-", " "), 0.5


def process_one(
    module_source_id: str,
    module_code: str,
    source_label: str,
    source_url: str,
    storage_relpath: str,
    sha256: str,
    content_type: str,
    corpus_conn,
    runtime_conn,
    authority_scope: str,
    dry_run: bool,
    skip_no_text: bool = False,
    effective_module_code: Optional[str] = None,
) -> Dict:
    """Process one module source for ingestion. effective_module_code: use for CORPUS tagging (e.g. when mirroring pending sources for a target module)."""
    res = {
        "module_source_id": module_source_id,
        "status": "unknown",
        "document_id": None,
        "chunks": 0,
        "error": None,
    }
    
    try:
        # Resolve file path
        module_root = Path(MODULE_SOURCES_ROOT)
        file_path = module_root / storage_relpath
        
        if not file_path.exists():
            res["status"] = "file_not_found"
            res["error"] = f"File not found: {file_path}"
            return res
        
        # Check if already processed (mirror exists in CORPUS)
        if already_processed(runtime_conn, corpus_conn, module_code, sha256):
            res["status"] = "already_processed"
            return res
        
        if dry_run:
            res["status"] = "would_process"
            res["file"] = str(file_path)
            return res
        
        # Register in source_registry (tag with effective_module_code so comprehension sees the target module)
        tag_module = effective_module_code if effective_module_code else module_code
        sr_id = register_module_source_in_source_registry(
            corpus_conn, file_path, sha256, tag_module, source_label, content_type, dry_run=False
        )
        if not sr_id:
            res["status"] = "registration_failed"
            res["error"] = "Could not create source_registry row"
            return res
        
        # Extract title (never use hash-like stem or label as title)
        extracted_title, title_conf = extract_title_from_file(file_path)
        title = extracted_title or source_label
        if not title or is_hash_like_title(title):
            title = "Untitled document"
        
        # Determine file type from actual file (check extension and content_type)
        # Some files may not have extensions in storage_relpath, so check actual file
        actual_suffix = file_path.suffix.lower()
        is_pdf = (
            (content_type and "pdf" in content_type.lower()) or 
            actual_suffix == ".pdf"
        )
        is_html = (
            (content_type and "html" in content_type.lower()) or 
            actual_suffix in [".html", ".htm"] or
            (not actual_suffix and content_type and "html" in content_type.lower())
        )
        
        if is_pdf:
            # Ensure clean transaction state before ingestion
            # The ingestion function manages its own transaction, but we need to ensure
            # the connection is in a good state
            try:
                corpus_conn.rollback()
            except:
                pass
            
            # Ingest PDF
            ingest_result = corpus_ingest_pdf.ingest_pdf(
                pdf_path=str(file_path),
                source_name="Module Source",
                title=title,
                published_at=None,
                authority_scope=authority_scope,
                source_registry_id=sr_id,
                chunk_chars=1800,
                overlap_chars=200,
                skip_no_text=skip_no_text,
            )
            if ingest_result.get("skipped"):
                res["status"] = "skipped_no_text"
                res["error"] = ingest_result.get("message", "No text extracted from any page")
                return res
            res["document_id"] = ingest_result.get("document_id")
            res["chunks"] = ingest_result.get("chunks_count", 0)
            chunk_ids = ingest_result.get("chunk_ids") or []
        elif is_html:
            # Ingest HTML
            try:
                ingest_result = ingest_research.ingest_html_file(
                    html_path=str(file_path),
                    source_registry_id=sr_id,
                    url=f"module://{module_code}/{file_path.name}",
                    title=title,
                    rendered_path=None,  # Could check for .rendered.html version
                    dry_run=False,
                )
                res["document_id"] = ingest_result.get("document_id")
                res["chunks"] = ingest_result.get("chunks_count", 0)
                # HTML ingestion may not return chunk_ids, so we'll need to query them
                chunk_ids = ingest_result.get("chunk_ids") or []
                # If no chunk_ids, try to get them from the document
                if res["document_id"] and not chunk_ids:
                    with corpus_conn.cursor() as cur:
                        cur.execute(
                            """
                            SELECT id FROM public.document_chunks
                            WHERE corpus_document_id = %s
                            ORDER BY chunk_index
                            """,
                            (res["document_id"],),
                        )
                        chunk_ids = [str(row[0]) for row in cur.fetchall()]
            except SystemExit as e:
                # BeautifulSoup4 not installed or other dependency issue
                res["status"] = "dependency_error"
                res["error"] = f"HTML ingestion requires dependencies: {e}"
                return res
        else:
            # For other file types, skip for now
            res["status"] = "unsupported_format"
            res["error"] = f"Unsupported file format: {content_type or file_path.suffix}"
            return res
        
        # Link to module (use row module_code for RUNTIME lookup; effective for CORPUS link)
        if ingest_result.get("document_id"):
            try:
                link_result = link_document_to_module(
                    module_code=module_code,
                    source_url=source_url,
                    sha256=sha256,
                    corpus_document_id=ingest_result["document_id"],
                    chunk_ids=chunk_ids,
                    link_module_code=effective_module_code,
                )
                res["linked_documents"] = link_result.get("linked_documents", 0)
                res["linked_chunks"] = link_result.get("linked_chunks", 0)
            except Exception as e:
                res["linking_error"] = str(e)
                res["linked_documents"] = 0
                res["linked_chunks"] = 0
        else:
            res["linked_documents"] = 0
            res["linked_chunks"] = 0
        
        res["status"] = "processed"
        return res
        
    except Exception as e:
        res["status"] = "error"
        res["error"] = str(e)
        import traceback
        res["traceback"] = traceback.format_exc()
        return res


def main():
    parser = argparse.ArgumentParser(description="Ingest module sources from storage")
    parser.add_argument("--module-code", required=True, help="Module code (e.g., MODULE_EV_PARKING)")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode")
    parser.add_argument("--limit", type=int, help="Limit number of files to process")
    parser.add_argument(
        "--authority-scope",
        default="MODULE_AUTHORITY",
        help="Authority scope for ingestion (default: MODULE_AUTHORITY)",
    )
    parser.add_argument("--skip-no-text", dest="skip_no_text", action="store_true", help="Skip PDFs from which no text can be extracted instead of failing")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print diagnostic counts (candidates, already linked, to process)")
    parser.add_argument(
        "--include-pending",
        action="store_true",
        help="Also include MODULE_PENDING/MODULE_UNASSIGNED sources under raw/ (e.g. raw/pending, raw/_PENDING). Tag them in CORPUS with --module-code.",
    )
    
    args = parser.parse_args()
    
    corpus_conn, runtime_conn = get_db_connections()
    
    UNASSIGNED_CODES = ("MODULE_PENDING", "MODULE_UNASSIGNED")
    
    try:
        # Count all module_sources for this module (diagnostic)
        with runtime_conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*) FROM public.module_sources
                WHERE module_code = %s AND source_type = 'MODULE_UPLOAD'
                """,
                (args.module_code.upper(),),
            )
            total_sources = cur.fetchone()[0]
        # Find module_sources with valid storage_relpath for the target module.
        with runtime_conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    id,
                    module_code,
                    source_label,
                    source_url,
                    storage_relpath,
                    sha256,
                    content_type
                FROM public.module_sources
                WHERE module_code = %s
                    AND source_type = 'MODULE_UPLOAD'
                    AND storage_relpath IS NOT NULL
                    AND trim(storage_relpath) <> ''
                    AND (
                        content_type LIKE '%%pdf%%'
                        OR storage_relpath LIKE '%%.pdf'
                    )
                ORDER BY created_at
                """,
                (args.module_code.upper(),),
            )
            all_rows = list(cur.fetchall())
        # Optionally add pending/unassigned sources under raw/ (e.g. raw/pending, raw/_PENDING)
        if getattr(args, "include_pending", False):
            with runtime_conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 
                        id,
                        module_code,
                        source_label,
                        source_url,
                        storage_relpath,
                        sha256,
                        content_type
                    FROM public.module_sources
                    WHERE module_code = ANY(%s)
                      AND storage_relpath IS NOT NULL
                      AND trim(storage_relpath) <> ''
                      AND (trim(storage_relpath) LIKE 'raw/%%')
                      AND (
                          content_type LIKE '%%pdf%%'
                          OR storage_relpath LIKE '%%.pdf'
                      )
                    ORDER BY created_at
                    """,
                    (list(UNASSIGNED_CODES),),
                )
                pending_rows = cur.fetchall()
            # Tag with target module for CORPUS (effective_module_code); row keeps its module_code for RUNTIME lookup
            n_pending_added = 0
            for r in pending_rows:
                if not any(r[0] == x[0] for x in all_rows):
                    all_rows.append(r)
                    n_pending_added += 1
            if n_pending_added:
                print(f"[INFO] --include-pending: added {n_pending_added} source(s) from MODULE_PENDING/MODULE_UNASSIGNED under raw/")
        if args.limit:
            all_rows = all_rows[: args.limit]
        # Exclude module_sources that already have a CORPUS mirror (module_source_documents)
        already_linked = set()
        if all_rows:
            with corpus_conn.cursor() as cur:
                cur.execute(
                    "SELECT module_source_id FROM public.module_source_documents WHERE module_source_id = ANY(%s)",
                    ([str(r[0]) for r in all_rows],),
                )
                already_linked = {str(r[0]) for r in cur.fetchall()}
        rows = [r for r in all_rows if str(r[0]) not in already_linked]
        
        if args.verbose or not rows:
            print(f"[INFO] Module {args.module_code}: RUNTIME module_sources (MODULE_UPLOAD) = {total_sources}")
            print(f"[INFO] Candidates (storage_relpath set, PDF) = {len(all_rows)}; already mirrored in CORPUS = {len(already_linked)}; to process = {len(rows)}")
            if total_sources == 0 and not getattr(args, "include_pending", False):
                print(f"[INFO] Hint: No MODULE_UPLOAD sources in RUNTIME. If files are in raw/pending or raw/_PENDING (MODULE_PENDING), run with --include-pending to mirror them. Otherwise add/upload sources via module UI then re-run.")
            elif all_rows and not rows:
                print(f"[INFO] Hint: All candidates are already linked. If CORPUS has 0 chunks for this module, run forensic (run_forensic_comprehension.py) and check corpus_documents/chunk pipeline.")
        
        if not rows:
            print(f"[INFO] No uningested module sources found for {args.module_code}")
            return
        
        print(f"[INFO] Found {len(rows)} uningested module sources for {args.module_code}\n")
        
        results = {"processed": [], "already_processed": [], "skipped_no_text": [], "failed": [], "would_process": []}
        
        for row in rows:
            module_source_id, module_code, source_label, source_url, storage_relpath, sha256, content_type = row
            
            print(f"[PROCESSING] {source_label}")
            print(f"  storage_relpath: {storage_relpath}")
            
            # Ensure we start with a clean transaction for each file
            # Rollback any previous aborted transaction
            try:
                corpus_conn.rollback()
                runtime_conn.rollback()
            except:
                pass
            
            # When --include-pending, pending rows get tagged in CORPUS with target module
            effective = (args.module_code.upper() if getattr(args, "include_pending", False) and module_code in UNASSIGNED_CODES else None)
            try:
                r = process_one(
                    str(module_source_id),
                    module_code,
                    source_label,
                    source_url or f"module://{module_code}/{Path(storage_relpath).name}",
                    storage_relpath,
                    sha256,
                    content_type or "",
                    corpus_conn,
                    runtime_conn,
                    args.authority_scope,
                    args.dry_run,
                    skip_no_text=getattr(args, "skip_no_text", False),
                    effective_module_code=effective,
                )
            except Exception as e:
                # Rollback any partial transaction
                try:
                    corpus_conn.rollback()
                    runtime_conn.rollback()
                except:
                    pass
                r = {
                    "module_source_id": str(module_source_id),
                    "status": "error",
                    "error": str(e),
                    "document_id": None,
                    "chunks": 0,
                }
            
            if r["status"] == "processed":
                results["processed"].append(r)
                print(f"  ✓ Processed: doc={r['document_id']} chunks={r['chunks']} linked_docs={r.get('linked_documents',0)} linked_chunks={r.get('linked_chunks',0)}")
            elif r["status"] == "already_processed":
                results["already_processed"].append(r)
                print("  ⊙ Already processed, skip")
            elif r["status"] == "skipped_no_text":
                results["skipped_no_text"].append(r)
                print(f"  ⊙ Skipped (no text): {r.get('error','')}")
            elif r["status"] == "would_process":
                results["would_process"].append(r)
                print(f"  ⊙ Would process: {r.get('file','')}")
            else:
                results["failed"].append(r)
                print(f"  ✗ FAIL: {r.get('error','')}")
        
        print()
        print("Summary: processed=%d already=%d skipped_no_text=%d failed=%d would=%d" % (
            len(results["processed"]),
            len(results["already_processed"]),
            len(results["skipped_no_text"]),
            len(results["failed"]),
            len(results["would_process"]),
        ))
        
        # Save results
        out = project_root / "tools" / "outputs" / f"ingest_module_sources_{args.module_code.lower()}_results.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {out}")
        
    finally:
        corpus_conn.close()
        runtime_conn.close()


if __name__ == "__main__":
    main()
