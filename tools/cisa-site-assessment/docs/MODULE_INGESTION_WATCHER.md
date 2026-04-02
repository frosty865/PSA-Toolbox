# Module Ingestion Watcher (RUNTIME Only)

## Overview

The module ingestion watcher automatically ingests PDF files from `storage/module_sources/incoming/` into **RUNTIME only** (module_documents and module_chunks). Files must be organized in subdirectories by module code (e.g., `MODULE_EV_PARKING/`).

**IMPORTANT:** Module uploads NEVER go into CORPUS. They are stored only in RUNTIME.module_documents and RUNTIME.module_chunks.

## Quick Start

Start the watcher:

```bash
npm run module:watch
```

The watcher will:
1. Poll `storage/module_sources/incoming/` every 10 seconds (configurable via `CORPUS_WATCHER_POLL_MS`)
2. Find PDFs in subdirectories like `MODULE_EV_PARKING/`
3. Extract module code from directory name or filename
4. Ingest PDFs into RUNTIME module_documents and module_chunks
5. Move processed files to `_processed/` subdirectory

## Directory Structure

Files must be organized like this:

```
storage/module_sources/incoming/
  MODULE_EV_PARKING/
    file1.pdf
    file2.pdf
  MODULE_OTHER/
    file3.pdf
```

Or files can have module code in filename:

```
storage/module_sources/incoming/
  MODULE_EV_PARKING_file1.pdf
  MODULE_OTHER_file2.pdf
```

## Configuration

Environment variables (in `.env.local`):

- `CORPUS_MODULE_INCOMING` - Override incoming directory (default: `storage/module_sources/incoming`)
- `MODULE_SOURCES_ROOT` - Override module sources root (default: `storage/module_sources`)
- `CORPUS_WATCHER_POLL_MS` - Poll interval in milliseconds (default: 10000)
- `RUNTIME_DATABASE_URL` or `DATABASE_URL` - Required: RUNTIME database connection string
- `PYTHON_EXECUTABLE` - Python executable path (default: `python`)

## What Happens During Ingestion

1. **File Detection**: Watcher finds PDFs in module subdirectories
2. **Stability Check**: Waits for file size to stabilize (prevents processing during download)
3. **File Copy**: Copies file to `storage/module_sources/raw/<module_code>/`
4. **PDF Ingestion**: Calls `ingest_module_pdf_to_runtime.py` which:
   - Extracts text from PDF using pdfplumber
   - Chunks text with overlap
   - Creates entry in `RUNTIME.module_documents`
   - Creates chunks in `RUNTIME.module_chunks`
5. **Verification**: Checks that chunks were created successfully
6. **File Move**: Moves processed file to `_processed/` subdirectory

**NOTE:** No CORPUS tables are touched. All data stays in RUNTIME.

## Troubleshooting

### Files Not Being Processed

1. **Check watcher is running**: `npm run module:watch`
2. **Check directory structure**: Files must be in `storage/module_sources/incoming/MODULE_*/`
3. **Check module code format**: Must match `MODULE_[A-Z0-9_]+` pattern
4. **Check file extension**: Only `.pdf` files are processed
5. **Check logs**: Watcher outputs detailed logs for each step

### Common Issues

- **"Directory does not exist"**: Create `storage/module_sources/incoming/` directory
- **"No module_code found"**: Ensure directory name or filename contains `MODULE_*` pattern
- **"Ingestion failed"**: Check Python script logs and RUNTIME_DATABASE_URL
- **"No chunks created"**: Check PDF is valid and text extraction succeeded

## Related Scripts

- `npm run corpus:watch:general` - General corpus watcher (CORPUS only)

## See Also

- `docs/CORPUS_RUNTIME_SEGREGATION.md` - Architecture overview (module uploads NEVER go to CORPUS)
- `tools/corpus/watch_module_ingestion.ts` - Watcher source code
- `tools/corpus/ingest_module_pdf_to_runtime.py` - RUNTIME ingestion script
