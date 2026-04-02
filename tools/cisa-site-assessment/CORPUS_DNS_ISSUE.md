# CORPUS Database Connection Issue

## Problem

The CORPUS database connection is failing with DNS resolution error:
```
getaddrinfo ENOTFOUND db.yylslokiaovdythzrbgt.supabase.co
```

This indicates that the hostname `db.yylslokiaovdythzrbgt.supabase.co` cannot be resolved, which typically means:

1. **Direct database access is not enabled** for the CORPUS project
2. The project might be paused or in a different state
3. The connection method might be different for this project

## Current Status

- ✅ **RUNTIME database**: Working perfectly
- ❌ **CORPUS database**: DNS resolution failing
- ✅ **System functionality**: All RUNTIME features work independently

## Solution Options

### Option 1: Enable Direct Database Access (Recommended)

1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt
2. Check if the project is **paused** - if so, resume it
3. Go to: Settings > Database
4. Look for "Connection pooling" or "Direct connections" settings
5. Enable direct database access if available
6. The hostname `db.yylslokiaovdythzrbgt.supabase.co` should become available

### Option 2: Use Supabase REST API (Alternative)

If direct database access cannot be enabled, we could use the Supabase REST API with the service role key instead of direct PostgreSQL connections. This would require refactoring the CORPUS client to use HTTP requests instead of SQL queries.

### Option 3: Use RUNTIME Database for CORPUS Tables (Temporary)

As a temporary workaround, we could store CORPUS tables in the RUNTIME database until CORPUS direct access is enabled. This would require:
- Running the CORPUS schema migration in RUNTIME
- Updating queries to use `getRuntimePool()` instead of `getCorpusPool()`

## Impact

**CORPUS features that are currently unavailable:**
- Document ingestion
- OFC candidate discovery
- Question coverage analysis

**RUNTIME features that continue to work:**
- Assessment creation and management
- Baseline questions and responses
- OFC library and nominations
- Expansion profiles
- All assessment-related functionality

## Next Steps

1. Check if CORPUS project is paused or needs direct access enabled
2. If enabled, test connection again with: `node scripts/test_db_connections.js`
3. If still failing, consider Option 2 or 3 above

The system is fully functional with RUNTIME only - CORPUS is optional for now.

