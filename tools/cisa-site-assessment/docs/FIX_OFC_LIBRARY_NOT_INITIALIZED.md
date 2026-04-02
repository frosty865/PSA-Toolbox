# Fix: OFC Library Table or View Not Initialized

**Error:** `OFC library table or view not initialized (Request ID: ...)`

**Cause:** The `ofc_library` table and `v_eligible_ofc_library` view are missing in the RUNTIME database.

---

## Quick Fix

Run the initialization script in your **RUNTIME database**:

**File:** `scripts/initialize_ofc_library_runtime.sql`

### Steps

1. **Connect to your RUNTIME database** (Supabase SQL Editor or psql)
   - Database: `psa_runtime` (or your runtime database name)
   - Schema: `public`

2. **Run the initialization script:**
   ```sql
   -- Copy and paste entire contents of:
   -- scripts/initialize_ofc_library_runtime.sql
   ```

3. **Verify tables exist:**
   ```sql
   SELECT to_regclass('public.ofc_library');  -- Should return: ofc_library
   SELECT to_regclass('public.v_eligible_ofc_library');  -- Should return: v_eligible_ofc_library
   ```

---

## What This Creates

- `public.canonical_sources` - Bibliographic references
- `public.ofc_library` - Curated OFC entries
- `public.ofc_library_citations` - Links OFCs to sources
- `public.v_eligible_ofc_library` - View filtering to ACTIVE OFCs with >= 1 citation

---

## Alternative: Use Full Migration

If you prefer to use the original migration file:

**File:** `migrations/20260113_add_ofc_library_evidence_model.sql`

Run this in your RUNTIME database (same as above).

---

## Verification

After running the script, test the API:

```bash
curl http://localhost:3000/api/runtime/ofc-library
```

**Expected:** Should return `{"ok": true, "ofcs": []}` (empty array if no OFCs exist yet, but no error).

---

**Last Updated:** 2026-01-24
