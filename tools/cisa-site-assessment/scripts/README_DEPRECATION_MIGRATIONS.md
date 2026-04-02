# Deprecation Migration Scripts

## Quick Check

To check if migrations have been applied:

```bash
python scripts/check_deprecation_migrations.py
```

## Run Migrations

To automatically run migrations if needed:

```bash
python scripts/run_deprecation_migrations.py
```

## Manual SQL Execution

If you prefer to run SQL manually:

```bash
# Set database connection
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=your_database
export DB_USER=postgres
export DB_PASSWORD=your_password

# Run migrations in order
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/20250127_add_required_elements_deprecation.sql
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/20250127_deprecate_base_0xx_video_surveillance.sql
```

## Environment Variables

The scripts use these environment variables:

- `DB_HOST` (default: localhost)
- `DB_PORT` (default: 5432)
- `DB_NAME` (default: psa)
- `DB_USER` (default: postgres)
- `DB_PASSWORD` (default: empty)

## What Gets Applied

### Migration 1: `20250127_add_required_elements_deprecation.sql`
- Adds `status` column (VARCHAR(20), default 'active')
- Adds `deprecated_at` column (TIMESTAMP)
- Adds `deprecated_reason` column (TEXT)
- Creates indexes for efficient filtering

### Migration 2: `20250127_deprecate_base_0xx_video_surveillance.sql`
- Marks BASE-061 through BASE-071 as deprecated
- Sets `deprecated_at` timestamp
- Sets `deprecated_reason` text

## Verification

After running migrations, verify with:

```sql
-- Check columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'required_elements'
  AND column_name IN ('status', 'deprecated_at', 'deprecated_reason');

-- Check deprecated elements
SELECT element_code, status, deprecated_at, deprecated_reason
FROM required_elements
WHERE element_code IN ('BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071')
  AND discipline_name = 'Video Surveillance Systems';
```

---

**Last Updated**: 2025-01-27

