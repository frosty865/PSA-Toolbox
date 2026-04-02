# API Route Triage

**Generated:** 2025-12-21  
**Purpose:** Classification of all API routes for organizational planning  
**Action:** CLASSIFICATION ONLY - NO MODIFICATIONS

---

## Classification Legend

- **KEEP**: Routes actively used by runtime application, reference pages, or admin tools
- **MOVE**: Routes that should be relocated for better organization
- **DEPRECATE**: Legacy routes that should be phased out
- **ENGINEERING_ONLY**: Routes for debugging, testing, or internal tooling only

---

## Triage Results

| Route | Methods | Audience | Classification | Rationale |
|-------|---------|----------|----------------|-----------|
| `/api/assessments` | GET | Runtime | KEEP | Core functionality - lists all assessments for dashboard |
| `/api/assessments/[assessmentId]` | GET, PATCH | Runtime | KEEP | Core functionality - get assessment details and save responses |
| `/api/assessments/[assessmentId]/ofcs` | GET | Runtime | KEEP | Core functionality - get OFCs for assessment execution |
| `/api/assessments/[assessmentId]/submit` | POST | Runtime | KEEP | Core functionality - submit assessment for scoring |
| `/api/assessments/[assessmentId]/lock` | POST | Runtime | KEEP | Core functionality - lock assessment to prevent edits |
| `/api/assessments/[assessmentId]/component-capability/questions` | GET | Runtime | KEEP | Core functionality - component capability questions for assessment |
| `/api/assessments/[assessmentId]/component-capability/responses` | GET, POST | Runtime | KEEP | Core functionality - component capability responses for assessment |
| `/api/assessment/scoring` | GET | Runtime | DEPRECATE | Legacy route using documentId param; should use assessment-scoped route |
| `/api/sectors` | GET | Runtime | KEEP | Core taxonomy - used by sector selection and filtering |
| `/api/subsectors` | GET | Runtime | KEEP | Core taxonomy - used by subsector selection and filtering |
| `/api/disciplines` | GET | Runtime | KEEP | Core taxonomy - used by discipline selection and filtering |
| `/api/disciplines/subtypes` | GET | Runtime | KEEP | Core taxonomy - used by subtype selection and filtering |
| `/api/required-elements` | GET | Runtime | KEEP | Core functionality - baseline questions for assessment execution |
| `/api/documents` | GET | Runtime | KEEP | Core functionality - list ingested documents for document browser |
| `/api/documents/[documentId]/coverage` | GET | Runtime | KEEP | Core functionality - get coverage data for document viewer |
| `/api/system/status` | GET | Engineering | ENGINEERING_ONLY | System diagnostics - Flask backend health check |
| `/api/system/coverage` | GET | Engineering | ENGINEERING_ONLY | System diagnostics - coverage metrics for monitoring |
| `/api/system/test-flask` | GET | Engineering | ENGINEERING_ONLY | Testing tool - Flask connectivity test |
| `/api/db/test` | GET | Engineering | ENGINEERING_ONLY | Testing tool - database connectivity diagnostics |
| `/api/logs` | GET, DELETE | Engineering | ENGINEERING_ONLY | Debugging tool - log file access and clearing |
| `/api/fixtures/[filename]` | GET | Runtime | DEPRECATE | Legacy fixture serving; should use direct imports or proper data provider |
| `/api/admin/coverage` | GET | Admin | KEEP | Admin tool - coverage browser for governance oversight |
| `/api/admin/coverage/sector-subsector` | GET | Admin | KEEP | Admin tool - sector/subsector coverage data for admin dashboard |
| `/api/admin/candidates` | GET | Admin | KEEP | Admin tool - list candidate packages for review |
| `/api/admin/candidates/[discipline]/[subtype]` | GET | Admin | KEEP | Admin tool - get specific candidate package for review |
| `/api/admin/analytics/coverage-dashboard` | GET | Admin | KEEP | Admin tool - coverage dashboard metrics for governance |
| `/api/admin/analytics/gap-analysis` | GET | Admin | KEEP | Admin tool - gap analysis data for governance |
| `/api/admin/analytics/gap-reports` | GET | Admin | KEEP | Admin tool - gap reports for governance |
| `/api/admin/analytics/gap-candidates` | GET | Admin | KEEP | Admin tool - gap candidates for governance |
| `/api/admin/analytics/canonical-content` | GET | Admin | KEEP | Admin tool - canonical content dashboard for governance |
| `/api/admin/assessments/status` | GET | Admin | KEEP | Admin tool - assessment status overview for governance |
| `/api/admin/library-ingestion-status` | GET | Admin | KEEP | Admin tool - library ingestion status for governance |
| `/api/admin/ofc-evidence` | GET | Admin | KEEP | Admin tool - OFC evidence viewer for governance |
| `/api/admin/taxonomy/disciplines` | GET | Admin | KEEP | Admin tool - canonical disciplines taxonomy for admin tools |
| `/api/admin/taxonomy/subtypes` | GET | Admin | KEEP | Admin tool - canonical subtypes taxonomy for admin tools |
| `/api/admin/validate/baseline` | GET | Admin | KEEP | Admin tool - baseline validation for doctrine governance |
| `/api/admin/validate/baseline-freeze` | GET | Admin | KEEP | Admin tool - baseline freeze readiness check for governance |
| `/api/admin/validate/forbidden-terms` | GET | Admin | KEEP | Admin tool - forbidden term scanning for doctrine governance |
| `/api/admin/validate/compound-clauses` | GET | Admin | KEEP | Admin tool - compound clause validation for doctrine governance |
| `/api/admin/validate/ofc-mirrors` | GET | Admin | KEEP | Admin tool - OFC mirror validation for doctrine governance |
| `/api/review/statements` | GET, POST | Runtime | KEEP | Core functionality - review statements for assessment workflow |
| `/api/review/statements/[id]` | GET, PATCH, DELETE | Runtime | KEEP | Core functionality - CRUD operations for review statements |
| `/api/review/statements/bulk` | POST | Runtime | KEEP | Core functionality - bulk operations for review statements |
| `/api/reference/question-focus` | GET | Reference | KEEP | Reference material - list available question focus pages |
| `/api/reference/question-focus/[discipline]/[subtype]` | GET | Reference | KEEP | Reference material - question focus page content for reference |

---

## Summary Statistics

- **Total Routes:** 45
- **KEEP:** 37 (82.2%)
- **DEPRECATE:** 2 (4.4%)
- **ENGINEERING_ONLY:** 5 (11.1%)
- **MOVE:** 0 (0%)

---

## Classification Breakdown

### KEEP (37 routes)
**Runtime Routes (18):**
- Assessment management (7 routes)
- Taxonomy data (5 routes)
- Document management (2 routes)
- Required elements (1 route)
- Review statements (3 routes)

**Reference Routes (2):**
- Question focus pages (2 routes)

**Admin Routes (17):**
- Coverage tools (2 routes)
- Candidate packages (2 routes)
- Analytics dashboards (5 routes)
- Assessment status (1 route)
- Library ingestion (1 route)
- OFC evidence (1 route)
- Taxonomy management (2 routes)
- Validation tools (5 routes)

### DEPRECATE (2 routes)
1. `/api/assessment/scoring` - Legacy route using documentId; should migrate to assessment-scoped scoring
2. `/api/fixtures/[filename]` - Legacy fixture serving; should use direct imports or data provider

### ENGINEERING_ONLY (5 routes)
1. `/api/system/status` - Flask backend health check
2. `/api/system/coverage` - System coverage metrics
3. `/api/system/test-flask` - Flask connectivity test
4. `/api/db/test` - Database connectivity diagnostics
5. `/api/logs` - Log file access and clearing

### MOVE (0 routes)
All routes are properly organized in their current locations.

---

## Recommendations

### Immediate Actions
1. **Deprecate `/api/assessment/scoring`**: Migrate to assessment-scoped scoring endpoint
2. **Deprecate `/api/fixtures/[filename]`**: Replace with direct imports or data provider pattern
3. **Document ENGINEERING_ONLY routes**: Add clear documentation that these are for debugging/testing only

### Future Considerations
1. Consider consolidating admin analytics routes if they share common patterns
2. Review if system routes should be moved to `/api/engineering/` namespace
3. Evaluate if review statements should be under `/api/assessments/[assessmentId]/review/` for better organization

---

## Notes

- All routes are currently functional and should not be removed without migration plan
- ENGINEERING_ONLY routes should be protected or documented as internal-only
- DEPRECATE routes should have migration path before removal
- No routes require immediate relocation (MOVE classification)

---

**Last Updated:** 2025-12-21

