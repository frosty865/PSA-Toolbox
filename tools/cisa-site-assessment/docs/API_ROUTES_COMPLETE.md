# Complete API Routes Reference

**Generated:** 2025-12-21  
**Purpose:** Comprehensive listing of all API routes and their target functions

---

## Assessment APIs

### `/api/assessments`
- **File:** `app/api/assessments/route.ts`
- **Method:** GET
- **Function:** `getAssessments()` from `@/app/lib/psaDataProvider`
- **Purpose:** List all assessments

### `/api/assessments/[assessmentId]`
- **File:** `app/api/assessments/[assessmentId]/route.ts`
- **Methods:** GET, PATCH
- **Functions:**
  - GET: `getAssessment(assessmentId)` from `@/app/lib/psaDataProvider`
  - PATCH: `saveResponse(assessmentId, element_id, response)` from `@/app/lib/psaDataProvider`
- **Purpose:** Get assessment details or save individual responses

### `/api/assessments/[assessmentId]/ofcs`
- **File:** `app/api/assessments/[assessmentId]/ofcs/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/v2/assessments/${assessmentId}/ofcs`
- **Purpose:** Get OFCs for a specific assessment (assessment-scoped)
- **Note:** Filters out deprecated element OFCs

### `/api/assessments/[assessmentId]/submit`
- **File:** `app/api/assessments/[assessmentId]/submit/route.ts`
- **Method:** POST
- **Target:** Backend Flask API: `${BACKEND_URL}/api/v2/assessments/${assessmentId}/submit`
- **Purpose:** Submit assessment for scoring

### `/api/assessments/[assessmentId]/lock`
- **File:** `app/api/assessments/[assessmentId]/lock/route.ts`
- **Method:** POST
- **Target:** Backend Flask API: `${BACKEND_URL}/api/v2/assessments/${assessmentId}/lock`
- **Purpose:** Lock assessment (prevent further edits)

### `/api/assessments/[assessmentId]/component-capability/questions`
- **File:** `app/api/assessments/[assessmentId]/component-capability/questions/route.ts`
- **Method:** GET
- **Target:** File system: `analytics/candidates/component_capability_questions.json`
- **Function:** Reads questions from JSON file
- **Purpose:** Get component capability questions for assessment
- **Note:** Returns empty array if file doesn't exist (non-blocking)

### `/api/assessments/[assessmentId]/component-capability/responses`
- **File:** `app/api/assessments/[assessmentId]/component-capability/responses/route.ts`
- **Methods:** GET, POST
- **Functions:**
  - GET: Returns empty array (responses not yet persisted to DB)
  - POST: Saves component capability response (stored separately from baseline responses)
- **Purpose:** Get/save component capability responses for assessment
- **Note:** Responses do not affect scoring, stored separately from baseline

### `/api/assessment/scoring`
- **File:** `app/api/assessment/scoring/route.ts`
- **Method:** GET
- **Function:** `getResults(documentId)` from `@/app/lib/psaDataProvider`
- **Purpose:** Get assessment scoring results (legacy route, uses documentId param)

---

## Taxonomy APIs

### `/api/sectors`
- **File:** `app/api/sectors/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT * FROM sectors ORDER BY sector_name, name`
- **Function:** Direct database query via `getPool()`
- **Purpose:** List all sectors

### `/api/subsectors`
- **File:** `app/api/subsectors/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT * FROM subsectors WHERE is_active = true`
- **Function:** Direct database query via `getPool()`
- **Query Params:** `sectorId` (optional)
- **Purpose:** List subsectors (optionally filtered by sector)

### `/api/disciplines`
- **File:** `app/api/disciplines/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT * FROM disciplines` with optional filters
- **Function:** Direct database query via `getPool()`
- **Query Params:** `category`, `active`
- **Purpose:** List disciplines with subtypes attached

### `/api/disciplines/subtypes`
- **File:** `app/api/disciplines/subtypes/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT * FROM discipline_subtypes`
- **Function:** Direct database query via `getPool()`
- **Query Params:** `subtype_id`, `discipline_id`, `active`
- **Purpose:** List discipline subtypes

### `/api/required-elements`
- **File:** `app/api/required-elements/route.ts`
- **Method:** GET
- **Target:** File system: `app/lib/fixtures/required_elements_baseline.json`
- **Function:** Loads from fixture files, filters deprecated elements
- **Purpose:** Get required elements (baseline questions)
- **Note:** Respects baseline freeze, filters deprecated elements

---

## Document APIs

### `/api/documents`
- **File:** `app/api/documents/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT * FROM coverage_runs WHERE schema_version = 'phase2_coverage.v1'`
- **Function:** Direct database query via `getPool()`
- **Purpose:** List all ingested documents with coverage metadata

### `/api/documents/[documentId]/coverage`
- **File:** `app/api/documents/[documentId]/coverage/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT raw_payload FROM coverage_runs WHERE document_id = $1`
- **Function:** Direct database query via `getPool()`
- **Purpose:** Get full coverage data for a specific document

---

## System APIs

### `/api/system/status`
- **File:** `app/api/system/status/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/system/status`
- **Purpose:** Get system status from Flask backend

### `/api/system/coverage`
- **File:** `app/api/system/coverage/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/system/coverage`
- **Purpose:** Get system coverage metrics from Flask backend
- **Note:** 10-second timeout, returns 502 for Flask 500 errors

### `/api/system/test-flask`
- **File:** `app/api/system/test-flask/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/system/status`
- **Purpose:** Test Flask backend connectivity

### `/api/db/test`
- **File:** `app/api/db/test/route.ts`
- **Method:** GET
- **Target:** Database query: `SELECT NOW(), version(), current_database()`
- **Function:** Direct database query via `getPool()`
- **Purpose:** Test database connectivity with diagnostics

### `/api/logs`
- **File:** `app/api/logs/route.ts`
- **Methods:** GET, DELETE
- **Target:** File system: `D:\PSATool\services\processor\logs`
- **Function:** Direct file system access
- **Query Params:** `file` (watcher.log, phase1.log, phase2.log, phase3.log)
- **Purpose:** Read or clear log files

---

## Utility APIs

### `/api/fixtures/[filename]`
- **File:** `app/api/fixtures/[filename]/route.ts`
- **Method:** GET
- **Target:** File system: `app/lib/fixtures/[filename].json`
- **Function:** Direct file system read
- **Purpose:** Serve fixture JSON files to client

---

## Admin APIs

### `/api/admin/coverage`
- **File:** `app/api/admin/coverage/route.ts`
- **Method:** GET
- **Target:** File system: Coverage loader from `analytics/library/`
- **Function:** `loadCoverage()` using authoritative coverage_loader.js
- **Query Params:** `sector`, `discipline`, `subtype`, `subsector`
- **Purpose:** Admin read-only coverage browser (sector-first view)

### `/api/admin/coverage/sector-subsector`
- **File:** `app/api/admin/coverage/sector-subsector/route.ts`
- **Method:** GET
- **Purpose:** Get sector/subsector coverage data

### `/api/admin/candidates`
- **File:** `app/api/admin/candidates/route.ts`
- **Method:** GET
- **Target:** File system: `analytics/candidates/`
- **Function:** Scans candidate package JSON files
- **Purpose:** List all candidate packages with metadata

### `/api/admin/candidates/[discipline]/[subtype]`
- **File:** `app/api/admin/candidates/[discipline]/[subtype]/route.ts`
- **Method:** GET
- **Target:** File system: `analytics/candidates/[discipline]/[subtype].json`
- **Purpose:** Get specific candidate package

### `/api/admin/analytics/coverage-dashboard`
- **File:** `app/api/admin/analytics/coverage-dashboard/route.ts`
- **Method:** GET
- **Target:** File system: `../psaback/tools/reports/CANONICAL_COVERAGE_DASHBOARD.json`
- **Function:** Reads canonical coverage dashboard JSON file
- **Purpose:** Coverage dashboard metrics

### `/api/admin/analytics/gap-analysis`
- **File:** `app/api/admin/analytics/gap-analysis/route.ts`
- **Method:** GET
- **Purpose:** Gap analysis data

### `/api/admin/analytics/gap-reports`
- **File:** `app/api/admin/analytics/gap-reports/route.ts`
- **Method:** GET
- **Purpose:** Gap reports

### `/api/admin/analytics/gap-candidates`
- **File:** `app/api/admin/analytics/gap-candidates/route.ts`
- **Method:** GET
- **Purpose:** Gap candidate data

### `/api/admin/analytics/canonical-content`
- **File:** `app/api/admin/analytics/canonical-content/route.ts`
- **Method:** GET
- **Purpose:** Canonical content dashboard

### `/api/admin/assessments/status`
- **File:** `app/api/admin/assessments/status/route.ts`
- **Method:** GET
- **Purpose:** Assessment status overview

### `/api/admin/library-ingestion-status`
- **File:** `app/api/admin/library-ingestion-status/route.ts`
- **Method:** GET
- **Purpose:** Library ingestion status

### `/api/admin/ofc-evidence`
- **File:** `app/api/admin/ofc-evidence/route.ts`
- **Method:** GET
- **Purpose:** OFC evidence viewer

### `/api/admin/taxonomy/disciplines`
- **File:** `app/api/admin/taxonomy/disciplines/route.ts`
- **Method:** GET
- **Target:** File system: `../psa_engine/docs/doctrine/taxonomy/disciplines.json`
- **Purpose:** Get disciplines from canonical taxonomy file

### `/api/admin/taxonomy/subtypes`
- **File:** `app/api/admin/taxonomy/subtypes/route.ts`
- **Method:** GET
- **Target:** File system: `../psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json`
- **Purpose:** Get subtypes from canonical taxonomy file

### `/api/admin/validate/baseline`
- **File:** `app/api/admin/validate/baseline/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/admin/validate/baseline`
- **Purpose:** Validate baseline questions (scope violations, forbidden terms, existence-only rules)
- **Note:** 5-second timeout, proxies to Flask backend

### `/api/admin/validate/baseline-freeze`
- **File:** `app/api/admin/validate/baseline-freeze/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/admin/validate/baseline-freeze`
- **Purpose:** Check baseline freeze readiness (gaps, violations, incomplete questions)
- **Note:** 5-second timeout, proxies to Flask backend

### `/api/admin/validate/forbidden-terms`
- **File:** `app/api/admin/validate/forbidden-terms/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/admin/validate/forbidden-terms`
- **Purpose:** Scan doctrine for forbidden lifecycle, regulatory, and out-of-scope terms
- **Note:** 5-second timeout, proxies to Flask backend

### `/api/admin/validate/compound-clauses`
- **File:** `app/api/admin/validate/compound-clauses/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/admin/validate/compound-clauses`
- **Purpose:** Validate for compound clauses
- **Note:** Proxies to Flask backend

### `/api/admin/validate/ofc-mirrors`
- **File:** `app/api/admin/validate/ofc-mirrors/route.ts`
- **Method:** GET
- **Target:** Backend Flask API: `${FLASK_BASE}/api/admin/validate/ofc-mirrors`
- **Purpose:** Validate OFC mirrors
- **Note:** Proxies to Flask backend

---

## Review APIs

### `/api/review/statements`
- **File:** `app/api/review/statements/route.ts`
- **Methods:** GET, POST
- **Target:** Backend Flask API: `${FLASK_BASE}/api/review/statements`
- **Purpose:** List or create review statements
- **Note:** Proxies to Flask backend, forwards all query parameters

### `/api/review/statements/[id]`
- **File:** `app/api/review/statements/[id]/route.ts`
- **Methods:** GET, PATCH, DELETE
- **Target:** Backend Flask API: `${FLASK_BASE}/api/review/statements/${id}`
- **Purpose:** Get, update, or delete specific review statement
- **Note:** Proxies to Flask backend

### `/api/review/statements/bulk`
- **File:** `app/api/review/statements/bulk/route.ts`
- **Method:** POST
- **Target:** Backend Flask API: `${FLASK_BASE}/api/review/statements/bulk`
- **Purpose:** Bulk operations on review statements
- **Note:** Proxies to Flask backend

---

## Reference APIs

### `/api/reference/question-focus`
- **File:** `app/api/reference/question-focus/route.ts`
- **Method:** GET
- **Purpose:** List available question focus pages

### `/api/reference/question-focus/[discipline]/[subtype]`
- **File:** `app/api/reference/question-focus/[discipline]/[subtype]/route.ts`
- **Method:** GET
- **Target:** File system: `../psa_engine/docs/reference/question_focus/[discipline]/[subtype].md`
- **Function:** Reads markdown file and converts to HTML
- **Purpose:** Get question focus page content for specific discipline/subtype
- **Note:** Converts markdown to HTML client-side

---

## Removed APIs

### `/api/ofcs/templates` ❌ DELETED
- **Status:** Removed (legacy OFC catalog concept)
- **Reason:** OFCs are assessment-scoped only, not a global catalog

---

## Summary Statistics

- **Total API Routes:** 44
- **Assessment APIs:** 8
- **Taxonomy APIs:** 5
- **Document APIs:** 2
- **System APIs:** 5
- **Utility APIs:** 1
- **Admin APIs:** 19
- **Review APIs:** 3
- **Reference APIs:** 2

---

## Data Sources

1. **Database (PostgreSQL):** Sectors, subsectors, disciplines, subtypes, documents, coverage
2. **File System:** Fixtures, taxonomy files, candidate packages, coverage library, logs
3. **Backend Flask API:** Assessment scoring, OFCs, system status, coverage metrics
4. **Local Data Provider:** `@/app/lib/psaDataProvider` - Assessment data, results

---

**Last Updated:** 2025-12-21

