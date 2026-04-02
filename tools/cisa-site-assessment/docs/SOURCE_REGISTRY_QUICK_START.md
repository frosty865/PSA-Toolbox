# Source Registry - Quick Start Guide

## Implementation Status

✅ **All components implemented and ready to use**

## Apply Migration

Run the database migration to create the `source_registry` table and update citation schema:

### Option 1: Using npm script (recommended)
```bash
npm run migrate:source-registry
```

### Option 2: Using Node.js directly
```bash
node scripts/run_migration.js db/migrations/20260116_create_source_registry.sql
```

### Option 3: Using TypeScript runner
```bash
npx tsx tools/run_sql.ts db/migrations/20260116_create_source_registry.sql
```

### Option 4: Using Python script (requires venv)

**Option 4a: Using wrapper script (recommended - auto-activates venv)**
```bash
# Windows
scripts\run_source_registry_migration.bat

# Unix/Mac
bash scripts/run_source_registry_migration.sh
```

**Option 4b: Manual venv activation**
```bash
# Windows
venv\Scripts\activate
python tools/run_source_registry_migration.py

# Unix/Mac
source venv/bin/activate
python tools/run_source_registry_migration.py
```

### Option 5: Manual SQL execution
Copy the contents of `db/migrations/20260116_create_source_registry.sql` and execute in your database client (psql, Supabase SQL Editor, etc.)

## Access Admin UI

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/admin/source-registry`

3. The "Source Registry" link is now available in the Admin navigation menu

## Usage

### 1. Register Sources

Use the admin UI to add authoritative sources:

- **Source Key**: Unique identifier (e.g., `CISA_SECURITY_CONVERGENCE_2024`)
- **Publisher**: Organization name (e.g., `CISA`, `DHS`, `FEMA`)
- **Tier**: Authority level (1=CISA/DHS, 2=FEMA/ISC/etc, 3=ASIS/NFPA)
- **Title**: Document title
- **Source Type**: `pdf`, `web`, or `doc`
- **Scope Tags**: Comma-separated tags (e.g., `physical_security, planning`)

### 2. Create OFCs with Citations

When creating OFCs via `POST /api/admin/ofc-library`, include citations:

```json
{
  "scope": "BASELINE",
  "link_type": "PRIMARY_QUESTION",
  "link_key": "BASE-COM-001",
  "ofc_text": "OFC text here",
  "solution_role": "COMPLETE",
  "citations": [
    {
      "source_key": "CISA_SECURITY_CONVERGENCE_2024",
      "locator_type": "page",
      "locator": "p.12",
      "excerpt": "Short supporting excerpt"
    }
  ]
}
```

### 3. Citation Validation

The system automatically validates:
- ✅ Citations array is not empty
- ✅ Each citation has required fields (`source_key`, `locator_type`, `locator`, `excerpt`)
- ✅ All `source_key`s exist in `source_registry`
- ✅ `locator_type` is one of: `page`, `section`, `paragraph`, `url_fragment`

## API Endpoints

### Source Registry
- `GET /api/admin/source-registry` - List sources (filters: `?publisher=X&tier=1`)
- `POST /api/admin/source-registry` - Create source
- `GET /api/admin/source-registry/[sourceKey]` - Get source
- `PUT /api/admin/source-registry/[sourceKey]` - Update source
- `DELETE /api/admin/source-registry/[sourceKey]` - Delete source

### OFC Library
- `POST /api/admin/ofc-library` - Create OFC (requires citations)

### Citations
- `GET /api/runtime/ofc-library/[ofcId]/citations` - Get citations for OFC

## Policy Configuration

Source policy is defined in `model/policy/source_policy.v1.json`:

- **Tier 1**: CISA, DHS
- **Tier 2**: FEMA, ISC, GSA, DoD UFC, NIST
- **Tier 3**: ASIS, NFPA

Disallowed publishers: VENDOR, BLOG, MARKETING

## Next Steps

1. **Run Migration**: `npm run migrate:source-registry`
2. **Populate Sources**: Add existing sources from `canonical_sources` to `source_registry`
3. **Migrate Citations**: Update existing citations to use `source_key` where possible
4. **Test**: Create a test OFC with citations via admin UI or API

## Files Created

- `db/migrations/20260116_create_source_registry.sql` - Database migration
- `model/policy/source_policy.v1.json` - Policy configuration
- `app/lib/citation/validation.ts` - Citation validation
- `app/lib/citation/guards.ts` - OFC promotion guards
- `app/api/admin/source-registry/` - API endpoints
- `app/admin/source-registry/page.tsx` - Admin UI
- `app/api/admin/ofc-library/route.ts` - OFC creation with validation

## Verification

After running migration, verify:

```sql
-- Check source_registry table exists
SELECT COUNT(*) FROM public.source_registry;

-- Check citation columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ofc_library_citations' 
  AND column_name IN ('source_key', 'locator_type', 'locator', 'retrieved_at');
```
