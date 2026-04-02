# Copy schema from postgres database to psa_runtime database
# Run this script to migrate the schema structure

$ErrorActionPreference = "Stop"

# Get connection details from environment
$RUNTIME_HOST = if ($env:RUNTIME_DB_HOST) { $env:RUNTIME_DB_HOST } else { "db.wivohgbuuwxoyfyzntsd.supabase.co" }
$RUNTIME_PORT = if ($env:RUNTIME_DB_PORT) { $env:RUNTIME_DB_PORT } else { "5432" }
$RUNTIME_USER = if ($env:RUNTIME_DB_USER) { $env:RUNTIME_DB_USER } else { "postgres" }
$RUNTIME_PASSWORD = $env:RUNTIME_DB_PASSWORD

if (-not $RUNTIME_PASSWORD) {
    Write-Host "Error: RUNTIME_DB_PASSWORD environment variable not set" -ForegroundColor Red
    Write-Host "Usage: `$env:RUNTIME_DB_PASSWORD='your_password'; .\scripts\copy_runtime_schema_to_psa_runtime.ps1"
    exit 1
}

$TEMP_FILE = Join-Path $env:TEMP "runtime_schema_export.sql"

Write-Host "Step 1: Exporting schema from postgres database..." -ForegroundColor Cyan
$env:PGPASSWORD = $RUNTIME_PASSWORD
pg_dump -h $RUNTIME_HOST -p $RUNTIME_PORT -U $RUNTIME_USER -d postgres --schema-only --no-owner --no-privileges --no-tablespaces -f $TEMP_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to export schema" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Importing schema into psa_runtime database..." -ForegroundColor Cyan
psql -h $RUNTIME_HOST -p $RUNTIME_PORT -U $RUNTIME_USER -d psa_runtime -f $TEMP_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to import schema" -ForegroundColor Red
    exit 1
}

Write-Host "Step 3: Verifying tables exist..." -ForegroundColor Cyan
psql -h $RUNTIME_HOST -p $RUNTIME_PORT -U $RUNTIME_USER -d psa_runtime -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

Write-Host ""
Write-Host "✓ Schema copy complete!" -ForegroundColor Green
Write-Host "Cleanup: Remove-Item $TEMP_FILE"
