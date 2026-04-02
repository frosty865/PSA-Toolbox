# CORPUS Database Password Required

## Issue

The database clients need the **database password** for direct PostgreSQL connections, not the service role key (JWT token).

## Solution

### For RUNTIME Database

The RUNTIME client will use your existing `DATABASE_URL` which already has the password. No changes needed.

### For CORPUS Database

You need to add the CORPUS database password to `.env.local`:

1. **Get the password**:
   - Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/settings/database
   - Scroll to "Connection string" section
   - Copy the password from the connection string:
     ```
     postgresql://postgres:[PASSWORD_HERE]@db.yylslokiaovdythzrbgt.supabase.co:6543/postgres
     ```

2. **Add to `.env.local`**:
   ```bash
   SUPABASE_CORPUS_DB_PASSWORD="[paste password here]"
   ```

3. **Alternative**: If you have the full connection string, you can also add:
   ```bash
   SUPABASE_CORPUS_DATABASE_URL="postgresql://postgres:[PASSWORD]@db.yylslokiaovdythzrbgt.supabase.co:6543/postgres"
   ```

## Updated Environment Variables

Your `.env.local` should have:

```bash
# RUNTIME (uses existing DATABASE_URL or can add explicit password)
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_DB_PASSWORD="[optional, if not using DATABASE_URL]"

# CORPUS (needs database password)
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_DB_PASSWORD="[REQUIRED - get from Supabase dashboard]"
```

## Note

- **Service role keys** (JWT tokens) are for REST API calls, not direct PostgreSQL connections
- **Database passwords** are for direct PostgreSQL connections (what we're using)
- These are different credentials with different purposes

