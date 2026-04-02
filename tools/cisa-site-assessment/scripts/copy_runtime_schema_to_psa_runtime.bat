@echo off
REM Copy schema from postgres database to psa_runtime database
REM Run this script to migrate the schema structure

setlocal enabledelayedexpansion

REM Get connection details from environment or prompt
set RUNTIME_HOST=%RUNTIME_DB_HOST%
if "%RUNTIME_HOST%"=="" set RUNTIME_HOST=db.wivohgbuuwxoyfyzntsd.supabase.co

set RUNTIME_PORT=%RUNTIME_DB_PORT%
if "%RUNTIME_PORT%"=="" set RUNTIME_PORT=5432

set RUNTIME_USER=%RUNTIME_DB_USER%
if "%RUNTIME_USER%"=="" set RUNTIME_USER=postgres

set RUNTIME_PASSWORD=%RUNTIME_DB_PASSWORD%
if "%RUNTIME_PASSWORD%"=="" (
  echo Error: RUNTIME_DB_PASSWORD environment variable not set
  echo Usage: set RUNTIME_DB_PASSWORD=your_password ^&^& scripts\copy_runtime_schema_to_psa_runtime.bat
  exit /b 1
)

set TEMP_FILE=%TEMP%\runtime_schema_export.sql

echo Step 1: Exporting schema from postgres database...
set PGPASSWORD=%RUNTIME_PASSWORD%
pg_dump -h %RUNTIME_HOST% -p %RUNTIME_PORT% -U %RUNTIME_USER% -d postgres --schema-only --no-owner --no-privileges --no-tablespaces -f %TEMP_FILE%

if errorlevel 1 (
  echo Error: Failed to export schema
  exit /b 1
)

echo Step 2: Importing schema into psa_runtime database...
psql -h %RUNTIME_HOST% -p %RUNTIME_PORT% -U %RUNTIME_USER% -d psa_runtime -f %TEMP_FILE%

if errorlevel 1 (
  echo Error: Failed to import schema
  exit /b 1
)

echo Step 3: Verifying tables exist...
psql -h %RUNTIME_HOST% -p %RUNTIME_PORT% -U %RUNTIME_USER% -d psa_runtime -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

echo.
echo Schema copy complete!
echo Cleanup: del %TEMP_FILE%

endlocal
