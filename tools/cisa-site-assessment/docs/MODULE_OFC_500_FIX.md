# MODULE OFC 500 Error Fix: discipline_subtypes Missing

## Problem

Creating MODULE OFCs fails with:
```
relation "public.discipline_subtypes" does not exist
```

This occurs because the API queries `public.discipline_subtypes` but the table/view doesn't exist in the CORPUS database.

## Solution

Two-part fix:

### A) Database Migration

**File:** `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`

This migration ensures `public.discipline_subtypes` exists by:
1. Checking if it already exists (if so, does nothing)
2. Looking for existing taxonomy tables/views to create a VIEW over
3. If no source found, creating a minimal TABLE (requires seeding)

**Apply Migrations:**

**Required Migrations (in order):**
1. `migrations/20260203_add_ofc_origin_to_ofc_candidate_queue.sql` - Adds `ofc_origin`, `discipline_id`, `discipline_subtype_id`, `title` columns
2. `migrations/20260203_add_ofc_class_to_ofc_candidate_queue.sql` - Adds `ofc_class` column
3. `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql` - Ensures `discipline_subtypes` table exists

**Option 1: Supabase SQL Editor (Recommended)**
1. Open Supabase Dashboard → CORPUS project
2. Navigate to SQL Editor
3. Run migrations in order (copy/paste each file and execute)

**Option 2: Python Script**
```bash
# From project root
python tools/corpus/run_migration.py migrations/20260123_ensure_taxonomy_discipline_subtypes.sql
```

**Option 3: psql**
```bash
psql $CORPUS_DATABASE_URL -f migrations/20260123_ensure_taxonomy_discipline_subtypes.sql
```

**Verify Migration:**
```sql
SELECT to_regclass('public.discipline_subtypes') as discipline_subtypes_exists;
-- Should return: public.discipline_subtypes
```

**If TABLE Created (not VIEW):**
- You must seed the table with taxonomy data
- Use: `npx tsx tools/restore_discipline_subtypes_corpus.ts` (CORPUS-specific)
- **Note:** `tools/restore_discipline_subtypes.ts` targets RUNTIME, not CORPUS
- The CORPUS script reads from `taxonomy/discipline_subtypes.json`

### B) Backend Error Handling

**Files Updated:**
- `app/api/admin/module-ofcs/create/route.ts`
- `app/api/admin/module-ofcs/update/[id]/route.ts`

**Changes:**
- Added preflight diagnostic query before accessing `discipline_subtypes`
- Returns actionable error with DB/schema/user info if table is missing
- Error format:
  ```json
  {
    "error": "Taxonomy missing: public.discipline_subtypes not found",
    "connected_as": {
      "db": "psa_corpus",
      "schema": "public",
      "db_user": "postgres"
    }
  }
  ```

## Verification

### 1. Check Migration Applied
```sql
-- In CORPUS database
SELECT 
  current_database() as db,
  current_schema() as schema,
  to_regclass('public.discipline_subtypes') as discipline_subtypes_exists;
```

**Expected:** `discipline_subtypes_exists` should NOT be NULL

### 2. Test API Endpoint

**Create MODULE OFC:**
```bash
curl -X POST http://localhost:3000/api/admin/module-ofcs/create \
  -H "Content-Type: application/json" \
  -d '{
    "ofc_text": "Test OFC",
    "discipline_subtype_id": "<valid-uuid>",
    "ofc_class": "FOUNDATIONAL"
  }'
```

**Expected:**
- If migration applied: ✅ Success (201 Created)
- If migration NOT applied: ❌ 500 error with diagnostic info

### 3. Check Error Message Quality

If `discipline_subtypes` is still missing, the error should now include:
- Database name
- Schema name  
- Database user

This helps identify connection issues (wrong database, wrong schema, etc.)

## Notes

- **Migration is idempotent:** Safe to run multiple times
- **VIEW vs TABLE:** Migration prefers creating a VIEW over existing tables. If it creates a TABLE, you must seed it.
- **Target Database:** CORPUS (not RUNTIME). The API uses `getCorpusPool()`.
- **Seeding:** If a TABLE is created, use `tools/restore_discipline_subtypes_corpus.ts` to populate it.

## Related Files

- Migration: `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`
- API Routes:
  - `app/api/admin/module-ofcs/create/route.ts`
  - `app/api/admin/module-ofcs/update/[id]/route.ts`
- Taxonomy Source: `taxonomy/discipline_subtypes.json`
- Restore Tool: `tools/restore_discipline_subtypes_corpus.ts`
