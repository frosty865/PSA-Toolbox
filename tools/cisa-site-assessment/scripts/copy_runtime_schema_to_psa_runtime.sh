#!/bin/bash
# Copy schema from postgres database to psa_runtime database
# Run this script to migrate the schema structure

set -e

# Get connection details from environment or prompt
RUNTIME_HOST="${RUNTIME_DB_HOST:-db.wivohgbuuwxoyfyzntsd.supabase.co}"
RUNTIME_PORT="${RUNTIME_DB_PORT:-5432}"
RUNTIME_USER="${RUNTIME_DB_USER:-postgres}"
RUNTIME_PASSWORD="${RUNTIME_DB_PASSWORD}"

if [ -z "$RUNTIME_PASSWORD" ]; then
  echo "Error: RUNTIME_DB_PASSWORD environment variable not set"
  echo "Usage: RUNTIME_DB_PASSWORD=your_password ./scripts/copy_runtime_schema_to_psa_runtime.sh"
  exit 1
fi

echo "Step 1: Exporting schema from postgres database..."
PGPASSWORD="$RUNTIME_PASSWORD" pg_dump \
  -h "$RUNTIME_HOST" \
  -p "$RUNTIME_PORT" \
  -U "$RUNTIME_USER" \
  -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  -f /tmp/runtime_schema_export.sql

echo "Step 2: Importing schema into psa_runtime database..."
PGPASSWORD="$RUNTIME_PASSWORD" psql \
  -h "$RUNTIME_HOST" \
  -p "$RUNTIME_PORT" \
  -U "$RUNTIME_USER" \
  -d psa_runtime \
  -f /tmp/runtime_schema_export.sql

echo "Step 3: Verifying tables exist..."
PGPASSWORD="$RUNTIME_PASSWORD" psql \
  -h "$RUNTIME_HOST" \
  -p "$RUNTIME_PORT" \
  -U "$RUNTIME_USER" \
  -d psa_runtime \
  -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

echo "✓ Schema copy complete!"
echo "Cleanup: rm /tmp/runtime_schema_export.sql"
