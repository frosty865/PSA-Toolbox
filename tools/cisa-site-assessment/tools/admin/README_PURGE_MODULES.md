# Module Clean Slate Purge Script

This script purges all module-related data from both RUNTIME and CORPUS databases, with optional filesystem cleanup.

## Safety Features

- **DRY RUN by default** - No deletes are executed unless explicitly enabled
- **Explicit permission required** - Must set `ALLOW_MODULE_PURGE=YES` to execute database deletes
- **Graceful handling** - Skips missing tables without errors
- **FK-safe deletion order** - Deletes child tables before parent tables

## Required Environment Variables

Use either:
- `PSA_RUNTIME_DB_URL` and `PSA_CORPUS_DB_URL`, or
- `RUNTIME_DATABASE_URL` and `CORPUS_DATABASE_URL` (e.g. from `.env.local`)

Or run via the wrapper (builds URLs from `check_db_env`):
```powershell
cd psa_rebuild
python tools/admin/run_purge_dry_run.py --execute --filesystem --source-registry
```

## Optional Environment Variables

- `ALLOW_MODULE_PURGE` - Set to `"YES"` to execute database deletes (default: `"NO"`)
- `ALLOW_MODULE_PURGE_FS` - Set to `"YES"` to delete module source files (default: `"NO"`)
- `ALLOW_MODULE_PURGE_SOURCE_REGISTRY` - Set to `"YES"` to delete module-tagged source_registry rows in CORPUS (default: `"NO"`)
- `MODULE_SOURCES_ROOT` - Path to module sources directory (default: `D:\PSA_System\psa_rebuild\storage\module_sources`)

## Usage Examples

### 1. Dry Run (No Deletes) - Recommended First Step

```powershell
$env:PSA_RUNTIME_DB_URL="postgresql://..."
$env:PSA_CORPUS_DB_URL="postgresql://..."
python tools/admin/purge_modules_clean_slate.py
```

This will show you:
- Which tables exist
- Row counts for each table
- What would be deleted (but doesn't actually delete)

### 2. Execute Database Deletes Only

```powershell
$env:PSA_RUNTIME_DB_URL="postgresql://..."
$env:PSA_CORPUS_DB_URL="postgresql://..."
$env:ALLOW_MODULE_PURGE="YES"
python tools/admin/purge_modules_clean_slate.py
```

### 3. Execute Database Deletes + Wipe Module Source Files

```powershell
$env:PSA_RUNTIME_DB_URL="postgresql://..."
$env:PSA_CORPUS_DB_URL="postgresql://..."
$env:ALLOW_MODULE_PURGE="YES"
$env:ALLOW_MODULE_PURGE_FS="YES"
python tools/admin/purge_modules_clean_slate.py
```

### 4. Full Purge (Database + Files + Source Registry)

```powershell
$env:PSA_RUNTIME_DB_URL="postgresql://..."
$env:PSA_CORPUS_DB_URL="postgresql://..."
$env:ALLOW_MODULE_PURGE="YES"
$env:ALLOW_MODULE_PURGE_FS="YES"
$env:ALLOW_MODULE_PURGE_SOURCE_REGISTRY="YES"
python tools/admin/purge_modules_clean_slate.py
```

**Warning:** The `ALLOW_MODULE_PURGE_SOURCE_REGISTRY=YES` option will delete source_registry rows that are tagged with module-related scope_tags. Use this sparingly and only if you're certain you want to remove module-tagged sources from the corpus.

## What Gets Deleted

**Note:** `assessment_modules` is **not** deleted so you can re-ingest into existing modules.

### RUNTIME Database Tables (in FK-safe order)

Assessment/instance and doctrine tables first, then document/chunk/source data:
`assessment_module_question_responses`, `assessment_module_instances`, `module_instance_*`, `module_ofc_citations`, `module_ofc_sources`, `module_ofcs`, `module_questions`, `module_risk_drivers`, `module_import_batches`, `module_vofc_library`, `module_draft_*`, `module_chunk_comprehension`, `module_chunks`, `module_doc_source_link`, `module_documents`, `document_blobs`, `module_sources`, `module_corpus_links`.

### CORPUS Database Tables

- **Full delete:** `module_chunk_links`, `module_source_documents`.
- **Module-linked only:** Rows in `document_chunks`, `corpus_reprocess_queue`, `corpus_documents` where linked to module-tagged `source_registry`; then `module_standard_citations`, `module_standard_criterion_ofc_templates`, `module_standard_criteria`, `module_standard_references`, `module_standard_attributes`, `module_standards`.

### Optional: Source Registry Cleanup

If `ALLOW_MODULE_PURGE_SOURCE_REGISTRY=YES`, also deletes `source_registry` rows where:
- `scope_tags` contains `'module_code'` or `'moduleCode'`
- `scope_tags->>'source_type'` is LIKE `'MODULE%'` or `'%MODULE%'`

### Optional: Filesystem Cleanup

If `ALLOW_MODULE_PURGE_FS=YES`, deletes all files and directories under `MODULE_SOURCES_ROOT` (but preserves the root directory itself).

## Error Handling

- Missing tables are skipped (not an error)
- All deletes happen in transactions (rollback on failure)
- Connection errors are fatal and stop execution
- Filesystem errors are fatal and stop execution

## Dependencies

- Python 3.7+
- `psycopg` (v3) or `psycopg2` (v2) - PostgreSQL adapter

Install with:
```bash
pip install psycopg  # or psycopg2
```

## Notes

- The script is idempotent - safe to run multiple times
- Missing tables are handled gracefully
- All operations are logged with clear labels
- Post-delete counts are shown for verification
