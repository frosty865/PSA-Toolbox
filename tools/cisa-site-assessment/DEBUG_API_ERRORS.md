# Debugging API 500 Errors

## Changes Made

### 1. Enhanced Error Handling in `runtime_client.ts`
- Improved `ensureRuntimePoolConnected()` with better error detection
- Added comprehensive error messages with connection details
- Better fallback port handling with detailed error context

### 2. Enhanced Error Logging in API Routes
- `/api/runtime/assessments` - Added detailed error logging with error codes
- `/api/runtime/questions` - Added detailed error logging with error codes
- Both routes now provide hints about missing environment variables

### 3. Improved Baseline Loader Error Handling
- Better detection of connection vs. query errors
- More specific error messages for different failure types

## Debugging Steps

### 1. Check Server Console Logs
The API routes now log detailed error information. Look for:
- `[API /api/runtime/assessments GET] Error:` - Shows error message, code, and stack
- `[Runtime DB]` - Shows database connection attempts and failures
- `[baselineLoader]` - Shows baseline loading errors

### 2. Test Database Connection
Visit: `http://localhost:3000/api/runtime/health`

This endpoint will show:
- Database connection status
- Current database and user
- Host and port information
- Whether `baseline_spines_runtime` table exists
- Row counts and sample data

### 3. Verify Environment Variables
Check your `.env.local` file has:
```bash
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_DB_PASSWORD="<your-password>"
```

Optional (for expansion questions):
```bash
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_DB_PASSWORD="<your-password>"
```

### 4. Common Error Codes

- `ETIMEDOUT` - Connection timeout (check network/firewall)
- `ECONNREFUSED` - Connection refused (check host/port)
- `ENOTFOUND` - DNS resolution failed (check URL)
- `42P01` - Table doesn't exist (run migrations)
- `28P01` - Authentication failed (check password)

### 5. Test Individual Endpoints

```bash
# Test assessments endpoint
curl http://localhost:3000/api/runtime/assessments

# Test questions endpoint (base only)
curl http://localhost:3000/api/runtime/questions?universe=BASE

# Test health endpoint
curl http://localhost:3000/api/runtime/health
```

## Next Steps

1. **Check server logs** - Look for the detailed error messages
2. **Test health endpoint** - Verify database connection
3. **Verify env vars** - Ensure all required variables are set
4. **Check network** - Ensure you can reach Supabase from your machine

If errors persist, the detailed error messages should now indicate exactly what's failing.
