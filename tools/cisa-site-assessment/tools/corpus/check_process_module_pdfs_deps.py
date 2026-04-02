#!/usr/bin/env python3
"""
Check that all dependencies for process_module_pdfs_from_incoming.py are installed
in the current Python (e.g. processor venv).

Run with processor venv:
  D:\\PSA_System\\Dependencies\\python\\venvs\\processor\\Scripts\\python.exe tools/corpus/check_process_module_pdfs_deps.py

Or: scripts\\process_module_pdfs_from_incoming.bat ... (uses same venv)
"""

import os
import sys
from pathlib import Path

# Project root (psa_rebuild)
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

def check(name: str, fn, required: bool = True) -> bool:
    try:
        fn()
        print(f"  OK   {name}")
        return True
    except Exception as e:
        if required:
            print(f"  FAIL {name}: {e}")
            return False
        print(f"  SKIP {name} (optional): {e}")
        return True

print("Checking third-party packages (processor venv)...")
print()

ok = True

# Required
ok &= check("psycopg2", lambda: __import__("psycopg2"))
ok &= check("pdfplumber", lambda: __import__("pdfplumber"))
ok &= check("pypdf", lambda: __import__("pypdf"))

# Optional (OCR fallback in corpus_ingest_pdf)
check("pdf2image", lambda: __import__("pdf2image"), required=False)
check("pytesseract", lambda: __import__("pytesseract"), required=False)

if not ok:
    print()
    print("Install missing packages, e.g.:")
    print('  & "D:\\PSA_System\\Dependencies\\python\\venvs\\processor\\Scripts\\python.exe" -m pip install psycopg2-binary pdfplumber pypdf')
    print("Or recreate the processor venv:")
    print("  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName processor")
    sys.exit(1)

print()
print("Checking import chain (corpus_ingest_pdf, normalize_pdf_filenames, link_module_documents, pdf_citation_extractor)...")

# Load .env so DB helpers can resolve (we only import, we don't connect)
for p in (project_root / ".env.local", project_root / ".local.env"):
    if p.exists():
        with open(p, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
        break

import importlib.util

# 1) corpus_ingest_pdf (pulls in tools.db, model.ingest.pdf_citation_extractor, pdfplumber, psycopg2)
try:
    spec = importlib.util.spec_from_file_location(
        "corpus_ingest_pdf", project_root / "tools" / "corpus_ingest_pdf.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    print("  OK   corpus_ingest_pdf")
except Exception as e:
    print(f"  FAIL corpus_ingest_pdf: {e}")
    ok = False

# 2) normalize_pdf_filenames (psycopg2, model.ingest.pdf_citation_extractor)
if ok:
    try:
        sys.path.insert(0, str(project_root / "tools" / "corpus"))
        from normalize_pdf_filenames import compute_file_hash, extract_title_from_pdf, get_corpus_db_connection
        print("  OK   normalize_pdf_filenames")
    except Exception as e:
        print(f"  FAIL normalize_pdf_filenames: {e}")
        ok = False

# 3) model.ingest.pdf_citation_extractor (pdfplumber / pypdf) — already loaded by above, but explicit check
if ok:
    try:
        from model.ingest.pdf_citation_extractor import extract_citation_metadata
        print("  OK   model.ingest.pdf_citation_extractor")
    except Exception as e:
        print(f"  FAIL model.ingest.pdf_citation_extractor: {e}")
        ok = False

# 4) link_module_documents (psycopg2)
if ok:
    try:
        sys.path.insert(0, str(project_root / "tools" / "research"))
        from link_module_documents import link_document_to_module
        print("  OK   link_module_documents")
    except Exception as e:
        print(f"  FAIL link_module_documents: {e}")
        ok = False

print()
if ok:
    print("All required dependencies are installed.")
    sys.exit(0)
else:
    print("Some required dependencies are missing. See above.")
    sys.exit(1)
