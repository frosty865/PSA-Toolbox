# PSA System API Contract (v1)

**Version:** 1.0  
**Date:** 2025-12-21  
**Status:** AUTHORITATIVE

---

## 1. Overview

### Purpose

The PSA API provides programmatic access to Protective Security Assessment functionality. It enables assessment execution, reference data access, and governance visibility.

### Core Design Principles

1. **Truth-first**: API reflects authoritative sources of truth (taxonomy, baseline registry, database)
2. **Read-only by default**: Most endpoints are read-only; mutations are limited to assessment execution
3. **Separation of concerns**: Clear boundaries between runtime, reference, and governance
4. **No engineering tools**: Engineering/debugging tools are explicitly excluded from this contract

### Authority

**This contract is authoritative.** All API endpoints must conform to this specification. Endpoints not documented here are not part of the public API contract.

---

## 2. Namespaces

The API is organized into three namespaces, each with distinct purposes and rules.

---

### 2.1 /api/runtime

**Purpose:** Assessment execution only  
**Scope:** Assessment-scoped operations  
**Mutations:** Allowed only within an active assessment context

#### Rules

- All routes require assessment context (assessmentId parameter)
- No cross-assessment queries
- No filesystem access
- No admin or governance concepts
- Mutations limited to assessment responses and state changes

#### Endpoints

##### GET /api/runtime/assessments

**Methods:** GET  
**Description:** List all assessments  
**Mutation Allowed:** NO  
**Response:** Array of assessment objects with metadata (facility, sector, subsector, status)

---

##### GET /api/runtime/assessments/[assessmentId]

**Methods:** GET  
**Description:** Get assessment details for a specific assessment  
**Mutation Allowed:** NO  
**Response:** Assessment object with metadata, questions, and current responses

---

##### PATCH /api/runtime/assessments/[assessmentId]

**Methods:** PATCH  
**Description:** Save a response to a single assessment question  
**Mutation Allowed:** YES  
**Request Body:**
```json
{
  "element_id": "string",
  "response": "YES" | "NO" | "N/A"
}
```
**Response:** Confirmation of saved response

**Validation:**
- `element_id` required
- `response` must be exactly "YES", "NO", or "N/A"
- Assessment must exist and be unlocked

---

##### GET /api/runtime/assessments/[assessmentId]/ofcs

**Methods:** GET  
**Description:** Get Outcome-Focused Criteria (OFCs) for a specific assessment  
**Mutation Allowed:** NO  
**Response:** Array of OFC objects filtered for the assessment context

**Notes:**
- OFCs are filtered to exclude deprecated elements
- Assessment-scoped (only OFCs relevant to the assessment)

---

##### POST /api/runtime/assessments/[assessmentId]/submit

**Methods:** POST  
**Description:** Submit assessment for scoring  
**Mutation Allowed:** YES  
**Response:** Submission confirmation

**Side Effects:**
- Assessment status changes to SUBMITTED
- Scoring is triggered (asynchronous)

---

##### POST /api/runtime/assessments/[assessmentId]/lock

**Methods:** POST  
**Description:** Lock assessment to prevent further edits  
**Mutation Allowed:** YES  
**Response:** Lock confirmation

**Side Effects:**
- Assessment status changes to LOCKED
- No further responses can be saved

---

##### GET /api/runtime/assessments/[assessmentId]/component-capability/questions

**Methods:** GET  
**Description:** Get component capability questions for an assessment  
**Mutation Allowed:** NO  
**Response:** Array of component capability questions

**Source:** `analytics/candidates/component_capability_questions.json`  
**Notes:**
- Returns empty array if file doesn't exist (non-blocking)
- Questions are separate from baseline questions
- Do not affect scoring

---

##### GET /api/runtime/assessments/[assessmentId]/component-capability/responses

**Methods:** GET  
**Description:** Get component capability responses for an assessment  
**Mutation Allowed:** NO  
**Response:** Array of component capability responses

**Notes:**
- Currently returns empty array (responses not yet persisted)
- Responses are stored separately from baseline responses
- Do not affect scoring

---

##### POST /api/runtime/assessments/[assessmentId]/component-capability/responses

**Methods:** POST  
**Description:** Save a component capability response  
**Mutation Allowed:** YES  
**Request Body:**
```json
{
  "component_code": "string",
  "response": "YES" | "NO" | "N/A"
}
```
**Response:** Confirmation of saved response

**Validation:**
- `component_code` required
- `response` must be exactly "YES", "NO", or "N/A"

**Notes:**
- Responses do not affect scoring
- Stored separately from baseline responses

---

##### GET /api/runtime/documents

**Methods:** GET  
**Description:** List all ingested documents  
**Mutation Allowed:** NO  
**Response:** Array of document objects with metadata (document_id, filename, ingested_at, coverage_percent, disciplines_covered, disciplines_total)

**Source:** Database query from `coverage_runs` table

---

##### GET /api/runtime/documents/[documentId]/coverage

**Methods:** GET  
**Description:** Get coverage data for a specific document  
**Mutation Allowed:** NO  
**Response:** Coverage payload object (raw payload from database)

**Source:** Database query from `coverage_runs` table  
**Schema:** `phase2_coverage.v1`

---

### 2.2 /api/reference

**Purpose:** Frozen, authoritative data  
**Scope:** Read-only reference material  
**Mutations:** None allowed

#### Rules

- No mutation operations
- No execution or processing
- No inference or computation
- No side effects
- Deterministic responses (same input = same output)

#### Endpoints

##### GET /api/reference/sectors

**Methods:** GET  
**Description:** List all sectors  
**Mutation Allowed:** NO  
**Source of Truth:** Database `sectors` table  
**Response:** Array of sector objects (id, sector_name, name, description, is_active)

**Notes:**
- Ordered by sector_name, name
- All sectors returned (no filtering)

---

##### GET /api/reference/subsectors

**Methods:** GET  
**Description:** List subsectors, optionally filtered by sector  
**Mutation Allowed:** NO  
**Source of Truth:** Database `subsectors` table  
**Query Parameters:**
- `sectorId` (optional): Filter by sector ID

**Response:** Array of subsector objects (id, name, sector_id, description, is_active)

**Notes:**
- Only active subsectors returned
- Code-only subsectors (short alphanumeric names) are filtered out

---

##### GET /api/reference/disciplines

**Methods:** GET  
**Description:** List disciplines with subtypes attached  
**Mutation Allowed:** NO  
**Source of Truth:** Database `disciplines` and `discipline_subtypes` tables  
**Query Parameters:**
- `category` (optional): Filter by discipline category
- `active` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "disciplines": [
    {
      "id": "uuid",
      "name": "string",
      "code": "string",
      "description": "string",
      "category": "string",
      "is_active": boolean,
      "discipline_subtypes": [...]
    }
  ]
}
```

**Notes:**
- Disciplines are deduplicated by ID and name
- Subtypes are grouped by discipline_id
- Ordered by category, name

---

##### GET /api/reference/discipline-subtypes

**Methods:** GET  
**Description:** List discipline subtypes  
**Mutation Allowed:** NO  
**Source of Truth:** Database `discipline_subtypes` table  
**Query Parameters:**
- `subtype_id` (optional): Filter by subtype ID
- `discipline_id` (optional): Filter by discipline ID
- `active` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "subtypes": [...]
}
```

**Notes:**
- Returns all columns including extended fields (overview, indicators_of_risk, etc.)
- Falls back to basic columns if extended fields don't exist
- Ordered by name

---

##### GET /api/reference/question-focus

**Methods:** GET  
**Description:** List available baseline question focus pages  
**Mutation Allowed:** NO  
**Source of Truth:** Markdown files from `psa-engine/docs/reference/question_focus/`  
**Response:**
```json
{
  "pages": [
    {
      "discipline": "string",
      "subtype": "string",
      "path": "string"
    }
  ]
}
```

**Notes:**
- Baseline scope only
- Read-only reference material
- Returns empty array if directory doesn't exist

---

##### GET /api/reference/question-focus/[discipline]/[subtype]

**Methods:** GET  
**Description:** Get question focus page content for a specific discipline/subtype  
**Mutation Allowed:** NO  
**Source of Truth:** Markdown file from `psa-engine/docs/reference/question_focus/[discipline]/[subtype].md`  
**Response:**
```json
{
  "content": "string (HTML rendered from markdown)"
}
```

**Notes:**
- Markdown is converted to HTML
- Baseline scope only
- Read-only reference material
- Returns 404 if file doesn't exist

---

### 2.3 /api/admin

**Purpose:** Governance visibility only  
**Scope:** Read-only status and summaries  
**Mutations:** None allowed

#### Rules

- No execution operations
- No validation triggers
- No raw artifact exposure
- No filesystem browsing
- Summary-level data only (no detailed dumps)

#### Endpoints

##### GET /api/admin/status

**Methods:** GET  
**Description:** Get assessment status summary for governance oversight  
**Mutation Allowed:** NO  
**Data Returned:** Summary-level statistics

**Response:**
```json
{
  "total": number,
  "by_status": {
    "DRAFT": number,
    "IN_PROGRESS": number,
    "SUBMITTED": number,
    "LOCKED": number
  },
  "locked": number,
  "unlocked": number,
  "doctrine_versions": string[]
}
```

**Notes:**
- Aggregated statistics only
- No individual assessment details
- Doctrine versions tracked (baseline, sector, subsector, ofc)

---

##### GET /api/admin/coverage-summary

**Methods:** GET  
**Description:** Get sector/subsector coverage summary for governance oversight  
**Mutation Allowed:** NO  
**Data Returned:** Summary-level coverage statistics

**Response:** Coverage data from backend (sector/subsector coverage statistics)

**Notes:**
- Proxies to Flask backend: `/api/admin/coverage/sector-subsector`
- Summary-level data only
- 10-second timeout
- Returns 503 if backend unavailable

---

## 3. Authentication & Authorization (Conceptual)

### Runtime Endpoints

**Authentication:** Required  
**Context:** Authenticated assessor context  
**Authorization:** Access limited to assessments the user is authorized to view/edit

### Reference Endpoints

**Authentication:** Required  
**Context:** Authenticated user context  
**Authorization:** Read-only access (no write permissions needed)

### Admin Endpoints

**Authentication:** Required  
**Context:** Governance role required  
**Authorization:** Governance-level access for status visibility

### Engineering Tools

**Explicitly Excluded:** Engineering tools, debugging endpoints, and system diagnostics are not part of this API contract and are not documented here.

---

## 4. Stability Guarantees

### Stable Endpoints

The following are considered stable and will not change without versioning:

- **Reference endpoints:** All `/api/reference/*` endpoints are stable
- **Runtime assessment endpoints:** Core assessment execution endpoints are stable
- **Response formats:** Response schemas for stable endpoints will not change without versioning

### May Change

The following may change between versions:

- **Admin endpoints:** May be added, removed, or modified based on governance needs
- **Error response formats:** Error message structures may be refined
- **Query parameters:** Additional optional query parameters may be added

### Versioning Expectations

- Breaking changes require version increment
- Non-breaking additions (new optional parameters, new fields) do not require version increment
- Deprecated endpoints will be marked with deprecation notices before removal

---

## 5. Explicit Non-Goals

The PSA API will **NEVER** provide:

1. **AI Inference:** No AI/LLM inference endpoints
2. **Doctrine Editing:** No endpoints for creating, modifying, or deleting doctrine content
3. **OFC Governance Actions:** No endpoints for OFC approval, rejection, or modification
4. **Engineering Tooling:** No debugging, testing, or diagnostic endpoints (excluded from contract)
5. **Filesystem Browsing:** No endpoints for browsing or accessing raw filesystem paths
6. **Raw Artifact Exposure:** Admin endpoints return summaries only, not raw artifacts
7. **Cross-Assessment Queries:** Runtime endpoints are assessment-scoped only
8. **Validation Triggers:** Admin endpoints are read-only; no validation execution

---

## 6. Change Control

### Contract Modifications

**Process:**
1. Proposed changes must be documented
2. Breaking changes require version increment
3. Changes must align with baseline and governance rules
4. Changes must be reviewed and approved

### Versioning

- **Major version:** Breaking changes (removed endpoints, changed response schemas)
- **Minor version:** New endpoints, new optional parameters
- **Patch version:** Bug fixes, documentation updates

### Alignment Requirements

- API changes must align with baseline freeze status
- API changes must respect governance boundaries
- API changes must not violate separation of concerns (runtime/reference/admin)

---

## Appendix: Response Enums

### Assessment Response Values

**Valid Values:** `"YES"`, `"NO"`, `"N/A"`

**Enforcement:**
- All assessment response endpoints validate these exact values
- Case-sensitive
- No other values accepted

---

**END OF API CONTRACT**

