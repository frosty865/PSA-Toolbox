# Environment Variables Migration Guide

## Current Location

Your `.env.local` file is located at:
```
D:\PSA_System\psa_rebuild\.env.local
```

## Current Structure (Legacy)

Your current `.env.local` uses the legacy structure:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://wivohgbuuwxoyfyzntsd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=***
DATABASE_URL=postgresql://postgres:***@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/postgres
SUPABASE_URL=https://wivohgbuuwxoyfyzntsd.supabase.co
```

## Required Updates

### Step 1: Add New Variables

Add these to your `.env.local` file:

```bash
# ============================================================================
# RUNTIME Project (wivohgbuuwxoyfyzntsd)
# ============================================================================
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_ANON_KEY="PASTE_FROM_RUNTIME_SETTINGS_API"
SUPABASE_RUNTIME_SERVICE_ROLE_KEY="PASTE_FROM_RUNTIME_SETTINGS_API"

# ============================================================================
# CORPUS Project (yylslokiaovdythzrbgt)
# ============================================================================
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_ANON_KEY="PASTE_FROM_CORPUS_SETTINGS_API"
SUPABASE_CORPUS_SERVICE_ROLE_KEY="PASTE_FROM_CORPUS_SETTINGS_API"
```

### Step 2: Get Keys from Supabase

#### RUNTIME Project Keys:
1. Go to: https://supabase.com/dashboard/project/wivohgbuuwxoyfyzntsd/settings/api
2. Copy:
   - **anon/public key** → `SUPABASE_RUNTIME_ANON_KEY`
   - **service_role key** → `SUPABASE_RUNTIME_SERVICE_ROLE_KEY`

#### CORPUS Project Keys:
1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/settings/api
2. Copy:
   - **anon/public key** → `SUPABASE_CORPUS_ANON_KEY`
   - **service_role key** → `SUPABASE_CORPUS_SERVICE_ROLE_KEY`

### Step 3: Optional - Keep Legacy for Backward Compatibility

You can keep the legacy variables temporarily for backward compatibility:
- `DATABASE_URL` - will be ignored by new code
- `SUPABASE_URL` - will be ignored by new code
- `SUPABASE_SERVICE_ROLE_KEY` - will be ignored by new code

Or remove them once you've verified everything works.

## Final Structure

Your `.env.local` should look like:

```bash
# RUNTIME Project
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_RUNTIME_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# CORPUS Project
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_CORPUS_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Legacy (can be removed after verification)
# DATABASE_URL=...
# SUPABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

## Verification

After updating, test the health endpoint:
```bash
curl http://localhost:3000/api/admin/health/dbs
```

Should return:
```json
{
  "runtime_ok": true,
  "corpus_ok": true,
  "runtime_project": "wivohgbuuwxoyfyzntsd",
  "corpus_project": "yylslokiaovdythzrbgt",
  "runtime_matches": true,
  "corpus_matches": true
}
```

