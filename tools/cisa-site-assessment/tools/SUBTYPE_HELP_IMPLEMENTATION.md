# Subtype Help Implementation Guide

## Overview

Subtype help content is now derived from `taxonomy/discipline_subtypes.json` at runtime, not stored in the database. This keeps help content synchronized with taxonomy updates and avoids duplication.

## Architecture

### Source of Truth
- **File**: `taxonomy/discipline_subtypes.json`
- **Structure**: Each subtype entry can optionally include a `help` object:
  ```json
  {
    "subtype_code": "ACS_BIOMETRIC_ACCESS",
    "name": "Biometric Access",
    "help": {
      "overview": "Brief description of the capability...",
      "indicators_of_risk": ["Risk indicator 1", "Risk indicator 2"],
      "common_failures": ["Failure pattern 1", "Failure pattern 2"],
      "mitigation_guidance": ["Guidance 1", "Guidance 2"],
      "standards_references": ["Standard 1", "Standard 2"],
      "psa_notes": "Additional notes..."
    }
  }
  ```

### Runtime Lookup Module
- **File**: `app/lib/taxonomy/subtypeHelp.ts`
- **Functions**:
  - `getSubtypeHelp(subtype_code)`: Returns help object or null
  - `getSubtypeName(subtype_code)`: Returns subtype name or null
  - `getSubtypeInfo(subtype_code)`: Returns full subtype info
- **Caching**: In-memory cache (module-level) to avoid reparsing JSON per request

### Data Flow

1. **Database Query** (`baselineLoader.ts`):
   - Queries `baseline_spines_runtime` (no `help_text` column needed)
   - Returns baseline spines with `subtype_code`

2. **Runtime Enrichment** (`baselineLoader.ts`):
   - For each spine with `subtype_code`, calls `getSubtypeHelp()` and `getSubtypeName()`
   - Attaches `subtype_help` and `subtype_name` to spine object

3. **API Responses**:
   - `/api/runtime/questions`: Includes `subtype_help` and `subtype_name` in `base_questions`
   - `/api/runtime/assessments/[id]/questions`: Includes `subtype_help` and `subtype_name` via spread operator

4. **UI Display** (`app/admin/assessments/page.tsx`):
   - "View Help" button appears for questions with `subtype_help`
   - Clicking opens a modal with structured help content
   - Sections rendered conditionally (only if present)

## Files Modified

### Core Types & Loaders
- `app/lib/types/baseline.ts`: Added `SubtypeHelp` type and `subtype_help`/`subtype_name` fields
- `app/lib/baselineClient.ts`: Updated type to include `subtype_help`/`subtype_name`
- `app/lib/baselineLoader.ts`: Removed `help_text` from query, added runtime enrichment

### New Module
- `app/lib/taxonomy/subtypeHelp.ts`: Taxonomy lookup module with caching

### API Routes
- `app/api/runtime/questions/route.ts`: Returns `subtype_help` and `subtype_name`
- `app/api/runtime/assessments/[assessmentId]/questions/route.ts`: Automatically includes via spread

### UI
- `app/admin/assessments/page.tsx`: Added help modal with structured display

## Adding Help Content to Taxonomy

To add help content for a subtype, edit `taxonomy/discipline_subtypes.json`:

```json
{
  "subtype_code": "ACS_BIOMETRIC_ACCESS",
  "name": "Biometric Access",
  "help": {
    "overview": "Biometric access control systems use unique physical or behavioral characteristics...",
    "indicators_of_risk": [
      "High false rejection rates",
      "Lack of backup access methods"
    ],
    "common_failures": [
      "Sensor degradation over time",
      "Inadequate enrollment procedures"
    ],
    "mitigation_guidance": [
      "Implement multi-factor authentication",
      "Maintain backup access methods"
    ],
    "standards_references": [
      "FIPS 201",
      "NIST SP 800-63B"
    ],
    "psa_notes": "Consider environmental factors affecting sensor performance."
  }
}
```

All fields in `help` are optional. The system will render only sections that have content.

## Testing

1. **Verify Taxonomy Loading**:
   ```typescript
   import { getSubtypeHelp, getSubtypeName } from '@/app/lib/taxonomy/subtypeHelp';
   const help = getSubtypeHelp('ACS_BIOMETRIC_ACCESS');
   const name = getSubtypeName('ACS_BIOMETRIC_ACCESS');
   ```

2. **Verify API Response**:
   - Call `/api/runtime/questions?universe=BASE`
   - Check that `base_questions` include `subtype_help` and `subtype_name` for subtype-anchored questions

3. **Verify UI**:
   - Navigate to Admin → Questions tab
   - Click "View Help" for a question with help content
   - Verify modal displays all available sections

## Notes

- **No Database Changes**: Help content is not stored in `baseline_spines_runtime`
- **Optional Fields**: All help fields are optional - missing help doesn't break anything
- **Cache Invalidation**: The cache is cleared on server restart. For development, call `clearCache()` if needed
- **Performance**: In-memory cache ensures taxonomy is parsed once per server instance, not per request
