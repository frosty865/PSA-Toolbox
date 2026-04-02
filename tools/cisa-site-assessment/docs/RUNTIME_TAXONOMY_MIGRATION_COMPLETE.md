# Runtime Taxonomy Migration - Complete

## Status: ✅ Subtypes Seeded | ⚠️ Migration Needs Manual Run

## What Was Done

### 1. Migration File Created
**File:** `migrations/20260123_0001_runtime_taxonomy_tables.sql`

- Creates `public.disciplines` table (if missing)
- Creates `public.discipline_subtypes` table (if missing)
- Seeds 14 disciplines with canonical UUIDs
- Includes indexes and foreign key constraints
- Safe to re-run (uses `ON CONFLICT DO NOTHING`)

### 2. Fail-Fast Guard Added
**File:** `app/api/admin/ofcs/candidates/[candidate_id]/route.ts`

- Checks RUNTIME database for `public.discipline_subtypes` before promotion
- Returns clear 400 error (not 500) if tables are missing
- Logs database identity for debugging

### 3. Subtypes Seeded
**Script:** `tools/restore_discipline_subtypes.ts`

- ✅ Successfully ran and seeded 105 discipline subtypes
- ✅ Verified: All 105 subtypes active and have codes
- ✅ Table structure includes extended guidance fields

## Next Step: Run Migration Manually

The migration file needs to be run against the RUNTIME database to ensure disciplines are seeded.

### Option 1: Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select the **RUNTIME** project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy entire contents of: `migrations/20260123_0001_runtime_taxonomy_tables.sql`
6. Paste into SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify success: Should see "Success. No rows returned"

### Option 2: psql Command Line

```bash
psql $RUNTIME_DATABASE_URL -f migrations/20260123_0001_runtime_taxonomy_tables.sql
```

## Verification

After running the migration, verify with:

```sql
-- Check disciplines
SELECT COUNT(*) AS disciplines FROM public.disciplines;
-- Expected: 14

-- Check discipline_subtypes
SELECT COUNT(*) AS discipline_subtypes FROM public.discipline_subtypes;
-- Expected: 105

-- Verify sample data
SELECT d.code, d.name, COUNT(ds.id) as subtype_count
FROM public.disciplines d
LEFT JOIN public.discipline_subtypes ds ON d.id = ds.discipline_id
GROUP BY d.code, d.name
ORDER BY d.code;
-- Expected: 14 disciplines, each with multiple subtypes
```

## Testing

After migration is complete:

1. **Test Promotion Endpoint:**
   - Navigate to `/admin/module-data`
   - Try promoting an OFC from PENDING → PROMOTED
   - Should either:
     - ✅ Succeed (if taxonomy tables exist)
     - ✅ Return clear 400 error with actionable message (if tables missing)

2. **Expected Behavior:**
   - No more "relation public.discipline_subtypes does not exist" errors
   - Clear error messages if something is misconfigured
   - Database identity logged for debugging

## Files Modified

1. `migrations/20260123_0001_runtime_taxonomy_tables.sql` - Migration file
2. `app/api/admin/ofcs/candidates/[candidate_id]/route.ts` - Added fail-fast guard
3. `tools/generate_runtime_taxonomy_seed.ts` - Helper script for generating seed SQL

## Notes

- The migration seeds disciplines but not subtypes (subtypes are seeded via TypeScript tool)
- The fail-fast guard checks RUNTIME database, not CORPUS
- All UUIDs match canonical taxonomy from `taxonomy/discipline_subtypes.json`
- Migration is idempotent (safe to run multiple times)
