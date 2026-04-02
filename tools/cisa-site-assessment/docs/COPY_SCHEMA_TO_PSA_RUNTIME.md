# Copy Schema to psa_runtime Database

After creating the `psa_runtime` database, you need to copy the schema structure from your existing `postgres` database.

## Quick Start

### Windows (PowerShell)

```powershell
# Set your database password
$env:RUNTIME_DB_PASSWORD = "your_password_here"

# Run the script
.\scripts\copy_runtime_schema_to_psa_runtime.ps1
```

### Windows (CMD)

```cmd
set RUNTIME_DB_PASSWORD=your_password_here
scripts\copy_runtime_schema_to_psa_runtime.bat
```

### Linux/Mac

```bash
export RUNTIME_DB_PASSWORD=your_password_here
bash scripts/copy_runtime_schema_to_psa_runtime.sh
```

## Manual Method (Supabase SQL Editor)

If you don't have `pg_dump`/`psql` installed, use Supabase SQL Editor:

### Step 1: Export Schema from `postgres` database

1. Connect to your RUNTIME project in Supabase Dashboard
2. Go to SQL Editor
3. Connect to the `postgres` database
4. Run this to get table creation statements:

```sql
-- Get all table creation statements
SELECT 
  'CREATE TABLE IF NOT EXISTS ' || schemaname || '.' || tablename || ' (' || 
  string_agg(
    column_name || ' ' || data_type || 
    CASE 
      WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
      ELSE ''
    END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**OR** use pgAdmin/DBeaver/DataGrip to export schema:
- Right-click on `postgres` database → Export → Schema only
- Save the SQL file

### Step 2: Import into `psa_runtime`

1. In Supabase SQL Editor, switch to `psa_runtime` database (use the database selector)
2. Paste and run the exported schema SQL
3. Verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Should show tables like:
- `assessments`
- `ofc_library_citations`
- `assessment_instances`
- `assessment_responses`
- `assessment_definitions`
- `facilities`
- etc.

## After Schema Copy

1. Run any pending migrations on `psa_runtime`:
   - `db/migrations/20260116_add_source_key_to_citations.sql`
   - Any other RUNTIME migrations

2. Verify with diagnostics:
   ```bash
   curl http://localhost:3000/api/admin/diagnostics/pool-identity | jq
   ```

3. Restart your application - the 500 errors should be resolved!
