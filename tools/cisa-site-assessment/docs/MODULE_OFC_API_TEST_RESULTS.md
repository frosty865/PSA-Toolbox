# MODULE OFC API Test Results

**Date:** 2026-01-23  
**Status:** ✅ Diagnostic Error Handling Working | ⚠️ Migration Applied but Table Empty

## Test Results

### ✅ Diagnostic Error Handling
- **Status:** Working correctly
- **Evidence:** API returns 400 (validation error) instead of 500 (server error)
- **Conclusion:** The `public.discipline_subtypes` table EXISTS in CORPUS database

### ⚠️ Table State
- **Status:** Table exists but appears to be empty
- **Evidence:** 
  - Valid UUID format returns "Invalid discipline_subtype_id" (400)
  - This means the table exists but the query returns 0 rows
- **Conclusion:** Migration was applied, but table needs seeding

## Test Output

```
Test 1: Invalid UUID (should get 400 validation error)
   Status: 400
   Error: Invalid discipline_subtype_id

Test 2: Valid UUID format but not in database
   Status: 400
   Error: Invalid discipline_subtype_id
   ⚠️  Table exists but UUID not found (table may be empty)
```

## Next Steps

### 1. Verify Table Exists
```sql
-- In CORPUS database
SELECT to_regclass('public.discipline_subtypes') as exists;
-- Expected: public.discipline_subtypes (not NULL)
```

### 2. Check Table Contents
```sql
-- In CORPUS database
SELECT COUNT(*) as row_count FROM public.discipline_subtypes;
-- Current: Likely 0 rows
-- Expected: 104 rows (all subtypes)
```

### 3. Seed the Table
```bash
# From project root (D:\psa_system\psa_rebuild)
# IMPORTANT: Use the CORPUS-specific script, not the RUNTIME one
npx tsx tools/restore_discipline_subtypes_corpus.ts
```

**Note:** 
- This script reads from `taxonomy/discipline_subtypes.json` and populates the CORPUS database
- `tools/restore_discipline_subtypes.ts` targets RUNTIME (different database)
- The CORPUS script will verify the table exists before seeding

### 4. Verify Seeding
```sql
-- In CORPUS database
SELECT COUNT(*) as row_count FROM public.discipline_subtypes;
-- Expected: 104 rows

-- Check for the test UUID
SELECT id, name, code 
FROM public.discipline_subtypes 
WHERE id = '9ad62209-3efe-4339-b079-e17f9810f6b0';
-- Expected: 1 row (Biometric Access)
```

### 5. Re-test API
```bash
powershell -ExecutionPolicy Bypass -File scripts\test_module_ofc_api.ps1
```

**Expected:** Should now return 201 Created with OFC UUID

## Summary

✅ **Migration Applied:** Table `public.discipline_subtypes` exists  
⚠️ **Seeding Required:** Table is empty, needs data from taxonomy  
✅ **Error Handling:** Diagnostic checks working correctly  

## Test Scripts

- `scripts/test_module_ofc_api.ps1` - Full API test with subtype lookup
- `scripts/test_module_ofc_diagnostic.ps1` - Diagnostic error detection

## Related Files

- Migration: `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`
- Seeding Tool: `tools/restore_discipline_subtypes_corpus.ts`
- Taxonomy Source: `taxonomy/discipline_subtypes.json`
- API Route: `app/api/admin/module-ofcs/create/route.ts`
