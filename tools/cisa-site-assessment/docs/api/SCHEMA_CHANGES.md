# JSON Schema Updates - v2.0

## Summary

Schemas have been updated to match the new API contract requirements. Key changes:

## Major Changes

### 1. Assessment Detail Split
- **Before:** Single endpoint returning metadata + required_elements + responses
- **After:** Separate endpoints:
  - `GET /api/assessments/[id]` → `assessment_detail.json` (context header only)
  - `GET /api/assessments/[id]/required_elements` → `required_elements.json`
  - `GET /api/assessments/[id]/responses` → `responses.json`

### 2. Assessment Detail Structure
- **Before:** Simple metadata with optional sector/subsector strings
- **After:** Structured `facility` object with UUIDs:
  ```json
  {
    "assessment_id": "uuid",
    "name": "string",
    "facility": {
      "sector_id": "uuid | null",
      "sector_name": "string | null",
      "subsector_id": "uuid | null",
      "subsector_name": "string | null"
    },
    "status": "draft | completed"
  }
  ```

### 3. Required Elements Enhanced
- **Added fields:**
  - `discipline_id` (UUID)
  - `discipline_name` (string)
  - `discipline_subtype_id` (UUID)
  - `discipline_subtype_name` (string)
  - `sector_id` (UUID | null)
  - `subsector_id` (UUID | null)
  - `order_index` (integer) - **NEW: Required for ordering**

### 4. Responses Separated
- **Before:** Responses embedded in assessment detail
- **After:** Separate `responses.json` with array of response objects

### 5. Scoring Results Restructured
- **Before:** Used `yes`, `no`, `na` counts
- **After:** Uses `numerator`, `denominator`, `percent`, `status`:
  ```json
  {
    "discipline_id": "uuid",
    "discipline_name": "string",
    "numerator": 0,        // YES responses (counted)
    "denominator": 0,      // YES + NO responses (scorable)
    "percent": null,       // null when denominator = 0
    "status": "PASS | FAIL | N/A"
  }
  ```

### 6. All IDs are UUIDs
- All `*_id` fields now use `format: "uuid"` instead of generic strings

## New Files

- `required-elements.schema.json` - New schema for required elements endpoint
- `responses.schema.json` - New schema for responses endpoint

## Updated Files

- `assessment-detail.schema.json` - Now context header only
- `scoring-results.schema.json` - Restructured with numerator/denominator
- `assessment-list.schema.json` - Updated to use UUID format

## Removed Concepts

- **Findings array** - No longer in scoring results (UI can derive from responses)
- **Subtypes in scoring** - Simplified structure (can be added back if needed)
- **Combined endpoints** - All data sources are now separate

## Invariants (Hard Rules)

These rules are now explicitly documented:

1. **UI does NOT compute scores** - All math done upstream
2. **UI does NOT infer applicability** - Backend filters elements
3. **UI does NOT reorder elements** - Display in `order_index` order
4. **N/A excluded upstream** - Not in score calculations
5. **Missing fields = contract violation** - All required fields must be present

## Versioning

Optional versioning wrapper added:
```json
{
  "api_version": "v2",
  "payload": { ... }
}
```

UI must fail loudly on version mismatch.

## Migration Notes

### For Backend Developers

1. Split assessment detail endpoint into three:
   - Context header (assessment_detail.json)
   - Required elements (required_elements.json)
   - Responses (responses.json)

2. Update scoring to use numerator/denominator:
   - `numerator` = count of YES responses
   - `denominator` = count of YES + NO responses
   - `percent` = (numerator / denominator) * 100, or null if denominator = 0

3. Add `order_index` to all required elements

4. Convert all IDs to UUIDs

5. Add `status` field to scoring results (PASS/FAIL/N/A)

### For Frontend Developers

1. Update TypeScript interfaces to match new schemas
2. Update data fetching to use separate endpoints
3. Remove any score calculation logic (use backend values)
4. Remove any filtering logic (backend already filters)
5. Sort elements by `order_index` instead of any client-side logic

## See Also

- [UI_JSON_SCHEMAS.md](./UI_JSON_SCHEMAS.md) - Complete documentation
- [schemas/README.md](./schemas/README.md) - Schema file usage guide
