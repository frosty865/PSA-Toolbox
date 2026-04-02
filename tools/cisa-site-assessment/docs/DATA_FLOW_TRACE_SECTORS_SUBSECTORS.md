# Data Flow Trace: Sector and Subsector Selection

## Data Flow Path

### 1. Frontend Component
**File:** `app/components/CreateAssessmentDialog.tsx`
- **Line 197:** Fetches metadata from `/api/runtime/metadata`
- **Line 212:** Sets metadata state: `setMeta(r)`
- **Line 496-497:** Renders sectors dropdown: `{meta?.sectors?.map(s => ...)}`
- **Line 515:** Renders subsectors dropdown: `{availableSubsectors.map(s => ...)}`
- **Line 223-226:** Filters subsectors by selected sector: `meta.subsectors.filter(s => !sectorCode || s.sector_code === sectorCode)`

### 2. API Endpoint
**File:** `app/api/runtime/metadata/route.ts`
- **Line 17:** Gets database pool: `getRuntimePool()`
- **Line 20-25:** Counts rows in `sectors` and `subsectors` tables
- **Line 40-45:** Queries sectors: `SELECT id, sector_name, name, sector_code, is_active FROM sectors ORDER BY ...`
- **Line 72-82:** Queries subsectors: `SELECT s.id, s.name, s.sector_id, s.subsector_code, ... FROM subsectors s LEFT JOIN sectors sec ON s.sector_id = sec.id ORDER BY s.name`
- **Line 50-57:** Maps sectors to format: `{ sector_code, label }`
- **Line 89-99:** Maps subsectors to format: `{ subsector_code, sector_code, label }`

### 3. Database Connection
**File:** `app/lib/db/runtime_client.ts`
- **Line 18-66:** `getRuntimePool()` function
- **Line 22:** Uses `DATABASE_URL` environment variable (if set)
- **Line 26-43:** Or constructs from `SUPABASE_RUNTIME_URL` + `SUPABASE_RUNTIME_DB_PASSWORD`
- **Line 42:** Extracts project ref from URL: `wivohgbuuwxoyfyzntsd`
- **Line 43:** Constructs connection: `postgresql://postgres:[PASSWORD]@db.wivohgbuuwxoyfyzntsd.supabase.co:6543/postgres`

## Current Issue

The API is only returning **1 sector** and **1 subsector**, but the database tables contain the full range of data.

## Debug Information Added

The API now includes `_debug` object in the response with:
- Database connection info (db_name, server address)
- Direct COUNT(*) results from tables
- Query strings being executed
- Raw database rows returned
- Column detection results

## Next Steps

1. Open Create Assessment dialog
2. Check browser console for `[CreateAssessmentDialog] API Debug Info:`
3. Verify:
   - `sectorCountInDB` - should match actual count in database
   - `subsectorsCountInDB` - should match actual count in database
   - `sectorsFound` vs `sectorCountInDB` - if different, query is filtering
   - `database.db_name` - verify correct database
   - `sectorsRaw` - see all raw rows returned
   - `subsectorsRaw` - see all raw rows returned

## Potential Issues

1. **Wrong Database Connection**: `DATABASE_URL` might point to a different/truncated database
2. **Query Filtering**: Some WHERE clause might be filtering results (though code shows no WHERE clause)
3. **Row-Level Security**: PostgreSQL RLS policies might be limiting results
4. **Connection Pool Issue**: Pool might be connected to wrong database
