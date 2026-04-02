# Supabase SSL Connection Fix (pg_hba.conf Error)

## Issue

**Error:** `no pg_hba.conf entry for host "...", user "postgres", database "...", no encryption`

**Root Cause:** Supabase requires SSL connections, and the connection strings were missing the `?sslmode=require` parameter. While the TypeScript `pg` Pool was configured with SSL options, Supabase also requires the SSL mode to be specified in the connection string itself.

## Fix Applied

### 1. Updated TypeScript Database Clients

**Files Modified:**
- `app/lib/db/runtime_client.ts`
- `app/lib/db/corpus_client.ts`

**Changes:**
- Automatically append `?sslmode=require` to Supabase connection strings if not already present
- Applied to both main pool creation and fallback connection logic
- Detects Supabase connections by checking if hostname contains `.supabase.co`

**Code Pattern:**
```typescript
// CRITICAL: Supabase requires SSL in connection string
let connectionString = databaseUrl;
const isSupabase = host.includes('.supabase.co');
if (isSupabase && useSsl && !connectionString.includes('sslmode=')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}sslmode=require`;
}
```

### 2. Updated Python Database Connection Functions

**Files Modified:**
- `tools/corpus/process_module_pdfs_from_incoming.py`

**Changes:**
- Updated `_get_runtime_conn()` to automatically append `?sslmode=require` to Supabase connection strings
- Ensures SSL is added even when using `RUNTIME_DATABASE_URL` directly

**Code Pattern:**
```python
# CRITICAL: Supabase requires SSL in connection string
if '.supabase.co' in dsn.lower() and 'sslmode=' not in dsn.lower():
    separator = '&' if '?' in dsn else '?'
    dsn = f"{dsn}{separator}sslmode=require"
return psycopg2.connect(dsn)
```

### 3. Updated Environment Variables

**File:** `env.local`

**Change:**
- Added `?sslmode=require` to `RUNTIME_DATABASE_URL`

**Before:**
```
RUNTIME_DATABASE_URL=postgresql://postgres:password@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/psa_runtime
```

**After:**
```
RUNTIME_DATABASE_URL=postgresql://postgres:password@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/psa_runtime?sslmode=require
```

## Why This Fix Works

Supabase's PostgreSQL servers are configured to **require SSL encryption** for all connections. The `pg_hba.conf` error occurs when:

1. A connection attempts to connect without SSL
2. The connection string doesn't specify `sslmode=require`
3. Even if the Pool has SSL options, Supabase needs it in the connection string

The fix ensures:
- ✅ Connection strings explicitly request SSL with `?sslmode=require`
- ✅ Pool SSL options are still set (`ssl: { rejectUnauthorized: false }`)
- ✅ Both main connections and fallback connections include SSL
- ✅ Automatic detection for Supabase hosts

## Verification

After applying this fix:

1. **Restart your application** to load the updated code
2. **Check connection logs** - should see successful connections without pg_hba.conf errors
3. **Test database operations** - queries should work normally

## For Other Connection Strings

If you have other connection strings (e.g., in Python scripts, other tools), ensure they also include `?sslmode=require`:

```python
# Python example
connection_string = f"postgresql://postgres:{password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require"
```

Most Python scripts in this codebase already have this fix (see `tools/corpus/ingest_module_pdf_to_runtime.py` and others).

## Related Documentation

- `docs/MODULE_INGESTION_SSL_FIX.md` - Similar fix for Python ingestion scripts
- `docs/PG_HBA_SETUP.md` - General pg_hba.conf information

## Self-Signed Certificate in Chain (SELF_SIGNED_CERT_IN_CHAIN)

If you see:
```
unhandledRejection: Error: self-signed certificate in certificate chain
  code: 'SELF_SIGNED_CERT_IN_CHAIN'
```

**Cause:** Node.js is rejecting the TLS connection (e.g. to Supabase or behind a corporate proxy that does SSL inspection).

**Fix applied:** TLS is handled only at the pg connection level. All pg Pools use `ensureNodePgTls(connectionString)` (adds `sslmode=require` and `uselibpqcompat=true`) and `applyNodeTls({ connectionString, ssl: { rejectUnauthorized: false } })`. This allows Supabase and self-signed certs without any global Node TLS overrides. Do not set or document global TLS env vars; behavior is deterministic across dev and production.

## Status

- ✅ TypeScript clients updated
- ✅ Python connection functions updated
- ✅ Environment variables updated
- ✅ Fallback connection logic updated
- ✅ Automatic SSL detection for Supabase hosts
- ✅ pg connections use libpq-compatible TLS (connection-level only)

## Additional Python Scripts

The following Python scripts already have SSL properly configured:
- `tools/corpus/ingest_module_pdf_to_runtime.py` - Has SSL fix
- `tools/corpus/normalize_pdf_filenames.py` - Has SSL in `get_corpus_db_connection()`
- `tools/corpus/process_module_pdfs_from_incoming.py` - **Now fixed** with automatic SSL detection
