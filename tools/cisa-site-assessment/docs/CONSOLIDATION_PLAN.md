# Backend Consolidation Plan

## Summary

**Yes, psaback can be deprecated for baseline functionality.** The baseline spines endpoint has been consolidated into Next.js, eliminating the need for the Flask backend server.

## Current State

### What psaback Currently Provides

1. **Baseline Spines** (`/api/baseline/spines`) - ✅ **CONSOLIDATED**
   - Now served by `app/api/baseline/spines/route.ts` in Next.js
   - Queries `baseline_spines_runtime` table directly
   - No external HTTP call needed

2. **Security Mode** (`/api/system/security-mode`) - ⚠️ **PROXIED**
   - Currently proxied from Next.js to psaback
   - Could be moved to Next.js if needed

3. **Pipeline Logs** (`/api/admin/pipeline-logs`) - ⚠️ **PROXIED**
   - Currently proxied from Next.js to psaback
   - Could be moved to Next.js if needed

4. **Review Endpoints** (`/api/review/*`) - ⚠️ **PROXIED**
   - Currently proxied from Next.js to psaback
   - Could be moved to Next.js if needed

5. **System Status** (`/api/system/status`) - ⚠️ **PROXIED**
   - Currently proxied from Next.js to psaback
   - Could be moved to Next.js if needed

### What psa_rebuild Already Has

- ✅ Direct database access via `getRuntimePool()` and `getCorpusPool()`
- ✅ All assessment CRUD operations
- ✅ Scoring, responses, questions - all in Next.js API routes
- ✅ **Baseline spines endpoint** - now consolidated in Next.js

## Consolidation Completed

### Changes Made

1. **Created `/app/api/baseline/spines/route.ts`**
   - Direct database query to `baseline_spines_runtime` table
   - Replaces psaback Flask endpoint
   - No external HTTP dependency

2. **Updated `app/lib/baselineLoader.ts`**
   - Server-side: Queries database directly (no HTTP overhead)
   - Client-side: Uses HTTP fetch to Next.js API route
   - Automatic context detection

3. **Updated `app/lib/baselineClient.ts`**
   - Now fetches from Next.js API route instead of psaback
   - Removed dependency on `NEXT_PUBLIC_PSA_BACKEND_URL`

4. **Updated all API route comments**
   - Changed from "via psaback API" to "via Next.js API route (consolidated)"

## Benefits

1. **Simplified Architecture**
   - One less server to run and maintain
   - No inter-service HTTP calls for baseline data
   - Reduced latency (direct DB query vs HTTP round-trip)

2. **Easier Deployment**
   - Single Next.js application
   - No need to coordinate two servers
   - Simpler environment variable management

3. **Better Performance**
   - Server-side API routes query database directly
   - No HTTP overhead for internal calls
   - Client-side still uses HTTP (as needed)

## Remaining Dependencies on psaback

The following endpoints still proxy to psaback (optional to consolidate later):

- `/api/system/security-mode` - Security mode management
- `/api/admin/pipeline-logs` - Pipeline log viewing
- `/api/review/*` - Review queue management
- `/api/system/status` - System status monitoring

**Recommendation:** These can remain proxied if psaback serves other critical functionality, or can be consolidated into Next.js if desired.

## Migration Path

### Immediate (Completed)
- ✅ Baseline spines endpoint consolidated
- ✅ All baseline data loading uses Next.js route
- ✅ No psaback dependency for baseline functionality

### Optional Future Consolidation
- Move security mode to Next.js (if needed)
- Move pipeline logs to Next.js (if needed)
- Move review endpoints to Next.js (if needed)
- Move system status to Next.js (if needed)

### Deprecation
Once all critical functionality is consolidated, psaback can be:
- Deprecated for PSA Rebuild frontend
- Kept only for other tools/services that depend on it
- Or fully removed if no other dependencies exist

## Testing

To verify consolidation works:

1. **Stop psaback server** (no longer needed for baseline)
2. **Start Next.js server**: `npm run dev` or `npm start`
3. **Test baseline endpoint**: `http://localhost:3000/api/baseline/spines`
4. **Verify UI works**: All baseline question loading should work without psaback

## Environment Variables

### No Longer Needed
- `NEXT_PUBLIC_PSA_BACKEND_URL` (for baseline)
- `NEXT_PUBLIC_FLASK_URL` (for baseline)
- `FLASK_URL` (for baseline)

### Still Needed (if other psaback endpoints are used)
- `FLASK_BASE` - For proxied endpoints (security-mode, pipeline-logs, etc.)

## Conclusion

**Baseline functionality is fully consolidated.** psaback is no longer required for baseline question loading. The Flask server can be deprecated for this use case, or kept only for other functionality that hasn't been consolidated yet.
