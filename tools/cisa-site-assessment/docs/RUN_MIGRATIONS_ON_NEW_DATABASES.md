# Running Migrations on New Databases (psa_corpus and psa_runtime)

After creating `psa_corpus` and `psa_runtime` databases, you need to run all migrations on them.

## Step 1: Run CORPUS Migrations on `psa_corpus`

**Connect to CORPUS backend → `psa_corpus` database in Supabase SQL Editor**

Run these migrations in order:

1. **`db/migrations/20260116_create_source_registry.sql`**
   - Creates `source_registry` table
   - Required for CORPUS pool fingerprint validation

2. **`db/migrations/20260118_create_corpus_documents.sql`** (if exists)
   - Creates corpus document tables

3. **Any other CORPUS-specific migrations**

## Step 2: Run RUNTIME Migrations on `psa_runtime`

**Connect to RUNTIME backend → `psa_runtime` database in Supabase SQL Editor**

The RUNTIME database needs the base schema. Check if you have a base schema file, or run these migrations:

1. **Base schema** (if you have `tools/runtime_db_reset.sql` or similar):
   - This should create the `assessments` table and other core tables

2. **`db/migrations/20260116_add_source_key_to_citations.sql`**
   - Adds citation metadata columns
   - Required for RUNTIME pool fingerprint validation

3. **Other RUNTIME migrations** (in chronological order):
   - `migrations/20260112_add_qa_flag_to_assessments.sql`
   - `migrations/20260113_add_test_assessment_markers.sql`
   - `migrations/2026_01_14_assessment_question_responses.sql`
   - `migrations/2026_01_14_baseline_core_modules.sql`
   - `migrations/runtime/2026_01_14_facility_profile_and_assessment_metadata.sql`
   - `db/migrations/20260118_create_question_meaning.sql` (if RUNTIME-specific)

## Quick Check: What Tables Should Exist?

**CORPUS (`psa_corpus`):**
- `source_registry` ✓ (required for fingerprint check)
- `canonical_sources`
- `documents`
- `document_chunks`
- etc.

**RUNTIME (`psa_runtime`):**
- `assessments` ✓ (required - this is what's missing!)
- `ofc_library_citations` ✓ (required for fingerprint check)
- `assessment_instances`
- `assessment_responses`
- `assessment_definitions`
- `facilities`
- etc.

## Verification

After running migrations, verify:

```sql
-- On CORPUS backend, connected to psa_corpus:
SELECT current_database();  -- Should return: psa_corpus
SELECT to_regclass('public.source_registry');  -- Should return: source_registry

-- On RUNTIME backend, connected to psa_runtime:
SELECT current_database();  -- Should return: psa_runtime
SELECT to_regclass('public.assessments');  -- Should return: assessments
SELECT to_regclass('public.ofc_library_citations');  -- Should return: ofc_library_citations
```

Then restart your application and check:
```bash
curl http://localhost:3000/api/admin/diagnostics/pool-identity | jq
```

Expected:
- `corpus.db: "psa_corpus"`
- `runtime.db: "psa_runtime"`
- `corpus.source_registry.exists: true`
- `runtime.ofc_library_citations.exists: true`
- `runtime.assessments` table should exist (check manually if needed)
