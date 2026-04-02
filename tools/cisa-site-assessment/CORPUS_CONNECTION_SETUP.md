# CORPUS Database Connection Setup

## Current Status

The CORPUS database connection is **optional**. The system works with RUNTIME database only, and CORPUS features can be enabled later.

## Finding the CORPUS Database Connection String

If the connection string is not visible on the Database Settings page, try these locations:

### Option 1: Connect Button (Recommended)

1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt
2. Click the **"Connect"** button at the top of the page (or in the sidebar)
3. Look for **"Direct connection"** section
4. The connection string format will be:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.yylslokiaovdythzrbgt.supabase.co:5432/postgres
   ```
   Note: The password is shown as `[YOUR-PASSWORD]` placeholder - you need to know or reset the actual password.

### Option 2: Enable Direct Database Access

If direct database access is not enabled:

1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/settings/database
2. Look for "Connection pooling" or "Direct connections" settings
3. Enable direct database access if available
4. Reset the database password if needed (Settings > Database > Reset database password)

### Option 3: Use Transaction Pooler

Some Supabase projects use transaction pooler on port 6543 instead of direct connection on port 5432:

```
postgresql://postgres:[PASSWORD]@db.yylslokiaovdythzrbgt.supabase.co:6543/postgres
```

## Adding the Password to `.env.local`

Once you have the database password:

```bash
SUPABASE_CORPUS_DB_PASSWORD="your-password-here"
```

## Testing the Connection

After adding the password, test with:

```bash
node scripts/test_db_connections.js
```

Or check the health endpoint:

```bash
curl http://localhost:3000/api/admin/health/dbs
```

## Note

- **RUNTIME database is working** - all assessment features work without CORPUS
- **CORPUS is optional** - only needed for document ingestion and OFC candidate discovery
- The system will continue to work even if CORPUS connection fails

