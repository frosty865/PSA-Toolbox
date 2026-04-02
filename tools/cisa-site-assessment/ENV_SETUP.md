# Environment Variables Setup

## Required Environment Variables for Runtime Database

The `psa_rebuild` application requires the following environment variables to connect to the Supabase runtime database.

### Required Variables

Add these to your `.env.local` file:

```bash
# Supabase Runtime Project (wivohgbuuwxoyfyzntsd)
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_DB_PASSWORD="<your-runtime-database-password>"

# IMPORTANT: Do NOT set DATABASE_URL unless you explicitly want to use it
# If DATABASE_URL is set and points to localhost, the app will connect to localhost
# Either unset DATABASE_URL or set USE_DATABASE_URL="true" if you want to use it
# DATABASE_URL=""
```

### How to Get These Values

1. **SUPABASE_RUNTIME_URL**:
   - Go to: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd/settings/api
   - Copy the "Project URL" value
   - Should be: `https://wivohgbuuwxoyfyzntsd.supabase.co`

2. **SUPABASE_RUNTIME_DB_PASSWORD**:
   - Go to: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd/settings/database
   - Scroll to "Connection string" section
   - Copy the password from the connection string:
     ```
     postgresql://postgres:[PASSWORD_HERE]@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/postgres
     ```
   - **Note**: This is the database password, NOT the service role key (JWT token)

### Optional: Using DATABASE_URL (Not Recommended)

If you must use `DATABASE_URL` instead of the separate variables:

```bash
USE_DATABASE_URL="true"
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/postgres"
```

**Warning**: Using `DATABASE_URL` bypasses the localhost guard. Only use this if you understand the implications.

### Local Development Seeding

If you want to seed a local PostgreSQL database for development:

1. Set up local PostgreSQL and create a database
2. Set `DATABASE_URL` to point to your local database:
   ```bash
   DATABASE_URL="postgresql://postgres:password@localhost:5432/psa_local"
   ```
3. Run the seeder:
   ```bash
   npx tsx tools/seed_baseline_spines_local.ts
   ```

The seeder will:
- Connect to the authoritative Supabase runtime database (using `SUPABASE_RUNTIME_URL` + `SUPABASE_RUNTIME_DB_PASSWORD`)
- Copy all active baseline spines to your local database
- Use UPSERT by `canon_id`, so it's safe to run multiple times

### Security Guards

The application includes hard guards to prevent accidental connections:

1. **Localhost Guard**: In non-development mode (`NODE_ENV !== 'development'`), the app will refuse to connect to localhost
2. **Required Variables**: The app will fail fast if `SUPABASE_RUNTIME_URL` or `SUPABASE_RUNTIME_DB_PASSWORD` are missing

### Verification

After setting up your environment variables:

1. Start your development server
2. Navigate to: `http://localhost:3000/api/runtime/health`
3. Verify:
   - `db.database` shows `postgres`
   - `host.addr` is NOT `::1` or `127.0.0.1` (unless intentionally local)
   - `schema_checks.baseline_spines_runtime.exists` is `true`
   - `schema_checks.baseline_spines_runtime.counts.active_true > 0`

If any of these checks fail, review your environment variables and database connection.
