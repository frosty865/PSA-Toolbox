# API Route Triage v2 (Corrected)

**Generated:** 2025-12-21  
**Purpose:** Architecture-aligned classification of all API routes  
**Action:** CLASSIFICATION CORRECTION ONLY - NO MODIFICATIONS

---

## Summary Statistics

- **Total Routes:** 45
- **KEEP:** 20 (44.4%)
- **MOVE:** 15 (33.3%)
- **DEPRECATE:** 3 (6.7%)
- **ENGINEERING_ONLY:** 10 (22.2%)

---

## Classification Legend

- **KEEP**: Routes actively used by runtime application, reference pages, or read-only admin status
- **MOVE**: Routes that should be relocated to backend repositories (psa_engine, psaback) due to filesystem access or incorrect layering
- **DEPRECATE**: Legacy routes referencing deprecated concepts (BASE-0xx, required elements) or conflicting with new architecture
- **ENGINEERING_ONLY**: Routes for debugging, testing, validation execution, or internal tooling only

---

## Triage Results

| Route | Methods | Audience | Classification | Rationale |
|-------|---------|----------|----------------|-----------|
| `/api/assessments` | GET | Runtime | KEEP | Core runtime - lists all assessments for dashboard |
| `/api/assessments/[assessmentId]` | GET, PATCH | Runtime | KEEP | Core runtime - get assessment details and save responses |
| `/api/assessments/[assessmentId]/ofcs` | GET | Runtime | KEEP | Core runtime - get OFCs for assessment execution (assessment-scoped) |
| `/api/assessments/[assessmentId]/submit` | POST | Runtime | KEEP | Core runtime - submit assessment for scoring |
| `/api/assessments/[assessmentId]/lock` | POST | Runtime | KEEP | Core runtime - lock assessment to prevent edits |
| `/api/assessments/[assessmentId]/component-capability/questions` | GET | Runtime | KEEP | Core runtime - component capability questions for assessment |
| `/api/assessments/[assessmentId]/component-capability/responses` | GET, POST | Runtime | KEEP | Core runtime - component capability responses for assessment |
| `/api/assessment/scoring` | GET | Runtime | DEPRECATE | Legacy route using documentId param; conflicts with assessment-scoped architecture |
| `/api/sectors` | GET | Runtime | KEEP | Core taxonomy - used by sector selection and filtering |
| `/api/subsectors` | GET | Runtime | KEEP | Core taxonomy - used by subsector selection and filtering |
| `/api/disciplines` | GET | Runtime | KEEP | Core taxonomy - used by discipline selection and filtering |
| `/api/disciplines/subtypes` | GET | Runtime | KEEP | Core taxonomy - used by subtype selection and filtering |
| `/api/required-elements` | GET | Runtime | DEPRECATE | References deprecated BASE-0xx required elements concept; superseded by baseline questions |
| `/api/documents` | GET | Runtime | KEEP | Core runtime - list ingested documents for document browser |
| `/api/documents/[documentId]/coverage` | GET | Runtime | KEEP | Core runtime - get coverage data for document viewer |
| `/api/system/status` | GET | Engineering | ENGINEERING_ONLY | System diagnostics - Flask backend health check |
| `/api/system/coverage` | GET | Engineering | ENGINEERING_ONLY | System diagnostics - coverage metrics for monitoring |
| `/api/system/test-flask` | GET | Engineering | ENGINEERING_ONLY | Testing tool - Flask connectivity test |
| `/api/db/test` | GET | Engineering | ENGINEERING_ONLY | Testing tool - database connectivity diagnostics |
| `/api/logs` | GET, DELETE | Engineering | ENGINEERING_ONLY | Debugging tool - log file access and clearing |
| `/api/fixtures/[filename]` | GET | Runtime | DEPRECATE | Legacy fixture serving; should use direct imports or proper data provider |
| `/api/admin/coverage` | GET | Admin | MOVE | Reads filesystem directly from psa_engine; should be backend API in psa_engine |
| `/api/admin/coverage/sector-subsector` | GET | Admin | KEEP | Proxies to Flask backend; read-only governance visibility |
| `/api/admin/candidates` | GET | Admin | MOVE | Reads filesystem directly from analytics/candidates; should be backend API |
| `/api/admin/candidates/[discipline]/[subtype]` | GET | Admin | MOVE | Reads filesystem directly; should be backend API |
| `/api/admin/analytics/coverage-dashboard` | GET | Admin | MOVE | Reads filesystem from psaback/tools/reports; should be backend API |
| `/api/admin/analytics/gap-analysis` | GET | Admin | MOVE | Reads filesystem from psaback/tools/reports; should be backend API |
| `/api/admin/analytics/gap-reports` | GET | Admin | MOVE | Reads filesystem from psa_engine/analytics/gap_reports; should be backend API |
| `/api/admin/analytics/gap-candidates` | GET | Admin | MOVE | Reads filesystem from psa_engine/analytics/gap_candidates; should be backend API |
| `/api/admin/analytics/canonical-content` | GET | Admin | MOVE | Reads filesystem from psaback/tools/reports; should be backend API |
| `/api/admin/assessments/status` | GET | Admin | KEEP | Proxies to Flask backend; read-only governance status visibility |
| `/api/admin/library-ingestion-status` | GET | Admin | MOVE | Reads filesystem from psa_engine/analytics/library; should be backend API |
| `/api/admin/ofc-evidence` | GET | Admin | MOVE | Reads filesystem from coverage_library; references deprecated required_element_code; should be backend API |
| `/api/admin/taxonomy/disciplines` | GET | Admin | MOVE | Reads filesystem from psa_engine/docs/doctrine/taxonomy; should be backend API |
| `/api/admin/taxonomy/subtypes` | GET | Admin | MOVE | Reads filesystem from psa_engine/docs/doctrine/taxonomy; should be backend API |
| `/api/admin/validate/baseline` | GET | Admin | ENGINEERING_ONLY | Runs validator execution; triggers processing; engineering tool, not admin governance |
| `/api/admin/validate/baseline-freeze` | GET | Admin | ENGINEERING_ONLY | Runs validator execution; triggers processing; engineering tool, not admin governance |
| `/api/admin/validate/forbidden-terms` | GET | Admin | ENGINEERING_ONLY | Runs validator execution; triggers processing; engineering tool, not admin governance |
| `/api/admin/validate/compound-clauses` | GET | Admin | ENGINEERING_ONLY | Runs validator execution; triggers processing; engineering tool, not admin governance |
| `/api/admin/validate/ofc-mirrors` | GET | Admin | ENGINEERING_ONLY | Runs validator execution; triggers processing; engineering tool, not admin governance |
| `/api/review/statements` | GET, POST | Runtime | MOVE | Cross-assessment scope conflicts with assessment-scoped architecture; mutation-heavy; should be assessment-scoped or backend API |
| `/api/review/statements/[id]` | GET, PATCH, DELETE | Runtime | MOVE | Cross-assessment scope conflicts with assessment-scoped architecture; mutation-heavy; should be assessment-scoped or backend API |
| `/api/review/statements/bulk` | POST | Runtime | MOVE | Cross-assessment scope conflicts with assessment-scoped architecture; mutation-heavy; should be assessment-scoped or backend API |
| `/api/reference/question-focus` | GET | Reference | KEEP | Reference material - read-only frozen content; list available question focus pages |
| `/api/reference/question-focus/[discipline]/[subtype]` | GET | Reference | KEEP | Reference material - read-only frozen content; question focus page content for reference |

---

## Classification Breakdown

### KEEP (20 routes)
**Runtime Routes (15):**
- Assessment management (7 routes) - all assessment-scoped
- Taxonomy data (4 routes) - core runtime taxonomy
- Document management (2 routes) - core runtime document browser
- Component capability (2 routes) - assessment-scoped

**Reference Routes (2):**
- Question focus pages (2 routes) - read-only frozen reference material

**Admin Routes (3):**
- Coverage sector-subsector (1 route) - proxies to Flask, read-only governance visibility
- Assessment status (1 route) - proxies to Flask, read-only governance visibility
- *(Note: All other admin routes moved to MOVE or ENGINEERING_ONLY due to filesystem access or execution)*

### MOVE (15 routes)
**Admin Routes with Filesystem Access (12):**
- Coverage browser (1 route) - reads from psa_engine filesystem
- Candidate packages (2 routes) - read from analytics/candidates filesystem
- Analytics dashboards (5 routes) - read from psaback/psa_engine filesystem
- Library ingestion status (1 route) - reads from psa_engine filesystem
- OFC evidence (1 route) - reads from coverage_library filesystem
- Taxonomy management (2 routes) - read from psa_engine filesystem

**Review Statements (3 routes):**
- Cross-assessment scope conflicts with assessment-scoped architecture
- Mutation-heavy behavior
- Should be assessment-scoped under `/api/assessments/[assessmentId]/review/` or moved to backend

### DEPRECATE (3 routes)
1. `/api/assessment/scoring` - Legacy route using documentId; conflicts with assessment-scoped architecture
2. `/api/required-elements` - References deprecated BASE-0xx required elements concept; superseded by baseline questions
3. `/api/fixtures/[filename]` - Legacy fixture serving; should use direct imports or data provider

### ENGINEERING_ONLY (10 routes)
**System Diagnostics (5 routes):**
1. `/api/system/status` - Flask backend health check
2. `/api/system/coverage` - System coverage metrics
3. `/api/system/test-flask` - Flask connectivity test
4. `/api/db/test` - Database connectivity diagnostics
5. `/api/logs` - Log file access and clearing

**Validation Execution (5 routes):**
6. `/api/admin/validate/baseline` - Runs validator execution; triggers processing
7. `/api/admin/validate/baseline-freeze` - Runs validator execution; triggers processing
8. `/api/admin/validate/forbidden-terms` - Runs validator execution; triggers processing
9. `/api/admin/validate/compound-clauses` - Runs validator execution; triggers processing
10. `/api/admin/validate/ofc-mirrors` - Runs validator execution; triggers processing

---

## Architecture Alignment Notes

### Locked Truths Applied

1. **Required Elements Deprecated**: `/api/required-elements` marked DEPRECATE - BASE-0xx concepts are deprecated
2. **Admin v4 Read-Only**: Only admin routes that proxy to Flask backend for read-only status are KEEP; all filesystem-reading admin routes are MOVE
3. **Engineering Tools Excluded**: All validation routes and system diagnostics are ENGINEERING_ONLY
4. **Runtime Assessment-Scoped**: All runtime assessment routes are assessment-scoped and KEEP
5. **Reference Frozen**: Reference routes are read-only frozen content and KEEP
6. **MOVE Required**: 15 routes marked MOVE due to filesystem access or incorrect layering

### Key Corrections from v1

- **KEEP reduced from 37 to 20**: Removed admin routes with filesystem access, review statements, and deprecated routes
- **MOVE increased from 0 to 15**: All admin routes reading filesystem and review statements marked MOVE
- **DEPRECATE increased from 2 to 3**: Added `/api/required-elements` (BASE-0xx deprecated)
- **ENGINEERING_ONLY increased from 5 to 10**: Added all validation routes that execute validators (engineering tools, not admin governance)

---

**Last Updated:** 2025-12-21

