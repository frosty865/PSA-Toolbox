# Module Ingestion SSL Connection Fix

## Issue

**Error:** `no pg_hba.conf entry for host "73.46.228.147", user "postgres", database "postgres", no encryption`

**Root Cause:** The Python script `ingest_module_pdf_to_runtime.py` was not properly adding SSL mode to the connection string for Supabase connections.

## Fix Applied

Updated `tools/corpus/ingest_module_pdf_to_runtime.py`:

1. **Simplified SSL handling** - Changed from complex URL parsing/reconstruction to simple string append
2. **Fixed connection string format** - Ensures `?sslmode=require` is appended for Supabase connections
3. **Fixed fallback connection** - Ensures SSL is included in fallback connection string

### Changes

**Before:**
```python
# Complex URL parsing that wasn't working correctly
parsed = urlparse(runtime_url)
query_params = parse_qs(parsed.query)
# ... complex reconstruction
return psycopg2.connect(runtime_url, sslmode='require')  # Wrong - sslmode not a valid kwarg
```

**After:**
```python
# Simple string append
if 'supabase' in runtime_url.lower() and '?sslmode=' not in runtime_url:
    separator = '&' if '?' in runtime_url else '?'
    runtime_url = f"{runtime_url}{separator}sslmode=require"
return psycopg2.connect(runtime_url)  # Correct - sslmode in connection string
```

## Verification

Manual test successful:
```bash
python tools/corpus/ingest_module_pdf_to_runtime.py \
  --pdf-path "storage/module_sources/incoming/MODULE_EV_PARKING/file.pdf" \
  --module-code MODULE_EV_PARKING \
  --label "Test"
```

**Result:** ✅ Successfully ingested 12 chunks into module_document

## Next Steps

1. **Restart the watcher** (if it was running):
   ```bash
   npm run module:watch
   ```

2. **Monitor logs** - Should now see successful ingestion:
   ```
   [INGEST] file.pdf -> RUNTIME module_documents (MODULE_EV_PARKING)
   [OK] file.pdf ingested successfully into RUNTIME for MODULE_EV_PARKING
   ```

3. **Verify ingestion**:
   ```bash
   npx tsx tools/db/debug_module_ingestion.ts MODULE_EV_PARKING
   ```

## Status

- ✅ SSL connection fixed
- ✅ Manual test successful
- ✅ pdfplumber installed
- ⏳ Watcher should now process remaining 4 PDFs
