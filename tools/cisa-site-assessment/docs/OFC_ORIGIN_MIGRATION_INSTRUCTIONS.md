# ofc_origin Migration Instructions

## Overview

This migration locks `ofc_origin` as a required, validated field in `public.ofc_candidate_queue` (CORPUS database).

**Migration File:** `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql`

## What This Migration Does

1. **Adds column** if missing: `ofc_origin TEXT`
2. **Backfills data**: Sets NULL/empty/unknown values to 'CORPUS'
3. **Adds CHECK constraint**: Only 'CORPUS' or 'MODULE' allowed
4. **Enforces NOT NULL**: Column cannot be NULL
5. **Creates indexes**: For efficient filtering by origin

## Prerequisites

- Access to CORPUS database (CORPUS_DATABASE_URL or SUPABASE_CORPUS_URL + password)
- psql command-line tool installed
- Database connection credentials configured

## Step 1: Run Migration

### Option A: Using CORPUS_DATABASE_URL environment variable

```bash
cd psa_rebuild
psql $CORPUS_DATABASE_URL -f db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql
```

### Option B: Using Supabase connection string

```bash
cd psa_rebuild
psql "postgresql://postgres:[PASSWORD]@db.yylslokiaovdythzrbgt.supabase.co:6543/postgres?sslmode=require" \
  -f db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql
```

### Option C: Using Python script (if Python is available)

```bash
cd psa_rebuild
python tools/verify_ofc_origin_migration.py
```

The script will check status and provide migration instructions if needed.

## Step 2: Verify Migration

### Option A: Run verification SQL

```bash
cd psa_rebuild
psql $CORPUS_DATABASE_URL -f db/migrations/20260124_0007_verify_ofc_origin.sql
```

### Option B: Manual verification queries

```sql
-- Check column exists and is NOT NULL
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ofc_candidate_queue'
  AND column_name = 'ofc_origin';

-- Check CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.ofc_candidate_queue'::regclass
  AND conname = 'chk_ofc_candidate_queue_ofc_origin';

-- Check data distribution (should only show CORPUS and MODULE)
SELECT ofc_origin, COUNT(*) as count
FROM public.ofc_candidate_queue
GROUP BY ofc_origin
ORDER BY ofc_origin;

-- Verify no NULL values (should return 0)
SELECT COUNT(*) as null_count
FROM public.ofc_candidate_queue
WHERE ofc_origin IS NULL;

-- Verify no invalid values (should return 0)
SELECT COUNT(*) as invalid_count
FROM public.ofc_candidate_queue
WHERE ofc_origin NOT IN ('CORPUS', 'MODULE');
```

## Expected Results

After successful migration:

1. ✅ Column `ofc_origin` exists with `is_nullable = 'NO'`
2. ✅ CHECK constraint `chk_ofc_candidate_queue_ofc_origin` exists
3. ✅ Data shows only 'CORPUS' and 'MODULE' values
4. ✅ No NULL values (count = 0)
5. ✅ No invalid values (count = 0)
6. ✅ Indexes created: `idx_ofc_candidate_queue_ofc_origin` and `idx_ofc_candidate_queue_ofc_origin_status`

## Troubleshooting

### Error: "column already exists"
- This is OK - the migration uses `ADD COLUMN IF NOT EXISTS`
- Continue with the rest of the migration

### Error: "constraint already exists"
- This is OK - the migration checks before adding
- Continue with the rest of the migration

### Error: "violates check constraint"
- This means there are invalid values in the data
- The migration should backfill them to 'CORPUS'
- Check the UPDATE statement in the migration

### Error: "cannot alter column because it contains NULL values"
- The migration should handle this with the UPDATE statement
- If it fails, manually run:
  ```sql
  UPDATE public.ofc_candidate_queue
  SET ofc_origin = 'CORPUS'
  WHERE ofc_origin IS NULL;
  ```
- Then re-run the migration

## Post-Migration Testing

1. **Test Module UI**: Navigate to Module Data Management page
   - Should show only MODULE candidates
   - No CORPUS candidates should appear

2. **Test Diagnostic Endpoint**: 
   ```bash
   curl http://localhost:3000/api/admin/diagnostics/candidates/source-type-counts
   ```
   - Should show counts for MODULE and CORPUS only
   - OTHER count should be 0

3. **Test Corpus Mining**: Run a mining script
   - New candidates should have `ofc_origin = 'CORPUS'`
   - Verify with: `SELECT ofc_origin, COUNT(*) FROM public.ofc_candidate_queue WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY ofc_origin;`

## Rollback (if needed)

If you need to rollback the migration:

```sql
BEGIN;

-- Remove NOT NULL constraint
ALTER TABLE public.ofc_candidate_queue
  ALTER COLUMN ofc_origin DROP NOT NULL;

-- Remove CHECK constraint
ALTER TABLE public.ofc_candidate_queue
  DROP CONSTRAINT IF EXISTS chk_ofc_candidate_queue_ofc_origin;

-- Remove indexes
DROP INDEX IF EXISTS idx_ofc_candidate_queue_ofc_origin;
DROP INDEX IF EXISTS idx_ofc_candidate_queue_ofc_origin_status;

-- Note: We keep the column and data, just remove constraints
-- To fully rollback, also run:
-- ALTER TABLE public.ofc_candidate_queue DROP COLUMN IF EXISTS ofc_origin;

COMMIT;
```

## Related Files

- Migration: `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql`
- Verification: `db/migrations/20260124_0007_verify_ofc_origin.sql`
- Python verifier: `tools/verify_ofc_origin_migration.py`
- Diagnostic endpoint: `app/api/admin/diagnostics/candidates/source-type-counts/route.ts`
