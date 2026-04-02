# Module Ingestion Debugging Guide

## Quick Debug Command

```bash
# Check status for all modules
npx tsx tools/db/debug_module_ingestion.ts

# Check status for specific module
npx tsx tools/db/debug_module_ingestion.ts MODULE_EV_PARKING
```

## Current Status (from debug tool)

Based on the debug output:
- ✅ **5 PDFs** waiting in `storage/module_sources/incoming/MODULE_EV_PARKING/`
- ❌ **0 files** in raw storage (not processed yet)
- ❌ **0 documents** in RUNTIME database
- ❌ **0 sources** in CORPUS module corpus

**Conclusion:** Watcher is not running or not processing files.

## Step-by-Step Debugging

### 1. Check Watcher Status

```bash
# Check if watcher is running
npm run module:watch
```

**Expected output:**
```
[WATCHER] Module Ingestion Watcher (RUNTIME Only)
[WATCHER] Watching: D:\PSA_System\psa_rebuild\storage\module_sources\incoming
[WATCHER] Storage: D:\PSA_System\psa_rebuild\storage\module_sources\raw/<module_code>/
[SCAN] Scanning for PDFs...
```

### 2. Verify File Structure

Files must be in one of these structures:

**Option A: Subdirectory by module code**
```
storage/module_sources/incoming/
  MODULE_EV_PARKING/
    file1.pdf
    file2.pdf
```

**Option B: Module code in filename**
```
storage/module_sources/incoming/
  MODULE_EV_PARKING_file1.pdf
  MODULE_EV_PARKING_file2.pdf
```

### 3. Check Environment Variables

Required in `.env.local`:
```bash
RUNTIME_DATABASE_URL=postgresql://...
# OR
DATABASE_URL=postgresql://...

# Optional overrides
MODULE_SOURCES_ROOT=storage/module_sources
CORPUS_MODULE_INCOMING=storage/module_sources/incoming
CORPUS_WATCHER_POLL_MS=10000
PYTHON_EXECUTABLE=python
```

### 4. Check Python Script

The watcher calls:
```bash
python tools/corpus/ingest_module_pdf_to_runtime.py \
  --pdf-path <file> \
  --module-code MODULE_EV_PARKING \
  --label <label>
```

**Test manually:**
```bash
python tools/corpus/ingest_module_pdf_to_runtime.py \
  --pdf-path "storage/module_sources/incoming/MODULE_EV_PARKING/file.pdf" \
  --module-code MODULE_EV_PARKING \
  --label "Test Document"
```

### 5. Check Database Tables

**RUNTIME Database:**
```sql
-- Check module_documents
SELECT module_code, COUNT(*) as count, status
FROM public.module_documents
WHERE module_code = 'MODULE_EV_PARKING'
GROUP BY module_code, status;

-- Check module_chunks
SELECT md.module_code, COUNT(mc.id) as chunk_count
FROM public.module_documents md
LEFT JOIN public.module_chunks mc ON mc.module_document_id = md.id
WHERE md.module_code = 'MODULE_EV_PARKING'
GROUP BY md.module_code;

-- Check module_sources
SELECT module_code, source_type, COUNT(*) as count
FROM public.module_sources
WHERE module_code = 'MODULE_EV_PARKING'
GROUP BY module_code, source_type;
```

### 6. Common Issues

#### Issue: Watcher Not Starting
**Symptoms:** No output when running `npm run module:watch`

**Solutions:**
- Check Node.js version: `node --version` (should be 18+)
- Check TypeScript: `npx tsx --version`
- Check database connection: Verify `RUNTIME_DATABASE_URL` is set
- Check Python: `python --version` (should be 3.8+)

#### Issue: Files Not Detected
**Symptoms:** Watcher running but no `[SCAN]` or `[INGEST]` messages

**Solutions:**
- Verify directory structure matches expected pattern
- Check file extensions (must be `.pdf`)
- Check file permissions (readable)
- Verify `MODULE_SOURCES_ROOT` path is correct

#### Issue: Ingestion Fails
**Symptoms:** `[ERROR] ingestion failed` messages

**Solutions:**
- Check Python script logs (stderr output)
- Verify `RUNTIME_DATABASE_URL` is correct
- Check database permissions (INSERT on `module_documents`, `module_chunks`)
- Verify PDF is valid (not corrupted)
- Check Python dependencies: `pdfplumber`, `psycopg2`

#### Issue: No Chunks Created
**Symptoms:** Document created but `chunk_count = 0`

**Solutions:**
- Check if PDF has extractable text (not scanned image)
- Check Python script logs for extraction errors
- Verify `chunk_chars` and `overlap_chars` parameters
- Check `module_chunks` table permissions

### 7. Manual Ingestion Test

If watcher isn't working, test ingestion manually:

```bash
# Test single file
python tools/corpus/ingest_module_pdf_to_runtime.py \
  --pdf-path "storage/module_sources/incoming/MODULE_EV_PARKING/file.pdf" \
  --module-code MODULE_EV_PARKING \
  --label "Test Document"
```

**Expected output:**
```
[OK] Ingested 45 chunks into module_document <uuid>
```

### 8. Verify After Ingestion

After successful ingestion, verify:

```bash
# Re-run debug tool
npx tsx tools/db/debug_module_ingestion.ts MODULE_EV_PARKING
```

**Expected:**
- ✅ Files moved from `incoming/` to `raw/`
- ✅ Documents in `module_documents` table
- ✅ Chunks in `module_chunks` table

## Watcher Logs

The watcher outputs detailed logs:

- `[WATCHER]` - Watcher startup/configuration
- `[SCAN]` - Directory scanning
- `[INGEST]` - Starting ingestion
- `[VERIFY]` - Verifying chunks created
- `[OK]` - Successful ingestion
- `[ERROR]` - Ingestion failed
- `[SKIP]` - File already processed
- `[WARN]` - Warning (e.g., no chunks created)

## Two Ingestion Paths

### Path 1: RUNTIME Only (Recommended)
- **Watcher:** `watch_module_ingestion.ts`
- **Command:** `npm run module:watch`
- **Database:** RUNTIME only (`module_documents`, `module_chunks`)
- **Storage:** `storage/module_sources/raw/<module_code>/`

### Path 2: Module Corpus (Alternative)
- **Watcher:** `watch_module_corpus_ingestion.ts`
- **Command:** Not in package.json (run directly)
- **Database:** CORPUS (`source_registry`, `corpus_documents`, `document_chunks`)
- **Storage:** `storage/module_sources/raw/<module_code>/` (after verification)
- **Tagging:** `ingestion_stream: "MODULE"`, `module_code` in tags

## Next Steps

1. **Start the watcher:**
   ```bash
   npm run module:watch
   ```

2. **Monitor logs** for `[SCAN]`, `[INGEST]`, `[OK]` messages

3. **Re-run debug tool** after a few minutes:
   ```bash
   npx tsx tools/db/debug_module_ingestion.ts MODULE_EV_PARKING
   ```

4. **If still not working**, check:
   - Python script errors
   - Database connection
   - File permissions
   - Module code format (must match `MODULE_[A-Z0-9_]+`)
