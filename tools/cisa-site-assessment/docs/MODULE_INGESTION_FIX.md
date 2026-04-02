# Module Ingestion Fix

## Issue Found

**Problem:** Module ingestion is not working because `pdfplumber` Python package is missing.

**Status:**
- ✅ Python 3.14.0 installed
- ✅ psycopg2 installed (2.9.11)
- ❌ pdfplumber NOT installed (required for PDF text extraction)

## Fix

### Install Missing Dependency

```bash
# Install pdfplumber
pip install pdfplumber

# Or install all requirements
pip install -r requirements.txt
```

### Verify Installation

```bash
python -c "import pdfplumber; print('pdfplumber:', pdfplumber.__version__)"
```

Expected output: `pdfplumber: <version>`

## Current Status

From debug tool:
- **5 PDFs** waiting in `storage/module_sources/incoming/MODULE_EV_PARKING/`
- **0 files** processed (watcher cannot extract text without pdfplumber)
- **0 documents** in database

## After Installing pdfplumber

1. **Start the watcher:**
   ```bash
   npm run module:watch
   ```

2. **Watch for logs:**
   ```
   [WATCHER] Module Ingestion Watcher (RUNTIME Only)
   [SCAN] Found 5 PDF file(s) to process
   [INGEST] file1.pdf -> RUNTIME module_documents (MODULE_EV_PARKING)
   [OK] file1.pdf ingested successfully into RUNTIME for MODULE_EV_PARKING
   ```

3. **Verify ingestion:**
   ```bash
   npx tsx tools/db/debug_module_ingestion.ts MODULE_EV_PARKING
   ```

## Additional Dependencies

If you encounter other import errors, install:

```bash
pip install pdfplumber psycopg2-binary python-dotenv
```

## Quick Test

After installing pdfplumber, test manual ingestion:

```bash
python tools/corpus/ingest_module_pdf_to_runtime.py \
  --pdf-path "storage/module_sources/incoming/MODULE_EV_PARKING/2026-01-27__driveelectric.gov__physical-site-security__b78baaeb8b71.pdf" \
  --module-code MODULE_EV_PARKING \
  --label "Physical Site Security"
```

Expected output:
```
[OK] Ingested <N> chunks into module_document <uuid>
```
