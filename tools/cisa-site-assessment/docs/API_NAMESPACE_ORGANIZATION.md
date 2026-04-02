# API Namespace Organization

**Generated:** 2025-12-21  
**Status:** COMPLETE

---

## Summary

API namespace normalization complete. Remaining routes organized into runtime, reference, and admin namespaces.
No logic changes. All routes preserve exact handler logic and request/response semantics.

**Total Routes:** 17

---

## Route Organization

### Runtime Routes (9 routes)

**Assessment Management (7 routes):**
- `/api/runtime/assessments` - GET - List all assessments
- `/api/runtime/assessments/[assessmentId]` - GET, PATCH - Get assessment details and save responses
- `/api/runtime/assessments/[assessmentId]/ofcs` - GET - Get OFCs for assessment execution
- `/api/runtime/assessments/[assessmentId]/submit` - POST - Submit assessment for scoring
- `/api/runtime/assessments/[assessmentId]/lock` - POST - Lock assessment to prevent edits
- `/api/runtime/assessments/[assessmentId]/component-capability/questions` - GET - Component capability questions
- `/api/runtime/assessments/[assessmentId]/component-capability/responses` - GET, POST - Component capability responses

**Document Management (2 routes):**
- `/api/runtime/documents` - GET - List ingested documents
- `/api/runtime/documents/[documentId]/coverage` - GET - Get coverage data for document

### Reference Routes (6 routes)

**Taxonomy (4 routes):**
- `/api/reference/sectors` - GET - List all sectors
- `/api/reference/subsectors` - GET - List subsectors (optionally filtered by sector)
- `/api/reference/disciplines` - GET - List disciplines with subtypes attached
- `/api/reference/discipline-subtypes` - GET - List discipline subtypes

**Question Focus (2 routes):**
- `/api/reference/question-focus` - GET - List available question focus pages
- `/api/reference/question-focus/[discipline]/[subtype]` - GET - Get question focus page content

### Admin Routes (2 routes)

**Read-Only Governance Status:**
- `/api/admin/status` - GET - Assessment status overview (proxies to Flask backend)
- `/api/admin/coverage-summary` - GET - Sector/subsector coverage summary (proxies to Flask backend)

---

## Verification

✅ **No routes at root `/api/*` level** - All routes organized into namespaces  
✅ **Total route count: 17** - Matches KEEP routes from triage  
✅ **No linter errors** - All routes compile successfully  
✅ **Import paths updated** - All relative imports adjusted for new locations  
✅ **Logic preserved** - No behavior changes, only path reorganization  

---

## Migration Notes

**Old Path → New Path:**
- `/api/assessments` → `/api/runtime/assessments`
- `/api/assessments/[assessmentId]` → `/api/runtime/assessments/[assessmentId]`
- `/api/assessments/[assessmentId]/*` → `/api/runtime/assessments/[assessmentId]/*`
- `/api/documents` → `/api/runtime/documents`
- `/api/documents/[documentId]/*` → `/api/runtime/documents/[documentId]/*`
- `/api/sectors` → `/api/reference/sectors`
- `/api/subsectors` → `/api/reference/subsectors`
- `/api/disciplines` → `/api/reference/disciplines`
- `/api/disciplines/subtypes` → `/api/reference/discipline-subtypes`
- `/api/admin/assessments/status` → `/api/admin/status`
- `/api/admin/coverage/sector-subsector` → `/api/admin/coverage-summary`
- `/api/reference/question-focus/*` → `/api/reference/question-focus/*` (unchanged)

**Frontend Updates Required:**
All frontend code referencing these routes must be updated to use the new paths.
No compatibility shims or redirects were added.

---

**Last Updated:** 2025-12-21

