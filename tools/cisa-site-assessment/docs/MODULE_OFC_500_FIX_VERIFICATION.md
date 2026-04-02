# MODULE OFC 500 Fix - Verification Checklist

## ✅ Completed Changes

### 1. Database Migration
- ✅ Created: `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`
- ✅ Idempotent migration that ensures `public.discipline_subtypes` exists
- ✅ Prefers creating VIEW over existing tables
- ✅ Falls back to creating TABLE if no source found

### 2. API Route Updates
- ✅ `app/api/admin/module-ofcs/create/route.ts` - Added diagnostic preflight check
- ✅ `app/api/admin/module-ofcs/update/[id]/route.ts` - Added diagnostic preflight check

## 🔍 Other Routes Using discipline_subtypes

These routes also reference `discipline_subtypes` but use LEFT JOINs (safe - won't fail):

1. **`app/api/admin/module-ofcs/list/route.ts`**
   - Uses: `LEFT JOIN public.discipline_subtypes`
   - Database: CORPUS
   - Impact: Safe - will return NULL for subtype name if table missing
   - Action: No fix needed (graceful degradation)

2. **`app/api/admin/ofcs/review-queue/route.ts`**
   - Uses: `LEFT JOIN public.discipline_subtypes`
   - Database: RUNTIME (different database!)
   - Impact: Safe - will return NULL for subtype name if table missing
   - Action: No fix needed (different database, graceful degradation)

3. **`app/api/admin/modules/[moduleCode]/route.ts`**
   - Uses: `INNER JOIN public.discipline_subtypes`
   - Database: Need to verify (likely RUNTIME)
   - Impact: Could fail if table missing
   - Action: Verify which database, add check if CORPUS

4. **`app/api/runtime/assessments/[assessmentId]/technology-profiles/route.ts`**
   - Uses: `SELECT id FROM public.discipline_subtypes`
   - Database: RUNTIME (different database!)
   - Impact: Could fail if table missing in RUNTIME
   - Action: Separate issue - RUNTIME database needs its own migration

## 📋 Verification Steps

### Step 1: Apply Migration

**In CORPUS Database (Supabase SQL Editor):**
```sql
-- Copy and run: migrations/20260123_ensure_taxonomy_discipline_subtypes.sql
```

**Verify:**
```sql
SELECT to_regclass('public.discipline_subtypes') as exists;
-- Expected: public.discipline_subtypes (not NULL)
```

### Step 2: Seed Data (if TABLE was created, not VIEW)

**If migration created a TABLE:**
```bash
npx tsx tools/restore_discipline_subtypes_corpus.ts
```

**Verify:**
```sql
SELECT COUNT(*) FROM public.discipline_subtypes;
-- Expected: 104 rows (all subtypes)
```

### Step 3: Test MODULE OFC Creation

**Test via API:**
```bash
curl -X POST http://localhost:3000/api/admin/module-ofcs/create \
  -H "Content-Type: application/json" \
  -d '{
    "ofc_text": "Test OFC for verification",
    "discipline_subtype_id": "<valid-uuid-from-taxonomy>",
    "ofc_class": "FOUNDATIONAL",
    "title": "Test OFC"
  }'
```

**Expected Results:**

✅ **If migration applied:**
- Status: 201 Created
- Response includes OFC with UUID

❌ **If migration NOT applied:**
- Status: 500
- Error includes diagnostic info:
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

### Step 4: Test MODULE OFC Update

**Test via API:**
```bash
curl -X PATCH http://localhost:3000/api/admin/module-ofcs/update/<ofc-id> \
  -H "Content-Type: application/json" \
  -d '{
    "discipline_subtype_id": "<different-valid-uuid>"
  }'
```

**Expected:** Should work if migration applied, or return diagnostic error if not.

### Step 5: Test MODULE OFC List

**Test via API:**
```bash
curl http://localhost:3000/api/admin/module-ofcs/list
```

**Expected:** Should work even if `discipline_subtypes` is missing (LEFT JOIN returns NULL), but subtype names will be NULL.

## 🎯 Success Criteria

- [ ] Migration applied successfully
- [ ] `public.discipline_subtypes` exists (VIEW or TABLE)
- [ ] If TABLE, data seeded (104 rows)
- [ ] MODULE OFC creation works (201 Created)
- [ ] MODULE OFC update works (200 OK)
- [ ] Error messages include diagnostic info if table missing

## 📝 Notes

- **Migration is idempotent:** Safe to run multiple times
- **VIEW vs TABLE:** Migration prefers VIEW. If TABLE created, must seed.
- **Target Database:** CORPUS only (API uses `getCorpusPool()`)
- **RUNTIME Database:** Separate issue - needs its own migration if `discipline_subtypes` missing there

## 🔗 Related Files

- Migration: `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`
- API Routes:
  - `app/api/admin/module-ofcs/create/route.ts`
  - `app/api/admin/module-ofcs/update/[id]/route.ts`
- Documentation: `docs/MODULE_OFC_500_FIX.md`
- Taxonomy Source: `taxonomy/discipline_subtypes.json`
- Restore Tool: `tools/restore_discipline_subtypes_corpus.ts`
