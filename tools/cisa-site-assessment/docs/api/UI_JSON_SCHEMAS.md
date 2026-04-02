# PSA Tool UI - JSON Schema Definitions

This document defines the exact JSON schemas expected by the PSA Tool UI components. All backend API responses must conform to these schemas.

## Table of Contents

1. [Assessment List](#assessment-list)
2. [Assessment Detail (Context Header)](#assessment-detail-context-header)
3. [Required Elements](#required-elements)
4. [Responses](#responses)
5. [Scoring Results](#scoring-results)
6. [Invariants (Hard Rules)](#invariants-hard-rules)
7. [Versioning (Recommended)](#versioning-recommended)

---

## Assessment List

**Endpoint:** `GET /api/assessments`

**Response:** Array of assessment objects

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["assessment_id"],
    "properties": {
      "assessment_id": {
        "type": "string",
        "format": "uuid",
        "description": "Unique identifier for the assessment"
      },
      "facility_name": {
        "type": ["string", "null"],
        "description": "Name of the facility being assessed"
      },
      "sector": {
        "type": ["string", "null"],
        "description": "Sector name if assessment includes sector-specific questions"
      },
      "subsector": {
        "type": ["string", "null"],
        "description": "Subsector name if assessment includes subsector-specific questions"
      },
      "created_at": {
        "type": ["string", "null"],
        "format": "date-time",
        "description": "ISO 8601 timestamp when assessment was created"
      },
      "updated_at": {
        "type": ["string", "null"],
        "format": "date-time",
        "description": "ISO 8601 timestamp when assessment was last updated"
      }
    },
    "additionalProperties": false
  }
}
```

### Example

```json
[
  {
    "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
    "facility_name": "Sample Facility",
    "sector": "Healthcare and Public Health",
    "subsector": null,
    "created_at": "2025-12-15T10:00:00Z",
    "updated_at": "2025-12-15T10:00:00Z"
  }
]
```

---

## Assessment Detail (Context Header)

**Endpoint:** `GET /api/assessments/[assessmentId]` (metadata only)

**Response:** Assessment context header

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["assessment_id", "name", "facility", "status"],
  "properties": {
    "assessment_id": {
      "type": "string",
      "format": "uuid",
      "description": "Unique identifier for the assessment"
    },
    "name": {
      "type": "string",
      "description": "Assessment name",
      "minLength": 1
    },
    "facility": {
      "type": "object",
      "required": ["sector_id", "sector_name", "subsector_id", "subsector_name"],
      "properties": {
        "sector_id": {
          "type": ["string", "null"],
          "format": "uuid",
          "description": "UUID of the sector, or null if baseline-only"
        },
        "sector_name": {
          "type": ["string", "null"],
          "description": "Name of the sector, or null if baseline-only"
        },
        "subsector_id": {
          "type": ["string", "null"],
          "format": "uuid",
          "description": "UUID of the subsector, or null if no subsector"
        },
        "subsector_name": {
          "type": ["string", "null"],
          "description": "Name of the subsector, or null if no subsector"
        }
      },
      "additionalProperties": false
    },
    "status": {
      "type": "string",
      "enum": ["draft", "completed"],
      "description": "Assessment status"
    }
  },
  "additionalProperties": false
}
```

### Example

```json
{
  "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Sample Facility Assessment",
  "facility": {
    "sector_id": "660e8400-e29b-41d4-a716-446655440001",
    "sector_name": "Healthcare and Public Health",
    "subsector_id": null,
    "subsector_name": null
  },
  "status": "draft"
}
```

### UI Expectations

- **Drives applicability context** - UI uses this to determine which layers are applicable
- **UI does NOT derive applicability itself** - All applicability logic is backend-driven

---

## Required Elements

**Endpoint:** `GET /api/assessments/[assessmentId]/required_elements` (or combined with detail)

**Response:** Ordered list of required elements (questions)

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["required_elements"],
  "properties": {
    "required_elements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "element_id",
          "element_code",
          "layer",
          "title",
          "question_text",
          "discipline_id",
          "discipline_name",
          "discipline_subtype_id",
          "discipline_subtype_name",
          "sector_id",
          "subsector_id",
          "order_index"
        ],
        "properties": {
          "element_id": {
            "type": "string",
            "format": "uuid",
            "description": "Unique identifier for the element"
          },
          "element_code": {
            "type": "string",
            "description": "Human-readable element code (e.g., 'BASE-001', 'SECTOR-005')",
            "minLength": 1
          },
          "layer": {
            "type": "string",
            "enum": ["baseline", "sector", "subsector"],
            "description": "Assessment layer this element belongs to"
          },
          "title": {
            "type": "string",
            "description": "Short title/name of the required element",
            "minLength": 1
          },
          "question_text": {
            "type": "string",
            "description": "Full question text to display to the assessor",
            "minLength": 1
          },
          "discipline_id": {
            "type": "string",
            "format": "uuid",
            "description": "UUID of the discipline"
          },
          "discipline_name": {
            "type": "string",
            "description": "Name of the discipline",
            "minLength": 1
          },
          "discipline_subtype_id": {
            "type": "string",
            "format": "uuid",
            "description": "UUID of the discipline subtype"
          },
          "discipline_subtype_name": {
            "type": "string",
            "description": "Name of the discipline subtype",
            "minLength": 1
          },
          "sector_id": {
            "type": ["string", "null"],
            "format": "uuid",
            "description": "UUID of the sector this element applies to, or null for baseline"
          },
          "subsector_id": {
            "type": ["string", "null"],
            "format": "uuid",
            "description": "UUID of the subsector this element applies to, or null if not subsector-specific"
          },
          "order_index": {
            "type": "integer",
            "description": "Display order within the layer (ascending)",
            "minimum": 0
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### Example

```json
{
  "required_elements": [
    {
      "element_id": "770e8400-e29b-41d4-a716-446655440002",
      "element_code": "BASE-001",
      "layer": "baseline",
      "title": "Security Responsibility Designation",
      "question_text": "The facility has a designated individual responsible for security.",
      "discipline_id": "880e8400-e29b-41d4-a716-446655440003",
      "discipline_name": "Security Management & Governance",
      "discipline_subtype_id": "990e8400-e29b-41d4-a716-446655440004",
      "discipline_subtype_name": "Governance",
      "sector_id": null,
      "subsector_id": null,
      "order_index": 0
    }
  ]
}
```

### UI Expectations

- **Render in ascending order_index** - Elements must be displayed in order_index order
- **Group visually by layer** - UI groups elements by `layer` field (baseline, sector, subsector)
- **UI does NOT filter by sector/subsector** - Backend/fixtures already filter elements based on assessment context
- **All fields required** - Missing fields are contract violations

---

## Responses

**Endpoint:** `GET /api/assessments/[assessmentId]/responses` (or combined with detail)

**Response:** Saved answers for an assessment

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["responses"],
  "properties": {
    "responses": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["assessment_id", "element_id", "response", "updated_at"],
        "properties": {
          "assessment_id": {
            "type": "string",
            "format": "uuid",
            "description": "UUID of the assessment"
          },
          "element_id": {
            "type": "string",
            "format": "uuid",
            "description": "UUID of the element being answered"
          },
          "response": {
            "type": "string",
            "enum": ["YES", "NO", "N/A"],
            "description": "The response value"
          },
          "updated_at": {
            "type": "string",
            "format": "date-time",
            "description": "ISO 8601 timestamp when response was last updated"
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### Example

```json
{
  "responses": [
    {
      "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
      "element_id": "770e8400-e29b-41d4-a716-446655440002",
      "response": "YES",
      "updated_at": "2025-12-15T10:30:00Z"
    },
    {
      "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
      "element_id": "aa0e8400-e29b-41d4-a716-446655440005",
      "response": "NO",
      "updated_at": "2025-12-15T10:35:00Z"
    }
  ]
}
```

### UI Expectations

- **One response per element_id** - Each element should have at most one response
- **Missing response = unanswered** - If an element_id has no response, the question is unanswered
- **UI enforces enum only** - UI only allows "YES", "NO", or "N/A" values

---

## Scoring Results

**Endpoint:** `GET /api/assessment/scoring?documentId=[assessmentId]`

**Response:** Read-only scoring results

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["baseline"],
  "definitions": {
    "disciplineResult": {
      "type": "object",
      "required": [
        "discipline_id",
        "discipline_name",
        "numerator",
        "denominator",
        "percent",
        "status"
      ],
      "properties": {
        "discipline_id": {
          "type": "string",
          "format": "uuid"
        },
        "discipline_name": {
          "type": "string",
          "minLength": 1
        },
        "numerator": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of YES responses (counted in score)"
        },
        "denominator": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of YES + NO responses (total scorable)"
        },
        "percent": {
          "type": ["number", "null"],
          "minimum": 0,
          "maximum": 100,
          "description": "Percentage score (numerator / denominator * 100). null when denominator = 0."
        },
        "status": {
          "type": "string",
          "enum": ["PASS", "FAIL", "N/A"],
          "description": "Display status (computed upstream)"
        }
      },
      "additionalProperties": false
    },
    "summaryResult": {
      "type": "object",
      "required": ["numerator", "denominator", "percent"],
      "properties": {
        "numerator": {
          "type": "integer",
          "minimum": 0
        },
        "denominator": {
          "type": "integer",
          "minimum": 0
        },
        "percent": {
          "type": ["number", "null"],
          "minimum": 0,
          "maximum": 100
        }
      },
      "additionalProperties": false
    },
    "baselineResults": {
      "type": "object",
      "required": ["disciplines", "summary"],
      "properties": {
        "disciplines": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/disciplineResult"
          }
        },
        "summary": {
          "$ref": "#/definitions/summaryResult"
        }
      },
      "additionalProperties": false
    },
    "sectorResults": {
      "type": "object",
      "required": ["sector_id", "sector_name", "disciplines", "summary"],
      "properties": {
        "sector_id": {
          "type": "string",
          "format": "uuid"
        },
        "sector_name": {
          "type": "string",
          "minLength": 1
        },
        "disciplines": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/disciplineResult"
          }
        },
        "summary": {
          "$ref": "#/definitions/summaryResult"
        }
      },
      "additionalProperties": false
    }
  },
  "properties": {
    "baseline": {
      "$ref": "#/definitions/baselineResults"
    },
    "sector": {
      "oneOf": [
        {
          "$ref": "#/definitions/sectorResults"
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "additionalProperties": false
}
```

### Example (Baseline Only)

```json
{
  "baseline": {
    "disciplines": [
      {
        "discipline_id": "880e8400-e29b-41d4-a716-446655440003",
        "discipline_name": "Security Management & Governance",
        "numerator": 2,
        "denominator": 3,
        "percent": 66.7,
        "status": "PASS"
      }
    ],
    "summary": {
      "numerator": 2,
      "denominator": 3,
      "percent": 66.7
    }
  },
  "sector": null
}
```

### Example (With Sector)

```json
{
  "baseline": {
    "disciplines": [
      {
        "discipline_id": "880e8400-e29b-41d4-a716-446655440003",
        "discipline_name": "Security Management & Governance",
        "numerator": 3,
        "denominator": 3,
        "percent": 100.0,
        "status": "PASS"
      }
    ],
    "summary": {
      "numerator": 3,
      "denominator": 3,
      "percent": 100.0
    }
  },
  "sector": {
    "sector_id": "660e8400-e29b-41d4-a716-446655440001",
    "sector_name": "Healthcare and Public Health",
    "disciplines": [
      {
        "discipline_id": "bb0e8400-e29b-41d4-a716-446655440006",
        "discipline_name": "Healthcare Security",
        "numerator": 0,
        "denominator": 1,
        "percent": 0.0,
        "status": "FAIL"
      }
    ],
    "summary": {
      "numerator": 0,
      "denominator": 1,
      "percent": 0.0
    }
  }
}
```

### UI Expectations

- **sector block may be null or omitted** - For baseline-only assessments, `sector` is `null`
- **percent = null when denominator = 0** - UI displays "N/A" for null percentages
- **UI never recomputes math** - All calculations are done upstream
- **Status is display-only** - UI displays status but does not compute it

---

## Invariants (Hard Rules)

The following MUST always be true:

### 1. UI does NOT compute scores
- All scoring calculations (numerator, denominator, percent, status) are computed upstream
- UI only displays values provided by the backend

### 2. UI does NOT infer applicability
- Applicability (which elements apply to which assessments) is determined by the backend
- UI uses `assessment_detail.json` facility context to display, but does not filter elements
- Backend/fixtures already filter `required_elements` based on assessment context

### 3. UI does NOT reorder elements
- Elements are displayed in `order_index` order (ascending)
- UI groups by `layer` but maintains order within each layer

### 4. N/A is excluded upstream, not in UI
- N/A responses are excluded from scoring calculations by the backend
- UI displays N/A responses but does not include them in score calculations

### 5. Missing fields are treated as contract violations
- All required fields must be present
- Missing required fields should result in error responses, not UI workarounds

---

## Versioning (Recommended)

Optionally wrap payloads with version metadata:

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["api_version", "payload"],
  "properties": {
    "api_version": {
      "type": "string",
      "pattern": "^v\\d+$",
      "description": "API version (e.g., 'v1', 'v2')"
    },
    "payload": {
      "type": "object",
      "description": "The actual response data"
    }
  },
  "additionalProperties": false
}
```

### Example

```json
{
  "api_version": "v2",
  "payload": {
    "assessment_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sample Assessment",
    "facility": {
      "sector_id": null,
      "sector_name": null,
      "subsector_id": null,
      "subsector_name": null
    },
    "status": "draft"
  }
}
```

### UI Expectations

- **UI must fail loudly if version mismatches** - If `api_version` is present and does not match expected version, UI should display an error
- Version checking is optional - If `api_version` is not present, UI proceeds normally

---

## Save Response Request

**Endpoint:** `PATCH /api/assessments/[assessmentId]/responses`

**Request Body:** Single response update

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["element_id", "response"],
  "properties": {
    "element_id": {
      "type": "string",
      "format": "uuid"
    },
    "response": {
      "type": "string",
      "enum": ["YES", "NO", "N/A"]
    }
  },
  "additionalProperties": false
}
```

### Example

```json
{
  "element_id": "770e8400-e29b-41d4-a716-446655440002",
  "response": "YES"
}
```

---

## Error Responses

All endpoints may return error responses:

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["error"],
  "properties": {
    "error": {
      "type": "string",
      "minLength": 1
    },
    "details": {
      "type": ["string", "null"]
    }
  },
  "additionalProperties": true
}
```

### HTTP Status Codes

- `400` - Bad Request (invalid request body or parameters)
- `404` - Not Found (assessment or resource not found)
- `500` - Internal Server Error (server-side error)
- `503` - Service Unavailable (backend unavailable)

---

## TypeScript Type Definitions

For reference, here are the TypeScript interfaces:

```typescript
// Assessment List Item
interface Assessment {
  assessment_id: string; // UUID
  facility_name?: string | null;
  sector?: string | null;
  subsector?: string | null;
  created_at?: string | null; // ISO 8601
  updated_at?: string | null; // ISO 8601
}

// Assessment Detail (Context Header)
interface AssessmentDetail {
  assessment_id: string; // UUID
  name: string;
  facility: {
    sector_id: string | null; // UUID
    sector_name: string | null;
    subsector_id: string | null; // UUID
    subsector_name: string | null;
  };
  status: "draft" | "completed";
}

// Required Element
interface RequiredElement {
  element_id: string; // UUID
  element_code: string;
  layer: "baseline" | "sector" | "subsector";
  title: string;
  question_text: string;
  discipline_id: string; // UUID
  discipline_name: string;
  discipline_subtype_id: string; // UUID
  discipline_subtype_name: string;
  sector_id: string | null; // UUID
  subsector_id: string | null; // UUID
  order_index: number;
}

// Response
interface Response {
  assessment_id: string; // UUID
  element_id: string; // UUID
  response: "YES" | "NO" | "N/A";
  updated_at: string; // ISO 8601
}

// Scoring Results
interface DisciplineResult {
  discipline_id: string; // UUID
  discipline_name: string;
  numerator: number;
  denominator: number;
  percent: number | null;
  status: "PASS" | "FAIL" | "N/A";
}

interface SummaryResult {
  numerator: number;
  denominator: number;
  percent: number | null;
}

interface ScoringResults {
  baseline: {
    disciplines: DisciplineResult[];
    summary: SummaryResult;
  };
  sector?: {
    sector_id: string; // UUID
    sector_name: string;
    disciplines: DisciplineResult[];
    summary: SummaryResult;
  } | null;
}
```

---

## Version History

- **v2.0** (2025-12-15) - Updated to match new schema requirements:
  - Separate assessment_detail.json (context header)
  - Separate required_elements.json with full discipline/subtype info
  - Separate responses.json
  - Scoring uses numerator/denominator instead of yes/no/na counts
  - Added status field to scoring results
  - All IDs are UUIDs
  - Added order_index to required elements
- **v1.0** (2025-12-15) - Initial schema definitions
