# Cleanup Module Data from CORPUS

## Overview

Module uploads should NEVER be in CORPUS. They belong in RUNTIME.module_documents and RUNTIME.module_chunks only. This document describes how to clean up incorrectly ingested module data from CORPUS.

## Problem

During development, module files were incorrectly ingested into CORPUS (source_registry, corpus_documents, document_chunks). This violates the architecture where:
- **CORPUS** = Global evidence store (general assessment corpus)
- **RUNTIME** = Module-scoped data (module_documents, module_chunks)

## Cleanup Process

### Step 1: Clean Module Entries from source_registry

Remove all entries from CORPUS.source_registry that have module_code in scope_tags:

```bash
python tools/admin/clean_module_data_from_corpus.py --apply
```

This will:
- Find all source_registry entries with `scope_tags->'tags'->>'module_code'` or `ingestion_stream = 'MODULE'`
- Delete them from source_registry
- **NOTE:** This leaves orphaned corpus_documents and document_chunks

### Step 2: Archive Orphaned corpus_documents and document_chunks

After deleting source_registry entries, archive the orphaned documents and chunks:

```bash
# First, run migration to create archive tables
psql "$CORPUS_DATABASE_URL" -f db/migrations/corpus/20260127_create_archive_tables_for_orphaned_module_data.sql

# Then archive the orphaned data
python tools/admin/archive_orphaned_module_corpus_data.py --apply
```

This will:
- Find corpus_documents linked to deleted/module source_registry entries
- Find document_chunks linked to those documents
- Archive them to `archive.archive_corpus_documents` and `archive.archive_document_chunks`
- Optionally delete them after archiving (use `--delete` flag)

### Step 3: Verify Cleanup

Check that no module data remains in CORPUS:

```sql
-- Should return 0
SELECT COUNT(*) FROM public.source_registry
WHERE scope_tags->'tags'->>'module_code' IS NOT NULL
   OR scope_tags->>'ingestion_stream' = 'MODULE';

-- Should return 0 (or only archived entries)
SELECT COUNT(*) FROM public.corpus_documents cd
LEFT JOIN public.source_registry sr ON sr.id = cd.source_registry_id
WHERE sr.id IS NULL
   OR sr.scope_tags->'tags'->>'module_code' IS NOT NULL
   OR sr.scope_tags->>'ingestion_stream' = 'MODULE';
```

## Archive Tables

After cleanup, orphaned data is stored in:

- `archive.archive_corpus_documents` - Archived corpus_documents
- `archive.archive_document_chunks` - Archived document_chunks

These tables include:
- All original columns from the source tables
- `archived_at` - Timestamp when archived
- `archive_reason` - Reason for archiving (e.g., 'MODULE_INGESTION_ORPHANED')

## Prevention

The new module watcher (`npm run module:watch`) now correctly ingests module files into RUNTIME only:
- Creates entries in `RUNTIME.module_documents`
- Creates chunks in `RUNTIME.module_chunks`
- **Never touches CORPUS**

## Files

- `tools/admin/clean_module_data_from_corpus.py` - Clean source_registry
- `tools/admin/archive_orphaned_module_corpus_data.py` - Archive orphaned data
- `db/migrations/corpus/20260127_create_archive_tables_for_orphaned_module_data.sql` - Create archive tables
- `tools/corpus/watch_module_ingestion.ts` - New RUNTIME-only watcher
- `tools/corpus/ingest_module_pdf_to_runtime.py` - RUNTIME ingestion script
