# Running Source Registry Migration Manually

Since Node.js/Python may not be available in your current shell, here are manual options:

## Option 0: Using Python Script (with venv)

**Option 0a: Using wrapper script (recommended - auto-activates venv)**
```bash
# Windows
scripts\run_source_registry_migration.bat

# Unix/Mac
bash scripts/run_source_registry_migration.sh
```

**Option 0b: Manual venv activation**
```bash
# Windows
venv\Scripts\activate
python tools/run_source_registry_migration.py

# Unix/Mac
source venv/bin/activate
python tools/run_source_registry_migration.py
```

## Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase Dashboard
2. Navigate to your RUNTIME project
3. Go to **SQL Editor**
4. Open the file: `db/migrations/20260116_create_source_registry.sql`
5. Copy the entire contents
6. Paste into SQL Editor
7. Click **Run** (or press Ctrl+Enter)

## Option 2: psql Command Line

```bash
psql -h <your-host> -U <your-user> -d <your-database> -f db/migrations/20260116_create_source_registry.sql
```

## Option 3: Database GUI Tool

Use any PostgreSQL client (pgAdmin, DBeaver, DataGrip, etc.):

1. Connect to your RUNTIME database
2. Open the file: `db/migrations/20260116_create_source_registry.sql`
3. Execute the entire script

## Verification

After running the migration, verify it worked:

```sql
-- Check source_registry table exists
SELECT COUNT(*) FROM public.source_registry;

-- Check citation columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ofc_library_citations' 
  AND column_name IN ('source_key', 'locator_type', 'locator', 'retrieved_at');
```

Expected results:
- `source_registry` table should exist (count may be 0 if no sources added yet)
- All 4 citation columns should exist
