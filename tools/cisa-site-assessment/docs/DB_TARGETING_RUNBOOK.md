# Database Targeting Runbook

## Overview

This application requires **two separate database connections**:
- **CORPUS**: Contains `source_registry`, `canonical_sources`, documents, etc.
- **RUNTIME**: Contains `ofc_library_citations`, assessments, nominations, etc.

These databases **must** be distinct backend instances (different Supabase projects in production, or different databases/schemas in development).

### Backend Fingerprints (Hard Requirements)

The application enforces **hard fingerprint gates** to prevent miswiring:

- **CORPUS backend**: Must have `system_identifier = 7572288122664293568`
- **RUNTIME backend**: Must have `system_identifier = 7554257690872145980`

**If a pool connects to the wrong backend, the application will fail to start with a clear error message.**

**Note**: In managed PostgreSQL environments (e.g., Supabase), `pg_control_system()` may not be accessible. In that case, the fingerprint check will be skipped and the application will rely on table existence checks only. This is acceptable but less secure.

## Required Environment Variables

### Production (Supabase)

```bash
# CORPUS database connection string
# Preferred: Use psa_corpus database name (if database creation is permitted)
CORPUS_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[CORPUS_PROJECT_REF].supabase.co:6543/psa_corpus
# Fallback: Use postgres database name (if database creation is not permitted)
# CORPUS_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[CORPUS_PROJECT_REF].supabase.co:6543/postgres

# RUNTIME database connection string
# Preferred: Use psa_runtime database name (if database creation is permitted)
RUNTIME_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[RUNTIME_PROJECT_REF].supabase.co:6543/psa_runtime
# Fallback: Use postgres database name (if database creation is not permitted)
# RUNTIME_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[RUNTIME_PROJECT_REF].supabase.co:6543/postgres
```

**Important**: 
- Replace `[PASSWORD]` with the database password (not the service role key)
- Replace `[CORPUS_PROJECT_REF]` with your CORPUS Supabase project reference
- Replace `[RUNTIME_PROJECT_REF]` with your RUNTIME Supabase project reference
- Get these from: Supabase Dashboard > Project Settings > Database > Connection String
- **Database name collision**: If both databases are named `postgres`, that's OK. The `system_identifier` fingerprint will differ, proving they're different backends.
- **Managed database limitation**: If database creation is not permitted (managed PostgreSQL), use the existing database name (`postgres`) and ensure the fingerprint gates pass.

### Development (Local PostgreSQL)

```bash
# CORPUS database (recommended: rename from 'postgres' to 'psa_corpus')
CORPUS_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_corpus

# RUNTIME database (recommended: rename from 'postgres' to 'psa_runtime')
RUNTIME_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_runtime
```

**Important**:
- Use **consistent localhost form**: Prefer `127.0.0.1` over `::1` or `localhost` to avoid split-brain issues
- In Docker containers, use explicit service names instead of localhost (e.g., `postgres-corpus:5432`)

## Verification

### Step 1: Check Environment Variables

```bash
# Verify both are set
echo $CORPUS_DATABASE_URL
echo $RUNTIME_DATABASE_URL
```

### Step 2: Call Diagnostics Endpoint

```bash
curl http://localhost:3000/api/admin/diagnostics/pool-identity | jq
```

### Step 3: Verify Output

The diagnostics endpoint returns:

```json
{
  "corpus": {
    "db": "psa_corpus",
    "usr": "postgres",
    "server_ip": "127.0.0.1",
    "server_port": 5432,
    "system_identifier": "7572288122664293568",
    "fingerprint": {
      "expected": "7572288122664293568",
      "actual": "7572288122664293568",
      "status": "match",
      "match": true
    },
    "source_registry": { "exists": true, ... },
    "ofc_library_citations": { "exists": false, ... }
  },
  "runtime": {
    "db": "psa_runtime",
    "usr": "postgres",
    "server_ip": "127.0.0.1",
    "server_port": 5432,
    "system_identifier": "7554257690872145980",
    "fingerprint": {
      "expected": "7554257690872145980",
      "actual": "7554257690872145980",
      "status": "match",
      "match": true
    },
    "source_registry": { "exists": false, ... },
    "ofc_library_citations": { "exists": true, ... }
  },
  "analysis": {
    "same_backend": false,
    "are_distinct": true
  }
}
```

### Expected Results

✅ **PASS**: 
- `same_backend: false` (different `system_identifier` or different `server_ip`/`port`/`data_directory`)
- CORPUS has `fingerprint.match: true` (or `fingerprint.status: "unavailable"` if managed)
- RUNTIME has `fingerprint.match: true` (or `fingerprint.status: "unavailable"` if managed)
- CORPUS has `source_registry.exists: true`, `ofc_library_citations.exists: false`
- RUNTIME has `source_registry.exists: false`, `ofc_library_citations.exists: true`

❌ **FAIL** (500 error or startup failure):
- `same_backend: true` but table existence differs
- Error: "Inconsistent existence results in same backend; check schema/connection wiring."
- **Startup failure**: "CORPUS pool miswired: expected backend system_identifier 7572288122664293568, but got ..."
- **Startup failure**: "RUNTIME pool miswired: expected backend system_identifier 7554257690872145980, but got ..."

## Troubleshooting

### Error: "CORPUS_DATABASE_URL must be set"

**Solution**: Set the `CORPUS_DATABASE_URL` environment variable with a full PostgreSQL connection string.

### Error: "Split-brain risk: CORPUS and RUNTIME URLs use different localhost forms"

**Solution**: Use consistent localhost form:
- Both use `127.0.0.1` (preferred)
- Both use `::1` 
- Both use explicit hostnames (for containers)

**Do NOT mix**: `127.0.0.1` and `::1` in the same setup.

### Error: "Inconsistent existence results in same backend"

**Cause**: Both pools are connecting to the same PostgreSQL instance, but seeing different tables.

**Solutions**:
1. **Different databases**: Ensure `CORPUS_DATABASE_URL` and `RUNTIME_DATABASE_URL` point to different database names
2. **Different instances**: Use different Supabase projects (production) or different PostgreSQL instances (dev)
3. **Schema separation**: If using same instance, ensure proper schema separation (not recommended)

### Error: "CORPUS pool miswired: expected backend system_identifier 7572288122664293568, but got ..."

**Cause**: The CORPUS pool is connected to the wrong backend (wrong Supabase project or wrong PostgreSQL instance).

**Solution**: 
- Verify `CORPUS_DATABASE_URL` points to the CORPUS backend (project ref: `yylslokiaovdythzrbgt` for Supabase)
- Check that the connection string uses the correct hostname
- If using local development, ensure you're connecting to the correct PostgreSQL instance

### Error: "RUNTIME pool miswired: expected backend system_identifier 7554257690872145980, but got ..."

**Cause**: The RUNTIME pool is connected to the wrong backend (wrong Supabase project or wrong PostgreSQL instance).

**Solution**: 
- Verify `RUNTIME_DATABASE_URL` points to the RUNTIME backend (project ref: `wivohgbuuwxoyfyzntsd` for Supabase)
- Check that the connection string uses the correct hostname
- If using local development, ensure you're connecting to the correct PostgreSQL instance

### Same Database Names in Different Projects

If both databases are named `postgres` (common in Supabase), that's OK. The `system_identifier` fingerprint will differ, proving they're different instances. The application will verify this at startup and fail fast if miswired.

### Local Development Setup

1. **Create two databases** (if permitted):
   
   **Option A: Using SQL scripts (recommended - includes fingerprint verification)**
   ```bash
   # On CORPUS backend (system_identifier: 7572288122664293568)
   psql -h <CORPUS_HOST> -U postgres -f db/migrations/20260119_create_psa_corpus_database.sql
   
   # On RUNTIME backend (system_identifier: 7554257690872145980)
   psql -h <RUNTIME_HOST> -U postgres -f db/migrations/20260119_create_psa_runtime_database.sql
   ```
   
   **Option B: Manual creation (if scripts fail or database creation not permitted)**
   ```sql
   -- Connect to CORPUS backend first, verify fingerprint:
   SELECT (SELECT system_identifier FROM pg_control_system())::text;
   -- Should return: 7572288122664293568
   
   CREATE DATABASE psa_corpus;
   
   -- Connect to RUNTIME backend, verify fingerprint:
   SELECT (SELECT system_identifier FROM pg_control_system())::text;
   -- Should return: 7554257690872145980
   
   CREATE DATABASE psa_runtime;
   ```
   
   **Note**: If database creation is not permitted (managed PostgreSQL), skip this step and use the existing database name (`postgres`). The fingerprint gates will still work.

2. **Run migrations**:
   - CORPUS: `db/migrations/20260116_create_source_registry.sql` → `psa_corpus` (or `postgres` if creation not permitted)
   - RUNTIME: `db/migrations/20260116_add_source_key_to_citations.sql` → `psa_runtime` (or `postgres` if creation not permitted)

3. **Set environment variables**:
   ```bash
   # Preferred: Use distinct database names
   CORPUS_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_corpus
   RUNTIME_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/psa_runtime
   
   # Fallback: Use postgres if database creation not permitted
   # CORPUS_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres
   # RUNTIME_DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/postgres
   ```

4. **Verify with diagnostics endpoint** (should return 200, not 500):
   ```bash
   curl http://localhost:3000/api/admin/diagnostics/pool-identity | jq
   ```
   
   Expected:
   - `corpus.fingerprint.match: true` (or `status: "unavailable"` if managed)
   - `runtime.fingerprint.match: true` (or `status: "unavailable"` if managed)
   - `corpus.source_registry.exists: true`
   - `runtime.ofc_library_citations.exists: true`

## CLI Tool

You can also use the CLI tool:

```bash
npx tsx tools/db/pool_identity_check.ts
```

This prints detailed fingerprint information for both pools, including:
- Database name
- Server IP/port
- System identifier (if available)
- **Fingerprint validation** (expected vs actual)
- Postmaster start time
- Data directory
- Table existence and privileges

**Fingerprint validation**:
- ✅ `match: true` - Pool is connected to the correct backend
- ❌ `match: false` - Pool is miswired (wrong backend)
- ⚠️ `status: "unavailable"` - Fingerprint check unavailable (managed PostgreSQL), relying on table checks

## Migration from Old Config

If you were using `SUPABASE_CORPUS_URL` + `SUPABASE_CORPUS_DB_PASSWORD`:

1. Construct full connection string:
   ```bash
   # Extract project ref from SUPABASE_CORPUS_URL
   # Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres
   CORPUS_DATABASE_URL=postgresql://postgres:${SUPABASE_CORPUS_DB_PASSWORD}@db.[PROJECT_REF].supabase.co:6543/postgres
   ```

2. Do the same for RUNTIME:
   ```bash
   RUNTIME_DATABASE_URL=postgresql://postgres:${SUPABASE_RUNTIME_DB_PASSWORD}@db.[PROJECT_REF].supabase.co:6543/postgres
   ```

3. Remove old env vars (optional, but recommended for clarity).

## Database Name Collision Prevention

### Problem

If both CORPUS and RUNTIME databases are named `postgres` (common in Supabase), this can cause confusion and misdiagnosis. While the `system_identifier` fingerprint prevents actual miswiring, distinct database names make debugging easier.

### Solution

**Preferred**: Create distinct database names (`psa_corpus` and `psa_runtime`) on their respective backends:
- Use `db/migrations/20260119_create_psa_corpus_database.sql` on CORPUS backend
- Use `db/migrations/20260119_create_psa_runtime_database.sql` on RUNTIME backend

**Fallback**: If database creation is not permitted (managed PostgreSQL):
- Continue using `postgres` as the database name
- The fingerprint gates will still prevent miswiring
- Document this limitation in your deployment notes

### Managed Database Limitations

In managed PostgreSQL environments (e.g., Supabase, AWS RDS, Google Cloud SQL):
- Database creation may require superuser privileges that are not available
- `pg_control_system()` may not be accessible, causing fingerprint checks to be skipped
- The application will fall back to table existence checks only

**This is acceptable** but less secure than fingerprint validation. Ensure:
1. Environment variables are correctly set
2. Connection strings point to the correct backends
3. Table existence checks pass (verified by diagnostics endpoint)
