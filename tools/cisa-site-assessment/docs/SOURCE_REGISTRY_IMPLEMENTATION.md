# Source Registry Implementation

## Overview

Implemented a tiered source registry and citation metadata model to ensure OFCs cite authoritative sources (CISA primary, others secondary/tertiary) without lowering rigor.

## Components

### 1. Database Schema

**Migration**: `db/migrations/20260116_create_source_registry.sql`

- **`source_registry` table**: Tracks authoritative sources with tiered authority (1=CISA/DHS, 2=FEMA/ISC/etc, 3=ASIS/NFPA)
- **Updated `ofc_library_citations`**: Added `source_key`, `locator_type`, `locator`, `retrieved_at` columns
- **Backward compatibility**: Citations can use either `source_key` (new) or `source_id` (legacy) during migration

### 2. Citation Schema

**Citation Object Structure**:
```typescript
{
  source_key: string;        // Required: must exist in source_registry
  locator_type: 'page' | 'section' | 'paragraph' | 'url_fragment';
  locator: string;           // e.g., "p.12", "Section 3.2", "para-4", "#heading-id"
  excerpt: string;           // short supporting excerpt
  retrieved_at?: string;     // ISO date string, optional
}
```

### 3. Source Policy Configuration

**File**: `model/policy/source_policy.v1.json`

- Defines tier structure (1, 2, 3) with allowed publishers
- Lists disallowed publishers (VENDOR, BLOG, MARKETING)
- Lists disallowed scope terms (patching, EDR, firewall, etc.)
- Used for classification only (enforcement at API boundaries)

### 4. Validation & Guards

**Files**:
- `app/lib/citation/validation.ts`: Citation structure validation
- `app/lib/citation/guards.ts`: Hard guards for OFC promotion

**Guards**:
- `guardOFCRequiresCitations()`: Validates citations exist and source_keys are registered
- `guardCitationsNotEmpty()`: Ensures at least one citation
- `validateCitationSourceKeys()`: Checks source_keys exist in registry

### 5. API Endpoints

**Source Registry Management**:
- `GET /api/admin/source-registry`: List sources (with filters)
- `POST /api/admin/source-registry`: Create new source
- `GET /api/admin/source-registry/[sourceKey]`: Get specific source
- `PUT /api/admin/source-registry/[sourceKey]`: Update source
- `DELETE /api/admin/source-registry/[sourceKey]`: Delete source (if not referenced)

**OFC Library**:
- `POST /api/admin/ofc-library`: Create OFC with citations (validates citations)

**OFC Citations**:
- `GET /api/runtime/ofc-library/[ofcId]/citations`: Get citations (supports both old and new schema)

### 6. Admin UI

**Page**: `app/admin/source-registry/page.tsx`

- List all sources with filters (publisher, tier)
- Add/edit/delete sources
- Form validation for required fields
- Display tier badges and scope tags

**Navigation**: Added "Source Registry" link to AdminNav

## Enforcement

### OFC Creation/Promotion Guards

1. **OFC Library Creation** (`POST /api/admin/ofc-library`):
   - Rejects if `citations` array is empty
   - Validates citation structure
   - Validates all `source_key`s exist in `source_registry`

2. **OFC Nomination Approval** (`POST /api/ofc/nominations/[nomination_id]/decide`):
   - If citations provided in body, validates them
   - Future: Citations will be required on all promotions

### Validation Rules

- **Citation Structure**: Must have `source_key`, `locator_type`, `locator`, `excerpt`
- **Source Key**: Must exist in `source_registry` table
- **Locator Type**: Must be one of: `page`, `section`, `paragraph`, `url_fragment`
- **Minimum Citations**: At least one citation required per OFC

## Migration Path

1. Run migration: `db/migrations/20260116_create_source_registry.sql`
2. Populate `source_registry` with existing sources from `canonical_sources`
3. Update existing citations to use `source_key` (or keep `source_id` for backward compatibility)
4. New citations must use `source_key`

## Testing

**Test File**: `app/lib/citation/__tests__/validation.test.ts`

Tests cover:
- Citation structure validation
- Empty citations rejection
- Unknown source_key rejection
- Valid citations acceptance

## Next Steps

1. **Populate Source Registry**: Import existing sources from `canonical_sources` into `source_registry`
2. **Migrate Citations**: Update existing citations to use `source_key` where possible
3. **Enforce Citations**: Make citations required on all OFC promotions (not just when provided)
4. **Source Policy Enforcement**: Add UI warnings for disallowed publishers/scope terms

## Files Created/Modified

### Created
- `db/migrations/20260116_create_source_registry.sql`
- `model/policy/source_policy.v1.json`
- `app/lib/citation/validation.ts`
- `app/lib/citation/guards.ts`
- `app/lib/citation/__tests__/validation.test.ts`
- `app/api/admin/source-registry/route.ts`
- `app/api/admin/source-registry/[sourceKey]/route.ts`
- `app/api/admin/ofc-library/route.ts`
- `app/admin/source-registry/page.tsx`

### Modified
- `app/components/AdminNav.tsx` (added Source Registry link)
- `app/api/ofc/nominations/[nomination_id]/decide/route.ts` (added citation guard)
- `app/api/runtime/ofc-library/[ofcId]/citations/route.ts` (updated to support both schemas)
