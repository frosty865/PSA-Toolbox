#!/usr/bin/env python3
"""
Process module PDFs from storage/module_sources/incoming/ — RUNTIME ONLY.

Single library: no per-module folders. All PDFs go to one incoming/; categorize when
choosing sources for a module (1-to-many; same document can apply to multiple modules).

PDF discovery is recursive: all PDFs under the given directory (and subdirectories) are found.
For each PDF in the incoming directory:
1. Ingest from incoming: one copy per file in MODULE_SOURCES_ROOT/raw/_blobs/ (single library).
2. Insert into RUNTIME.module_sources with canonical blob storage_relpath (links this run to one module).
3. RUNTIME.module_documents + module_chunks via ingest_module_pdf_to_runtime.ingest_module_pdf.

Default pdf-dir is MODULE_SOURCES_ROOT/incoming (single folder). Use --module-code to link
ingested PDFs to that module for this run. To use the same document in multiple modules,
add it as a source to each module when choosing sources in the UI.

Usage:
    python tools/corpus/process_module_pdfs_from_incoming.py --module-code MODULE_AS_EAP [--dry-run]
    python tools/corpus/process_module_pdfs_from_incoming.py --module-code MODULE_X --pdf-dir "D:\\...\\incoming" [--dry-run]

  Or via runner (uses processor venv):
    scripts\\process_module_pdfs_from_incoming.bat --module-code MODULE_EV_PARKING [--dry-run] [--limit N]
"""

import argparse
import json
import os
import re
import sys
import uuid
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
sys.path.insert(0, str(project_root / "tools" / "corpus"))
from normalize_pdf_filenames import compute_file_hash, extract_title_from_pdf
from model.ingest.pdf_citation_extractor import extract_citation_metadata, is_hash_like_title

# RUNTIME-only ingestion (module_documents, module_chunks)
from ingest_module_pdf_to_runtime import ingest_module_pdf

PSA_SYSTEM_ROOT = Path(os.environ.get("PSA_SYSTEM_ROOT", r"D:\PSA_System"))
# Default to module_sources/incoming (single library; no per-module folders)
MODULE_SOURCES_ROOT = os.environ.get("MODULE_SOURCES_ROOT") or str(project_root / "storage" / "module_sources")
RESERVED_DIRS = ("_processed", "_failed")


def _sanitize_basename(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]", "_", s)


def _sanitize_title_for_filename(title: str, max_len: int = 180) -> str:
    """Sanitize document title for use as filename stem (no extension)."""
    if not title or not isinstance(title, str):
        return ""
    s = re.sub(r'[/\\:*?"<>|]', "_", title)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        s = s[:max_len].strip()
    return s or ""


def _get_runtime_conn():
    """RUNTIME DB: prefer RUNTIME_DATABASE_URL; fallback to SUPABASE_RUNTIME_URL + password."""
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        import psycopg2
        from tools.db.dsn_sanitize import sanitize_psycopg2_dsn
        dsn = sanitize_psycopg2_dsn(dsn)
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
    import psycopg2

    for port in (6543, 5432):
        try:
            return psycopg2.connect(
                f"postgresql://postgres:{clean}@db.{ref}.supabase.co:{port}/postgres?sslmode=require"
            )
        except psycopg2.OperationalError:
            continue
    raise RuntimeError("Could not connect to RUNTIME DB")


def find_pdfs(directory: str, recursive: bool = True) -> List[Path]:
    """Find PDFs under directory. If recursive (default), include all subdirectories.
    Skips reserved dirs _processed and _failed so already-processed or failed PDFs are not picked up."""
    d = Path(directory)
    if not d.exists():
        return []
    if recursive:
        found = d.rglob("*.pdf")
        return sorted(
            p for p in found
            if not any(part in RESERVED_DIRS for part in p.parts)
        )
    return sorted(d.glob("*.pdf"))


def ensure_module_exists(runtime_conn, module_code: str) -> bool:
    with runtime_conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM public.assessment_modules WHERE module_code = %s",
            (module_code,),
        )
        return cur.fetchone() is not None


def already_processed(runtime_conn, module_code: str, sha256: str) -> bool:
    """True if module_sources already has (module_code, sha256)."""
    with runtime_conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM public.module_sources
            WHERE module_code = %s AND sha256 = %s
            """,
            (module_code, sha256),
        )
        return cur.fetchone() is not None


def process_one(
    pdf_path: Path,
    module_code: str,
    runtime_conn,
    dry_run: bool,
) -> Dict:
    res = {
        "file": str(pdf_path),
        "status": "unknown",
        "module_source_id": None,
        "module_document_id": None,
        "chunks": 0,
        "error": None,
    }

    try:
        file_hash = compute_file_hash(pdf_path)
        if already_processed(runtime_conn, module_code, file_hash):
            res["status"] = "already_processed"
            return res

        # Extract document title from PDF for source_label (no per-module copy; single library only). NO hash as title.
        extracted_title, _ = extract_title_from_pdf(pdf_path)
        raw_label = extracted_title or _sanitize_basename(pdf_path.stem).replace("_", " ").replace("-", " ")
        label = raw_label if (raw_label and not is_hash_like_title(raw_label.strip())) else "PDF document"

        if dry_run:
            res["status"] = "would_process"
            res["dest"] = "(single library: raw/_blobs/<sha256_prefix>/<sha256>.pdf)"
            return res

        # Ingest directly from incoming path: one copy per file in raw/_blobs/ (single library)
        citation_meta = {}
        try:
            citation_meta = extract_citation_metadata(str(pdf_path), original_filename=pdf_path.name)
        except Exception:
            pass
        _ingest_raw = (
            extracted_title
            or (citation_meta.get("inferred_title") if not is_hash_like_title(citation_meta.get("inferred_title") or "") else None)
            or label
        )
        ingest_label = _ingest_raw if (_ingest_raw and not is_hash_like_title(_ingest_raw)) else "PDF document"
        ingest_result = ingest_module_pdf(
            pdf_path=str(pdf_path),
            module_code=module_code,
            label=ingest_label,
            chunk_chars=1800,
            overlap_chars=200,
        )
        if ingest_result.get("status") in ("ingested", "already_ingested"):
            # Insert module_sources with canonical blob path (single library)
            with runtime_conn.cursor() as cur:
                cur.execute(
                    "SELECT storage_relpath FROM public.document_blobs WHERE sha256 = %s LIMIT 1",
                    (file_hash,),
                )
                blob_path = cur.fetchone()
                storage_relpath = blob_path[0] if blob_path else None
                if not storage_relpath:
                    res["status"] = "ingest_failed"
                    res["error"] = "document_blobs row not found after ingest"
                    return res
                publisher = (citation_meta.get("publisher") or "").strip() or None
                # Upsert: wizard may have created a row with same (module_code, sha256); update it with blob path and status
                cur.execute(
                    "SELECT id FROM public.module_sources WHERE module_code = %s AND sha256 = %s AND source_type = 'MODULE_UPLOAD' LIMIT 1",
                    (module_code, file_hash),
                )
                existing = cur.fetchone()
                if existing:
                    try:
                        cur.execute(
                            """
                            UPDATE public.module_sources SET
                                storage_relpath = %s, content_type = 'application/pdf', fetch_status = 'DOWNLOADED',
                                fetched_at = now(), source_label = COALESCE(NULLIF(trim(%s), ''), source_label),
                                publisher = COALESCE(%s, publisher), source_url = %s
                            WHERE id = %s
                            """,
                            (storage_relpath, label, publisher, str(pdf_path), existing[0]),
                        )
                    except Exception as e:
                        if "publisher" in str(e) and ("column" in str(e) or "does not exist" in str(e)):
                            cur.execute(
                                """
                                UPDATE public.module_sources SET
                                    storage_relpath = %s, content_type = 'application/pdf', fetch_status = 'DOWNLOADED',
                                    fetched_at = now(), source_label = COALESCE(NULLIF(trim(%s), ''), source_label),
                                    source_url = %s
                                WHERE id = %s
                                """,
                                (storage_relpath, label, str(pdf_path), existing[0]),
                            )
                        else:
                            raise
                    module_source_id = str(existing[0])
                else:
                    try:
                        cur.execute(
                            """
                            INSERT INTO public.module_sources (
                                module_code, source_type, source_url, source_label, publisher, sha256, storage_relpath,
                                content_type, fetch_status, fetched_at
                            ) VALUES (%s, 'MODULE_UPLOAD', %s, %s, %s, %s, %s, 'application/pdf', 'DOWNLOADED', now())
                            RETURNING id
                            """,
                            (
                                module_code,
                                str(pdf_path),
                                label,
                                publisher,
                                file_hash,
                                storage_relpath,
                            ),
                        )
                    except Exception as e:
                        if "publisher" in str(e) and ("column" in str(e) or "does not exist" in str(e)):
                            cur.execute(
                                """
                                INSERT INTO public.module_sources (
                                    module_code, source_type, source_url, source_label, sha256, storage_relpath,
                                    content_type, fetch_status, fetched_at
                                ) VALUES (%s, 'MODULE_UPLOAD', %s, %s, %s, %s, 'application/pdf', 'DOWNLOADED', now())
                                RETURNING id
                                """,
                                (module_code, str(pdf_path), label, file_hash, storage_relpath),
                            )
                        else:
                            raise
                    module_source_id = str(cur.fetchone()[0])
            runtime_conn.commit()
            res["module_source_id"] = module_source_id
            res["module_document_id"] = ingest_result.get("module_document_id")
            res["chunks"] = ingest_result.get("chunks_count", 0)
            res["status"] = "processed"
            print(f"[DEBUG] RUNTIME ingest: module_document_id={res['module_document_id']}, chunks={res['chunks']}")
        else:
            # Leave PDF in incoming; mark failed
            failed_msg = ingest_result.get("error", "No chunks created")
            failed_file = pdf_path.parent / (pdf_path.name + ".failed")
            try:
                failed_file.write_text(failed_msg.strip(), encoding="utf-8")
            except OSError:
                pass
            res["status"] = "ingest_failed"
            res["error"] = failed_msg
            print(f"[FAIL] {pdf_path.name} left in incoming, marked .failed: {failed_msg[:80]}")
        return res

    except Exception as e:
        res["status"] = "failed"
        res["error"] = str(e)
        return res


def main():
    ap = argparse.ArgumentParser(description="Process module PDFs from single incoming into a module (single library; categorize when choosing sources).")
    ap.add_argument("--module-code", required=True, help="Module code to link ingested PDFs to (e.g. MODULE_EV_PARKING)")
    ap.add_argument("--pdf-dir", default=None, help="Incoming PDF directory (default: MODULE_SOURCES_ROOT/incoming)")
    ap.add_argument("--limit", type=int, help="Max PDFs to process")
    ap.add_argument("--dry-run", action="store_true", help="Only report what would be done")
    args = ap.parse_args()

    pdf_dir = Path(args.pdf_dir) if args.pdf_dir is not None else Path(MODULE_SOURCES_ROOT) / "incoming"
    if not pdf_dir.exists():
        print(f"PDF directory not found: {pdf_dir}")
        return 1

    pdfs = find_pdfs(str(pdf_dir))
    if not pdfs:
        print(f"No PDFs in {pdf_dir}")
        return 0

    if args.limit:
        pdfs = pdfs[: args.limit]
        print(f"Limited to first {args.limit} PDFs")

    print(f"Module: {args.module_code}")
    print(f"PDF dir: {pdf_dir}")
    print(f"Found {len(pdfs)} PDFs. Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print()

    try:
        runtime_conn = _get_runtime_conn()
    except Exception as e:
        print(f"Runtime DB: {e}")
        return 1

    if not ensure_module_exists(runtime_conn, args.module_code):
        print(f"Module {args.module_code} not found in assessment_modules.")
        return 1

    results = {"total": len(pdfs), "processed": [], "already_processed": [], "failed": [], "would_process": []}

    for i, p in enumerate(pdfs, 1):
        print(f"[{i}/{len(pdfs)}] {p.name}")
        r = process_one(
            p,
            args.module_code,
            runtime_conn,
            args.dry_run,
        )
        if r["status"] == "processed":
            results["processed"].append(r)
            print(f"  OK module_document_id={r.get('module_document_id')} chunks={r.get('chunks', 0)} (RUNTIME only)")
        elif r["status"] == "already_processed":
            results["already_processed"].append(r)
            print("  Already processed, skip")
        elif r["status"] == "would_process":
            results["would_process"].append(r)
            print(f"  Would process -> {r.get('dest','')}")
        else:
            results["failed"].append(r)
            print(f"  FAIL: {r.get('error','')}")

    runtime_conn.close()

    print()
    print("Summary: processed=%d already=%d failed=%d would=%d" % (
        len(results["processed"]),
        len(results["already_processed"]),
        len(results["failed"]),
        len(results["would_process"]),
    ))

    out = project_root / "tools" / "outputs" / "process_module_pdfs_results.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Results: {out}")

    if args.dry_run:
        print("(Dry run; no changes made)")

    return 0 if not results["failed"] else 1


if __name__ == "__main__":
    sys.exit(main())
