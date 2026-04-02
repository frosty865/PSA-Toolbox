#!/usr/bin/env python3
"""
Rerun module document ingestion from scratch for all PDFs in storage/module_sources/raw/_blobs.

For each PDF in the blob directory:
  1. Compute SHA256 and find existing module_documents (module_code, label) for that sha256.
  2. Delete module_chunks and module_documents for those rows (so chunks and doc rows are gone).
  3. Re-ingest the PDF for each (module_code, label) via ingest_module_pdf.

Blobs with no existing module_documents are ingested once as MODULE_UNASSIGNED with label from
filename so they get chunked and can be assigned to modules later.

Usage:
  python tools/corpus/rerun_module_blobs_from_scratch.py [--blob-dir PATH] [--dry-run] [--limit N]
  python tools/corpus/rerun_module_blobs_from_scratch.py --blob-dir "D:\\PSA_System\\psa_rebuild\\storage\\module_sources\\raw\\_blobs"
"""

import argparse
import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

# Load .env.local
for p in (project_root / ".env.local", project_root / ".local.env"):
    if p.exists():
        with open(p) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        break

from tools.corpus.ingest_module_pdf_to_runtime import (
    get_runtime_connection,
    sha256_file,
    ingest_module_pdf,
)

MODULE_SOURCES_ROOT = os.environ.get("MODULE_SOURCES_ROOT") or str(project_root / "storage" / "module_sources")
DEFAULT_BLOB_DIR = Path(MODULE_SOURCES_ROOT) / "raw" / "_blobs"


def find_pdfs(dir_path: Path):
    """Yield all PDF paths under dir_path (recursive)."""
    if not dir_path.is_dir():
        return
    for p in dir_path.rglob("*"):
        if p.is_file() and p.suffix.lower() == ".pdf":
            yield p


def label_from_filename(p: Path) -> str:
    return p.stem.replace("_", " ").replace("-", " ").strip() or "PDF document"


def main():
    ap = argparse.ArgumentParser(description="Rerun module ingestion from scratch for all PDFs in raw/_blobs")
    ap.add_argument(
        "--blob-dir",
        type=Path,
        default=DEFAULT_BLOB_DIR,
        help=f"Blob directory (default: {DEFAULT_BLOB_DIR})",
    )
    ap.add_argument("--dry-run", action="store_true", help="Only list PDFs and existing module_documents; do not delete or ingest")
    ap.add_argument("--limit", type=int, default=0, help="Max number of PDFs to process (0 = no limit)")
    args = ap.parse_args()

    blob_dir = args.blob_dir.resolve()
    if not blob_dir.is_dir():
        print(f"[ERROR] Blob dir not found: {blob_dir}")
        sys.exit(1)

    pdfs = list(find_pdfs(blob_dir))
    if not pdfs:
        print(f"[INFO] No PDFs found under {blob_dir}")
        return

    print(f"[INFO] Found {len(pdfs)} PDF(s) under {blob_dir}")
    if args.dry_run:
        print("[DRY-RUN] No deletes or ingest will be performed\n")

    conn = get_runtime_connection()
    try:
        ok = 0
        fail = 0
        for i, pdf_path in enumerate(pdfs):
            if args.limit and i >= args.limit:
                print(f"[INFO] Stopping after {args.limit} PDFs (--limit)")
                break

            sha256 = sha256_file(pdf_path)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, module_code, label
                    FROM public.module_documents
                    WHERE sha256 = %s
                    ORDER BY module_code
                    """,
                    (sha256,),
                )
                rows = cur.fetchall()

            if args.dry_run:
                if rows:
                    print(f"  {pdf_path.name} (sha256={sha256[:12]}...) -> {len(rows)} module_doc(s): {[(r[1], r[2][:40]) for r in rows]}")
                else:
                    print(f"  {pdf_path.name} (sha256={sha256[:12]}...) -> no module_documents (orphan blob)")
                continue

            # Delete existing module_chunks and module_documents for this sha256
            if rows:
                doc_ids = [r[0] for r in rows]
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM public.module_chunks WHERE module_document_id = ANY(%s)",
                        (doc_ids,),
                    )
                    cur.execute(
                        "DELETE FROM public.module_documents WHERE id = ANY(%s)",
                        (doc_ids,),
                    )
                conn.commit()
                targets = [(r[1], r[2]) for r in rows]  # (module_code, label)
            else:
                targets = [("MODULE_UNASSIGNED", label_from_filename(pdf_path))]

            for module_code, label in targets:
                result = ingest_module_pdf(str(pdf_path), module_code, label)
                if result.get("status") in ("ingested", "already_ingested"):
                    ok += 1
                else:
                    fail += 1
                    print(f"[FAIL] {pdf_path.name} -> {module_code}: {result.get('error', result)}")

        if not args.dry_run:
            print(f"\n[DONE] OK={ok} FAIL={fail}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
