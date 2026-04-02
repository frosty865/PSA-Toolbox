# Update Your .env.local File

## What You Need to Add

Add these new variables to your `.env.local` file. You can add them at the end of the file.

### Step 1: Add RUNTIME Variables (Reuse Existing Key)

You already have the RUNTIME service role key, so you can reuse it:

```bash
# ============================================================================
# RUNTIME Project (wivohgbuuwxoyfyzntsd)
# ============================================================================
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_ANON_KEY="sb_publishable_QuEn3h16DCAw3Jt_msFIiw_qBYy2Qzl"
SUPABASE_RUNTIME_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpdm9oZ2J1dXd4b3lmeXpudHNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY5NDI0OSwiZXhwIjoyMDc1MjcwMjQ5fQ.uVMA5t2eMCDbmj-jv6F-pzDEopHvFv-4CzpnJLowWEo"
```

**Note**: These are the same values you already have, just renamed:
- `SUPABASE_RUNTIME_URL` = your existing `SUPABASE_URL`
- `SUPABASE_RUNTIME_ANON_KEY` = your existing `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_RUNTIME_SERVICE_ROLE_KEY` = your existing `SUPABASE_SERVICE_ROLE_KEY`

### Step 2: Add CORPUS Variables (Get from Supabase Dashboard)

You need to get these from the CORPUS project:

1. Go to: https://supabase.com/dashboard/project/yylslokiaovdythzrbgt/settings/api
2. Copy the keys and add:

```bash
# ============================================================================
# CORPUS Project (yylslokiaovdythzrbgt)
# ============================================================================
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_ANON_KEY="[PASTE_ANON_KEY_FROM_CORPUS_PROJECT]"
SUPABASE_CORPUS_SERVICE_ROLE_KEY="[PASTE_SERVICE_ROLE_KEY_FROM_CORPUS_PROJECT]"
```

## Quick Copy-Paste Template

Add this to the end of your `.env.local`:

```bash
# ============================================================================
# RUNTIME Project (wivohgbuuwxoyfyzntsd)
# ============================================================================
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_ANON_KEY="sb_publishable_QuEn3h16DCAw3Jt_msFIiw_qBYy2Qzl"
SUPABASE_RUNTIME_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpdm9oZ2J1dXd4b3lmeXpudHNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTY5NDI0OSwiZXhwIjoyMDc1MjcwMjQ5fQ.uVMA5t2eMCDbmj-jv6F-pzDEopHvFv-4CzpnJLowWEo"

# ============================================================================
# CORPUS Project (yylslokiaovdythzrbgt)
# ============================================================================
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_ANON_KEY="[GET_FROM_CORPUS_DASHBOARD]"
SUPABASE_CORPUS_SERVICE_ROLE_KEY="[GET_FROM_CORPUS_DASHBOARD]"
```

## What You Can Keep (Optional)

You can keep these legacy variables for now - they won't hurt:
- `DATABASE_URL` - will be ignored by new code
- `SUPABASE_URL` - will be ignored by new code  
- `SUPABASE_SERVICE_ROLE_KEY` - will be ignored by new code
- `NEXT_PUBLIC_SUPABASE_URL` - still used by client-side code
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - still used by client-side code

## After Updating

1. Restart your Next.js dev server
2. Test the health endpoint: `GET /api/admin/health/dbs`
3. Should return both `runtime_ok: true` and `corpus_ok: true`

