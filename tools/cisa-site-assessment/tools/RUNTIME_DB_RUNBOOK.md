# Runtime DB Runbook

This runbook provides exact commands to verify, reset, seed, and verify the runtime database.

## Prerequisites

Ensure you have the following environment variables set (in `.env.local` or your environment):

```bash
# Required for runtime DB connection
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_DB_PASSWORD="<your-runtime-database-password>"

# Optional: Connection configuration (with defaults)
SUPABASE_RUNTIME_PORT=6543              # Pooler port (default: 6543)
SUPABASE_RUNTIME_DIRECT_PORT=5432       # Direct Postgres port (default: 5432)
SUPABASE_RUNTIME_SSL=true               # Enable SSL (default: true)
SUPABASE_RUNTIME_CONNECT_TIMEOUT_MS=8000        # Connection timeout (default: 8000)
SUPABASE_RUNTIME_STATEMENT_TIMEOUT_MS=20000     # Statement timeout (default: 20000)

# Required for seeding
BASELINE_SPINES_JSON_PATH="/path/to/baseline_spines.json"
```

**Note**: If you prefer to use `DATABASE_URL` instead, set `USE_DATABASE_URL=true` and ensure `DATABASE_URL` points to the runtime database.

**Connection Resilience**: The runtime client automatically tries the pooler port (6543) first, then falls back to the direct port (5432) if the pooler is unavailable. This handles common firewall/network restrictions.

## Step A: Verify Target DB

Before making any changes, verify you're connected to the correct database:

```bash
# Hit the health endpoint
curl http://localhost:3000/api/runtime/health
# Or if running in production:
curl https://your-domain.com/api/runtime/health
```

**Expected output**:
- `host.addr` should NOT be `::1` or `127.0.0.1` unless you are intentionally using localhost
- `schema_checks.baseline_spines_runtime.exists` should be `true`
- `schema_checks.baseline_spines_runtime.counts.total` shows current row count
- `schema_checks.baseline_spines_runtime.counts.active_true` shows active row count

**Example good output**:
```json
{
  "server_time": "2026-01-15T10:30:00.000Z",
  "db": {
    "database": "postgres",
    "user": "postgres"
  },
  "host": {
    "addr": "10.x.x.x",
    "port": 6543
  },
  "schema_checks": {
    "baseline_spines_runtime": {
      "exists": true,
      "counts": {
        "total": 150,
        "active_true": 145
      },
      "sample": [
        {
          "canon_id": "BASELINE_001",
          "discipline_code": "SECURITY",
          "subtype_code": "ACCESS_CONTROL",
          "preview": "Does the system implement multi-factor authentication?",
          "active": true
        }
      ]
    }
  }
}
```

**If `addr` is `::1` or `127.0.0.1` in production**: Check your environment variables. The app should refuse to connect to localhost in non-development mode.

## Step B: Reset Runtime DB

**WARNING**: This will delete all runtime assessment data. Only run this if you want a clean slate.

```bash
# Option 1: Using Node.js script (RECOMMENDED - handles port fallback automatically)
npx tsx tools/run_runtime_db_reset.ts

# Option 2: Using psql with DATABASE_URL (if USE_DATABASE_URL=true)
psql "$DATABASE_URL" -f tools/runtime_db_reset.sql

# Option 3: Using psql with Supabase runtime connection string directly
psql "postgresql://postgres:${SUPABASE_RUNTIME_DB_PASSWORD}@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/postgres" -f tools/runtime_db_reset.sql

# Option 4: If scripts timeout, use Supabase SQL Editor (see Troubleshooting section)
```

**What this does**:
- Truncates all runtime assessment tables (responses, instances, etc.)
- Truncates `baseline_spines_runtime` (to guarantee clean reseed)
- Does NOT drop tables (safe to run multiple times)
- Verifies connection before and after reset

**The Node.js script (`run_runtime_db_reset.ts`)**:
- Automatically tries pooler port (6543) first, then falls back to direct port (5432)
- Shows which port succeeded in the output
- Performs pre-flight checks to verify connection
- Verifies reset completed successfully

**To preserve assessments**: Edit `tools/runtime_db_reset.sql` and comment out the `TRUNCATE TABLE public.assessments` and `TRUNCATE TABLE public.assessment_definitions` lines.

## Step C: Seed Spines

Load baseline spines from a canonical JSON export:

```bash
# Set the path to your baseline spines JSON file
export BASELINE_SPINES_JSON_PATH="/path/to/baseline_spines.json"

# Run the seeder
node tools/seed_baseline_spines.ts

# Or with tsx/ts-node if needed:
npx tsx tools/seed_baseline_spines.ts
```

**Expected output**:
```
[INFO] Starting baseline spines seeding...

[INFO] Loading spines from: /path/to/baseline_spines.json
[OK] Loaded 150 spines from JSON file
[INFO] Upserting spines into runtime database...
[OK] Upserted 150 spines (150 inserted, 0 updated)

[OK] Seeding complete!
[INFO] Runtime database now has 150 total spines, 145 active
```

**If seeding fails**:
- Check that `BASELINE_SPINES_JSON_PATH` is set correctly
- Verify the JSON file exists and is valid JSON
- Ensure `SUPABASE_RUNTIME_URL` and `SUPABASE_RUNTIME_DB_PASSWORD` are set
- Check that the `baseline_spines_runtime` table exists in the runtime database

**Hard fail condition**: The script will exit with code 1 if `active_true == 0` after seeding.

## Step D: Verify

After seeding, verify the database is populated correctly:

```bash
# Hit the health endpoint again
curl http://localhost:3000/api/runtime/health
```

**Expected output**:
- `schema_checks.baseline_spines_runtime.counts.total > 0`
- `schema_checks.baseline_spines_runtime.counts.active_true > 0`
- `schema_checks.baseline_spines_runtime.sample` array populated with 5 sample rows

**Example good output**:
```json
{
  "schema_checks": {
    "baseline_spines_runtime": {
      "exists": true,
      "counts": {
        "total": 150,
        "active_true": 145
      },
      "sample": [
        {
          "canon_id": "BASELINE_001",
          "discipline_code": "SECURITY",
          "subtype_code": "ACCESS_CONTROL",
          "preview": "Does the system implement multi-factor authentication?",
          "active": true
        },
        {
          "canon_id": "BASELINE_002",
          "discipline_code": "SECURITY",
          "subtype_code": "ENCRYPTION",
          "preview": "Are all sensitive data encrypted at rest?",
          "active": true
        }
        // ... 3 more samples
      ]
    }
  }
}
```

## Step E: UI Confirmation

Verify that the UI endpoints return data:

```bash
# Check questions catalog endpoint
curl http://localhost:3000/api/runtime/questions

# Expected: base_questions array length > 0
# Example:
# {
#   "base_questions": [...],
#   "expansion_questions": [...],
#   "total": 150
# }

# Check assessment questions endpoint (requires a valid assessment ID)
curl http://localhost:3000/api/runtime/assessments/[assessmentId]/questions

# Expected: baseline_questions array length > 0 (plus expansions if applicable)
```

## Troubleshooting

### Connection Timeout Issues

**Problem**: Scripts timeout when connecting to Supabase database

**Symptoms**:
- `ETIMEDOUT` or `ECONNREFUSED` errors
- Script hangs and eventually fails
- Error message mentions both ports (6543 and 5432)

**Solutions** (try in order):

1. **Try direct port explicitly**:
   ```bash
   SUPABASE_RUNTIME_PORT=5432 node tools/run_runtime_db_reset.ts
   ```
   (The fallback should handle this automatically, but you can force it)

2. **Check networking**:
   - Corporate firewall: Allow outbound TCP ports 6543 and/or 5432 to `db.wivohgbuuwxoyfyzntsd.supabase.co`
   - VPN: Test with VPN on/off to see if it affects connectivity
   - IP allowlist: If Supabase project has "Network Restrictions" enabled, add your current egress IP
     - Find your IP: `curl ifconfig.me` or `curl ipinfo.io/ip`
     - Add in Supabase Dashboard > Settings > Database > Network Restrictions

3. **Use Supabase SQL Editor (guaranteed path)**:
   If both ports fail due to network restrictions:
   
   a. Open Supabase Dashboard: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd
   
   b. Go to SQL Editor (left sidebar)
   
   c. Create a new query and paste the contents of `tools/runtime_db_reset.sql`:
   ```sql
   BEGIN;
   
   -- runtime artifacts (safe to wipe)
   TRUNCATE TABLE public.assessment_question_responses RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_responses RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_expansion_responses RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_status RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_question_universe RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_expansion_profiles RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_required_elements RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_technology_profiles RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_applied_ofcs RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.assessment_applied_vulnerabilities RESTART IDENTITY CASCADE;
   TRUNCATE TABLE public.baseline_spines_runtime RESTART IDENTITY CASCADE;
   
   COMMIT;
   ```
   
   d. Click "Run" to execute
   
   e. Verify reset by running:
   ```sql
   SELECT COUNT(*) as total FROM public.baseline_spines_runtime;
   ```
   (Should return 0)
   
   f. Once connectivity is restored, run the seeder script:
   ```bash
   BASELINE_SPINES_JSON_PATH=/path/to/baseline_spines.json node tools/seed_baseline_spines.ts
   ```

### Connection Issues

**Problem**: Health endpoint shows `addr: ::1` or `127.0.0.1` in production

**Solution**: 
- Check `SUPABASE_RUNTIME_URL` environment variable
- Verify `SUPABASE_RUNTIME_DB_PASSWORD` is set
- Ensure `USE_DATABASE_URL` is not set to `true` with a localhost URL
- The app will refuse to connect to localhost in non-development mode

### Seeding Issues

**Problem**: `BASELINE_SPINES_JSON_PATH` not found

**Solution**:
- Use absolute path: `BASELINE_SPINES_JSON_PATH=/absolute/path/to/file.json`
- Or repo-relative path: `BASELINE_SPINES_JSON_PATH=./data/baseline_spines.json`
- Verify the file exists and is readable

**Problem**: Seeding succeeds but `active_true == 0`

**Solution**:
- Check the JSON file - ensure spines have `active: true` (or omit `active` field, defaults to true)
- Verify the `baseline_spines_runtime` table schema matches expected format
- Check database logs for constraint violations

### Database Fingerprint

The runtime client logs connection info:
```
runtime_db_connected host=db.wivohgbuuwxoyfyzntsd.supabase.co port=6543 db=postgres user=postgres
```

Use this to verify:
- Which port succeeded (6543 = pooler, 5432 = direct fallback)
- You're connected to the correct database (not localhost in production)
- The connection was established successfully

If you see the fallback port (5432), it means the pooler port (6543) was unavailable, likely due to firewall restrictions.

## Quick Reference

```bash
# Full reset and reseed workflow:
# 1. Verify
curl http://localhost:3000/api/runtime/health

# 2. Reset (using Node.js script with automatic fallback)
npx tsx tools/run_runtime_db_reset.ts

# OR if you have psql available:
psql "$DATABASE_URL" -f tools/runtime_db_reset.sql

# OR if both fail, use Supabase SQL Editor (see Troubleshooting section)

# 3. Seed
BASELINE_SPINES_JSON_PATH=/path/to/baseline_spines.json npx tsx tools/seed_baseline_spines.ts

# 4. Verify
curl http://localhost:3000/api/runtime/health

# 5. UI check
curl http://localhost:3000/api/runtime/questions
```

## Networking Checklist

If you're experiencing connection timeouts, check:

- [ ] **Corporate firewall**: Allow outbound TCP 6543 and/or 5432 to `db.wivohgbuuwxoyfyzntsd.supabase.co`
- [ ] **VPN**: Test connection with VPN on/off
- [ ] **IP allowlist**: If Supabase Network Restrictions are enabled, add your egress IP
  - Find IP: `curl ifconfig.me`
  - Add in: Supabase Dashboard > Settings > Database > Network Restrictions
- [ ] **Port preference**: If pooler (6543) is blocked but direct (5432) works:
  - Set `SUPABASE_RUNTIME_PORT=5432` to skip pooler attempt
  - Or let the automatic fallback handle it
- [ ] **SSL**: Ensure SSL is enabled (`SUPABASE_RUNTIME_SSL=true`, default)
- [ ] **Timeouts**: Increase if needed:
  - `SUPABASE_RUNTIME_CONNECT_TIMEOUT_MS=15000` (default: 8000)
  - `SUPABASE_RUNTIME_STATEMENT_TIMEOUT_MS=30000` (default: 20000)
