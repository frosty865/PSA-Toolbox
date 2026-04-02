# Restore Discipline Subtypes Table

## Overview

This guide explains how to restore the `discipline_subtypes` table from the archived taxonomy data.

## Prerequisites

- Database connection configured (SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD)
- Archive file exists: `taxonomy/discipline_subtypes.json`
- Node.js and TypeScript available

## Quick Start

### Option 1: Automated Script (Recommended)

```bash
npx tsx tools/restore_discipline_subtypes.ts
```

This script will:
1. Load data from `taxonomy/discipline_subtypes.json`
2. Create the table if it doesn't exist
3. Import all 104 discipline subtypes
4. Use UPSERT to handle existing records
5. Verify the restoration

### Option 2: Manual SQL Migration

1. Run the migration to create the table:
   ```sql
   -- Execute: db/migrations/20260116_restore_discipline_subtypes.sql
   ```

2. Then run the TypeScript script to import data:
   ```bash
   npx tsx tools/restore_discipline_subtypes.ts
   ```

## Archive File

**Location:** `taxonomy/discipline_subtypes.json`

**Contents:**
- 104 discipline subtypes
- Includes: id, name, subtype_code, discipline_id, is_active, etc.
- Authority: `psa_engine`
- Version: 1.0
- Generated: 2025-12-21

## Table Schema

The `discipline_subtypes` table includes:

**Required Fields:**
- `id` (uuid, PRIMARY KEY)
- `discipline_id` (uuid, FOREIGN KEY to disciplines)
- `name` (text, NOT NULL)

**Optional Fields:**
- `code` (text) - Maps from `subtype_code` in JSON
- `description` (text)
- `is_active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)
- `overview` (text)
- `indicators_of_risk` (text[])
- `common_failures` (text[])
- `assessment_questions` (text[])
- `mitigation_guidance` (text[])
- `standards_references` (text[])
- `psa_notes` (text)

## Verification

After restoration, verify:

```sql
-- Check total count
SELECT COUNT(*) FROM discipline_subtypes;
-- Expected: 104

-- Check active count
SELECT COUNT(*) FROM discipline_subtypes WHERE is_active = true;

-- Check codes
SELECT COUNT(*) FROM discipline_subtypes WHERE code IS NOT NULL;

-- Sample records
SELECT id, name, code, discipline_id, is_active
FROM discipline_subtypes
ORDER BY code
LIMIT 10;
```

## Troubleshooting

### Error: "discipline_id not found"
- Some subtypes reference discipline IDs that don't exist
- These will be skipped with a warning
- Verify disciplines table has all required records

### Error: "Table already exists"
- The script uses `CREATE TABLE IF NOT EXISTS`
- Existing data will be updated via UPSERT
- No data loss should occur

### Error: "Connection failed"
- Check SUPABASE_RUNTIME_URL and SUPABASE_RUNTIME_DB_PASSWORD
- Verify database is accessible
- See `tools/RUNTIME_DB_RUNBOOK.md` for troubleshooting

## Related Files

- **Archive:** `taxonomy/discipline_subtypes.json`
- **Migration:** `db/migrations/20260116_restore_discipline_subtypes.sql`
- **Script:** `tools/restore_discipline_subtypes.ts`
- **Schema Probe:** `analytics/reports/runtime_schema_probe.json`

## Notes

- The script uses UPSERT (ON CONFLICT DO UPDATE) to handle existing records
- `subtype_code` from JSON maps to `code` column in database
- All 104 subtypes should be restored
- Foreign key constraint ensures discipline_id exists in disciplines table
