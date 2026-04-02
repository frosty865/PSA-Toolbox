# MODULE OFC Schema Requirements

**Date:** 2026-01-23  
**Purpose:** Document all schema requirements for MODULE OFC creation in CORPUS database

## Required Migrations

These migrations must be applied to the CORPUS database in order:

### 1. Add OFC Origin Column
**File:** `migrations/20260203_add_ofc_origin_to_ofc_candidate_queue.sql`

**Adds:**
- `ofc_origin` column (TEXT, NOT NULL, DEFAULT 'CORPUS')
- `discipline_id` column (UUID, nullable)
- `discipline_subtype_id` column (UUID, nullable)
- `title` column (TEXT, nullable)
- Constraints and indexes

**Apply:**
```sql
-- Copy and run entire file in CORPUS database
```

### 2. Add OFC Class Column
**File:** `migrations/20260203_add_ofc_class_to_ofc_candidate_queue.sql`

**Adds:**
- `ofc_class` column (TEXT, DEFAULT 'FOUNDATIONAL')
- Constraint: CHECK (ofc_class IN ('FOUNDATIONAL','OPERATIONAL','PHYSICAL'))
- Indexes

**Apply:**
```sql
-- Copy and run entire file in CORPUS database
```

### 3. Ensure Discipline Subtypes Table
**File:** `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`

**Creates:**
- `public.discipline_subtypes` table (if doesn't exist)
- Or VIEW over existing taxonomy table

**Apply:**
```sql
-- Copy and run entire file in CORPUS database
```

### 4. Seed Discipline Subtypes
**Script:** `tools/restore_discipline_subtypes_corpus.ts`

**Populates:**
- `public.discipline_subtypes` table with 104 subtypes from taxonomy

**Run:**
```bash
npx tsx tools/restore_discipline_subtypes_corpus.ts
```

## Verification

After applying all migrations and seeding:

```sql
-- In CORPUS database

-- 1. Check ofc_candidate_queue columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'ofc_candidate_queue'
  AND column_name IN ('ofc_origin', 'discipline_id', 'discipline_subtype_id', 'title', 'ofc_class')
ORDER BY column_name;

-- Expected: All 5 columns should exist

-- 2. Check discipline_subtypes table
SELECT COUNT(*) as subtype_count FROM public.discipline_subtypes;
-- Expected: 104 rows

-- 3. Check table exists
SELECT to_regclass('public.discipline_subtypes') as exists;
-- Expected: public.discipline_subtypes
```

## Current Status

Based on API test:
- ✅ `discipline_subtypes` table exists (diagnostic check passes)
- ⚠️ `discipline_subtypes` table may be empty (needs seeding)
- ❌ `ofc_origin` column missing (migration not applied)
- ❌ `ofc_class` column may be missing (migration not applied)

## Quick Fix

Apply missing migrations:

```bash
# 1. Apply migrations via Supabase SQL Editor (CORPUS project)
#    - migrations/20260203_add_ofc_origin_to_ofc_candidate_queue.sql
#    - migrations/20260203_add_ofc_class_to_ofc_candidate_queue.sql
#    - migrations/20260123_ensure_taxonomy_discipline_subtypes.sql

# 2. Seed discipline_subtypes
npx tsx tools/restore_discipline_subtypes_corpus.ts

# 3. Re-test API
powershell -ExecutionPolicy Bypass -File scripts\test_module_ofc_api.ps1
```

## Related Files

- Migration: `migrations/20260203_add_ofc_origin_to_ofc_candidate_queue.sql`
- Migration: `migrations/20260203_add_ofc_class_to_ofc_candidate_queue.sql`
- Migration: `migrations/20260123_ensure_taxonomy_discipline_subtypes.sql`
- Seeding Script: `tools/restore_discipline_subtypes_corpus.ts`
- API Route: `app/api/admin/module-ofcs/create/route.ts`
