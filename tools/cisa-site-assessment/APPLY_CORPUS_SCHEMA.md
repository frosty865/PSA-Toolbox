# Apply CORPUS Schema to CORPUS Project

## Overview

Since direct database access is not available for the CORPUS project, we need to apply the schema using the Supabase SQL Editor.

## Steps

### 1. Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/sql

### 2. Run Safety Checks First

Before applying the schema, verify you're in the correct project:

```sql
-- SAFETY CHECK 1: Confirm database
SELECT current_database();
-- Expected: postgres (or project-specific name)

-- SAFETY CHECK 2: Verify NO runtime tables exist
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('assessments', 'assessment_instances', 'assessment_responses')
ORDER BY table_name
LIMIT 10;
-- Expected: 0 rows (empty result)

-- If you see 'assessments' or 'assessment_instances', STOP - wrong project!
```

### 3. Apply the Schema

Copy and paste the entire contents of `migrations/20260113_create_corpus_schema.sql` into the SQL Editor and run it.

**OR** use the file directly:
- Open: `migrations/20260113_create_corpus_schema.sql`
- Copy all contents
- Paste into Supabase SQL Editor
- Click "Run" or press Ctrl+Enter

### 4. Verify Tables Were Created

After running the migration, verify the tables exist:

```sql
SELECT 'canonical_sources' AS table_name, count(*) AS row_count FROM canonical_sources
UNION ALL 
SELECT 'documents', count(*) FROM documents
UNION ALL 
SELECT 'document_chunks', count(*) FROM document_chunks
UNION ALL 
SELECT 'ingestion_runs', count(*) FROM ingestion_runs
UNION ALL 
SELECT 'ingestion_run_documents', count(*) FROM ingestion_run_documents
UNION ALL 
SELECT 'ofc_candidate_queue', count(*) FROM ofc_candidate_queue
UNION ALL 
SELECT 'ofc_candidate_targets', count(*) FROM ofc_candidate_targets;
```

**Expected Result:**
- All 7 tables should exist
- All row counts should be 0 (empty tables)

### 5. Test Connection Again

After applying the schema, test the connection:

```bash
node scripts/test_db_connections.js
```

Or check the health endpoint:

```bash
curl http://localhost:3000/api/admin/health/dbs
```

## Tables Created

The migration creates these tables:

1. **canonical_sources** - Bibliographic references for evidence-backed OFCs
2. **documents** - Ingested documents from sources
3. **document_chunks** - Text chunks extracted from documents
4. **ingestion_runs** - Tracks ingestion batches
5. **ingestion_run_documents** - Links documents to ingestion runs
6. **ofc_candidate_queue** - OFC candidate snippets from documents
7. **ofc_candidate_targets** - Maps candidates to questions

Plus views:
- **v_eligible_ofc_library** - Eligible OFCs for selection
- **v_question_coverage** - Coverage summary per question

## Notes

- This schema is **CORPUS project only** (yylslokiaovdythzrbgt)
- Do NOT run this on RUNTIME project (wivohgbuuwxoyfyzntsd)
- The migration uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times
- All tables start empty - data will be populated by ingestion tools

