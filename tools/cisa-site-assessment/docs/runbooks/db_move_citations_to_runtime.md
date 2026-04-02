# Database Migration: Move Citations and Sources to RUNTIME

## Overview

This runbook documents the process for moving `canonical_sources` and `ofc_library_citations` from CORPUS to RUNTIME database to support foreign key constraints and runtime queries.

## Background

- **Problem**: Tables exist in CORPUS but need FK constraints to `ofc_library` (which is in RUNTIME)
- **Solution**: Move tables to RUNTIME, preserve data, deprecate CORPUS copies
- **Impact**: Runtime OFC library routes require these tables in RUNTIME

## Prerequisites

- Access to both CORPUS and RUNTIME databases
- Environment variables configured:
  - `CORPUS_DATABASE_URL`
  - `RUNTIME_DATABASE_URL`
- Node.js/TypeScript tooling available (`npx tsx`)

## Migration Steps

### Step 1: Verify Current State

Run the ownership verifier to confirm the mismatch:

```bash
npx tsx tools/db/verify_db_ownership.ts
```

Expected output: Errors showing `canonical_sources` and `ofc_library_citations` are in CORPUS but expected in RUNTIME.

### Step 2: Run RUNTIME Migration (Create Tables)

Create the tables in RUNTIME database:

```bash
npx tsx tools/run_sql.ts db/migrations/runtime/20260124_0011_move_citations_and_sources_to_runtime.sql
```

**OR** execute directly against RUNTIME database using Supabase SQL Editor or psql.

**Expected result**: Tables `canonical_sources` and `ofc_library_citations` created in RUNTIME (empty initially).

### Step 3: Copy Data (Dry Run First)

Test the copy operation without modifying data:

```bash
npx tsx tools/db/move_tables_corpus_to_runtime.ts --dry-run
```

Review the output:
- CORPUS row counts
- Expected RUNTIME counts after copy
- Any errors or warnings

### Step 4: Copy Data (Live)

If dry-run looks good, run the actual copy:

```bash
npx tsx tools/db/move_tables_corpus_to_runtime.ts
```

**Expected result**:
- All rows copied from CORPUS to RUNTIME
- Row counts match (accounting for duplicates)
- No fatal errors

**Note**: The tool uses `ON CONFLICT DO NOTHING` for primary key conflicts, so duplicate keys won't cause failures.

### Step 5: Verify Data Copy

Check row counts manually:

```sql
-- In CORPUS database
SELECT COUNT(*) FROM public.canonical_sources;
SELECT COUNT(*) FROM public.ofc_library_citations;

-- In RUNTIME database
SELECT COUNT(*) FROM public.canonical_sources;
SELECT COUNT(*) FROM public.ofc_library_citations;
```

RUNTIME counts should equal or exceed CORPUS counts (if there were duplicates).

### Step 6: Deprecate CORPUS Tables

Rename CORPUS tables to prevent future use:

```bash
npx tsx tools/run_sql.ts db/migrations/corpus/20260124_0011_deprecate_runtime_owned_tables_in_corpus.sql
```

**OR** execute directly against CORPUS database.

**Expected result**: Tables renamed to `*_deprecated` in CORPUS.

### Step 7: Verify Ownership

Run the verifier again to confirm everything is correct:

```bash
npx tsx tools/db/verify_db_ownership.ts
```

**Expected result**: All checks pass. Deprecated tables in CORPUS are ignored.

### Step 8: Test Runtime Route

Restart the dev server and test the OFC library endpoint:

```bash
npm run dev
```

Then test:

```bash
curl http://localhost:3000/api/runtime/ofc-library?status=ACTIVE
```

**Expected result**: HTTP 200 with JSON response containing OFCs.

## Rollback Procedure

If something goes wrong:

1. **If RUNTIME migration failed**: Drop the tables in RUNTIME:
   ```sql
   -- In RUNTIME database
   DROP TABLE IF EXISTS public.ofc_library_citations CASCADE;
   DROP TABLE IF EXISTS public.canonical_sources CASCADE;
   ```

2. **If data copy failed**: The CORPUS tables are still intact (not renamed yet). Re-run copy tool.

3. **If deprecation was premature**: Rename back in CORPUS:
   ```sql
   -- In CORPUS database
   ALTER TABLE public.canonical_sources_deprecated RENAME TO canonical_sources;
   ALTER TABLE public.ofc_library_citations_deprecated RENAME TO ofc_library_citations;
   ```

## Verification Checklist

- [ ] RUNTIME migration executed successfully
- [ ] Data copied (dry-run reviewed, then live copy completed)
- [ ] Row counts verified (RUNTIME >= CORPUS)
- [ ] CORPUS tables deprecated (renamed to `*_deprecated`)
- [ ] Ownership verifier passes
- [ ] Runtime route returns 200
- [ ] View `v_eligible_ofc_library` exists and works

## Troubleshooting

### Error: "Table already exists"

If tables already exist in RUNTIME, the migration uses `CREATE TABLE IF NOT EXISTS`, so this is safe. Check if data was already copied.

### Error: "Foreign key constraint violation"

Ensure `ofc_library` table exists in RUNTIME before creating `ofc_library_citations`. The migration should handle this, but verify:

```sql
-- In RUNTIME database
SELECT to_regclass('public.ofc_library');
```

### Error: "Duplicate key violation"

The copy tool uses `ON CONFLICT DO NOTHING`, so duplicates are skipped. Check if data was partially copied before.

### Route returns 500 "RUNTIME_SCHEMA_MISSING"

Verify tables exist in RUNTIME:

```sql
-- In RUNTIME database
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('canonical_sources', 'ofc_library_citations', 'ofc_library');
```

All three should exist.

## Post-Migration

After successful migration:

1. Update any code that references CORPUS `canonical_sources` or `ofc_library_citations` to use RUNTIME
2. Monitor for any errors related to missing tables
3. Consider dropping deprecated CORPUS tables after a grace period (e.g., 30 days)

## Related Files

- Migration: `db/migrations/runtime/20260124_0011_move_citations_and_sources_to_runtime.sql`
- Deprecation: `db/migrations/corpus/20260124_0011_deprecate_runtime_owned_tables_in_corpus.sql`
- Copy tool: `tools/db/move_tables_corpus_to_runtime.ts`
- Verifier: `tools/db/verify_db_ownership.ts`
- Route: `app/api/runtime/ofc-library/route.ts`
