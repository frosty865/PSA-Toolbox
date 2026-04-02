# PSA Tool API - JSON Schema Files

This directory contains JSON Schema (draft-07) files for all PSA Tool API endpoints.

## Files

- `assessment-list.schema.json` - GET /api/assessments response
- `assessment-detail.schema.json` - GET /api/assessments/[id] response (context header only)
- `required-elements.schema.json` - GET /api/assessments/[id]/required_elements response
- `responses.schema.json` - GET /api/assessments/[id]/responses response
- `save-response-request.schema.json` - PATCH /api/assessments/[id]/responses request body
- `scoring-results.schema.json` - GET /api/assessment/scoring response
- `error-response.schema.json` - Error response format (all endpoints)

## Schema Overview

### Assessment List
Array of assessment metadata for the assessments list page.

### Assessment Detail (Context Header)
Context header with assessment metadata and facility information. Drives applicability context. UI does NOT derive applicability itself.

### Required Elements
Ordered list of questions for execution. Elements are:
- Rendered in ascending `order_index` order
- Grouped visually by `layer` (baseline, sector, subsector)
- Already filtered by backend/fixtures (UI does NOT filter by sector/subsector)

### Responses
Saved answers for an assessment. One response per `element_id`. Missing response = unanswered.

### Scoring Results
Read-only results view with:
- `numerator` = YES responses (counted in score)
- `denominator` = YES + NO responses (total scorable)
- `percent` = null when denominator = 0
- `status` = PASS/FAIL/N/A (display-only, computed upstream)
- UI never recomputes math

## Usage

These schemas can be used for:

1. **Validation** - Validate API responses against schemas
2. **Documentation** - Generate API documentation
3. **Testing** - Ensure fixtures match expected shapes
4. **Code Generation** - Generate TypeScript types or other language bindings

## Validation Tools

### Using ajv (Node.js)

```bash
npm install ajv
```

```javascript
const Ajv = require('ajv');
const ajv = new Ajv();
const schema = require('./scoring-results.schema.json');
const validate = ajv.compile(schema);

const data = { /* API response */ };
const valid = validate(data);
if (!valid) {
  console.error(validate.errors);
}
```

### Using jsonschema (Python)

```bash
pip install jsonschema
```

```python
import json
from jsonschema import validate

with open('scoring-results.schema.json') as f:
    schema = json.load(f)

data = { /* API response */ }
validate(instance=data, schema=schema)
```

## Schema References

All schemas use `$id` URIs for reference:
- `https://psa-tool.com/schemas/assessment-list.json`
- `https://psa-tool.com/schemas/assessment-detail.json`
- `https://psa-tool.com/schemas/required-elements.json`
- `https://psa-tool.com/schemas/responses.json`
- `https://psa-tool.com/schemas/save-response-request.json`
- `https://psa-tool.com/schemas/scoring-results.json`
- `https://psa-tool.com/schemas/error-response.json`

## Invariants (Hard Rules)

1. **UI does NOT compute scores** - All calculations done upstream
2. **UI does NOT infer applicability** - Backend/fixtures filter elements
3. **UI does NOT reorder elements** - Display in `order_index` order
4. **N/A is excluded upstream** - Not included in score calculations
5. **Missing fields are contract violations** - All required fields must be present

## See Also

- [UI_JSON_SCHEMAS.md](../UI_JSON_SCHEMAS.md) - Complete documentation with examples and TypeScript types
