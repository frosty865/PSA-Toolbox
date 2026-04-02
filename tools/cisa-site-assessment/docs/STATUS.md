# PSA Rebuild Status

## System Status

**Current State:** LOCKED, PRODUCTION-STABLE

PSA Rebuild UI is locked and production-stable, consuming backend output exactly as provided.

## Component Status

### UI Consumption

**Status:** LOCKED

- UI consumes backend scoring API output exactly
- No recomputation or reinterpretation
- Backend-calculated percentages preserved
- Separate baseline and sector display maintained

### Printable Export

**Status:** ENABLED

- Print/Export action available on Report View
- Export includes:
  - Executive Summary (Baseline, then Sector)
  - Discipline summaries with percentages
  - Detailed Findings (NO items only)
- Monochrome-safe formatting
- Page breaks between major sections
- Header/footer with assessment metadata

### Report View

**Status:** STABLE

- Baseline and sector gaps displayed separately
- Discipline summaries shown with percentages
- Applicability notes displayed for N/A elements
- No blending of baseline and sector scores

## Integration Points

### Backend Integration

**psa-web consumes:**
- Scoring API: `/api/assessment/scoring`
- Backend-calculated percentages (not recomputed)
- Separate baseline and sector scores
- Discipline summaries from backend

**psa-web does NOT:**
- Recalculate scores from raw data
- Modify backend-provided percentages
- Blend baseline and sector scores
- Infer scores from question text

## Allowed Future Work

- UI workflow improvements (consuming existing backend output)
- Presentation enhancements (formatting, layout)
- Export format additions (maintaining backend contract)

## Prohibited Work

- ❌ Recomputing scores in UI
- ❌ Modifying backend-provided percentages
- ❌ Blending baseline and sector scores
- ❌ Changing backend contract consumption

---

## Clean-State Invariants

**Last Hygiene Reset:** 2025-12-21  
**System Reset Complete:** 2025-12-21  
**API Prune Complete:** 2025-12-21  
**API Namespace Normalization Complete:** 2025-12-21  
**Admin Shell Rebuilt:** 2025-12-21

System hygiene, repo normalization, and authority boundaries locked as of 2025-12-21.

### API Prune

**Status:** COMPLETE

API prune complete. Deprecated, engineering-only, and mislayered routes removed from psa-web.
API surface now reflects runtime, reference, and read-only admin only.

**Removed Routes:**
- **DEPRECATE (3 routes):** `/api/assessment/scoring`, `/api/required-elements`, `/api/fixtures/[filename]`
- **ENGINEERING_ONLY (10 routes):** All system diagnostics and validation execution routes
- **MOVE (15 routes):** All admin routes with filesystem access and review statement routes

### API Namespace Normalization

**Status:** COMPLETE

API namespace normalization complete. Remaining routes organized into runtime, reference, and admin.
No logic changes.

**Final Route Organization:**
- **Runtime Routes (9):** `/api/runtime/assessments/*`, `/api/runtime/documents/*` - Assessment-scoped and document management
- **Reference Routes (6):** `/api/reference/sectors`, `/api/reference/subsectors`, `/api/reference/disciplines`, `/api/reference/discipline-subtypes`, `/api/reference/question-focus/*` - Read-only taxonomy and reference material
- **Admin Routes (2):** `/api/admin/status`, `/api/admin/coverage-summary` - Read-only governance status

**Total Routes:** 17 (all KEEP routes from triage)

### Admin Shell

**Status:** REBUILT

Admin shell rebuilt as clean governance base. Minimal shell with no legacy logic or features.

**Pages:**
- `/admin` - Admin landing page (static content, optional status check)
- `/admin/layout` - Admin layout wrapper
- `/admin/ofcs` - Read-only OFC review queue
- `/admin/ofcs/[ofc_id]` - Read-only OFC detail view

**Features:**
- Static content only (no API dependencies except optional `/api/admin/status` check)
- Clear governance focus messaging
- Placeholder section for future features
- Read-only OFC review queue (visibility only, no decisions)
- No legacy code or deleted routes
- No mutation controls, validators, or diagnostics

**Admin OFC Queue (Read-only):**
- Displays OFCs from `/api/admin/ofcs/review-queue` (GET only)
- Shows OFC text, version, status, submitted by/at
- Indicates if OFC supersedes another version
- Navigates to read-only detail view
- No approve/reject/retire buttons
- No state changes or mutations
- Safe error handling (shows clear messages on backend unavailability)

**Backend Endpoint:**
- `GET /api/admin/ofcs/review-queue` - Read-only endpoint in Flask backend (psaback)
- Returns empty list `[]` (placeholder implementation)
- Endpoint registered in `api/admin_ofcs.py` blueprint

### Governance OFC Approval API

**Status:** IMPLEMENTATION SPECIFICATION COMPLETE

Governance OFC Approval APIs specified for psa-backend implementation.
GOVERNING_BODY role required for all endpoints.

**Endpoints (7):**
- `GET /api/admin/ofcs/review-queue` - List OFCs awaiting review
- `POST /api/admin/ofcs/{ofc_id}/begin-review` - Claim OFC for review
- `POST /api/admin/ofcs/{ofc_id}/approve` - Approve OFC (handles supersession)
- `POST /api/admin/ofcs/{ofc_id}/reject` - Reject OFC (requires decision_reason)
- `POST /api/admin/ofcs/{ofc_id}/request-revision` - Send back to draft (requires decision_reason)
- `POST /api/admin/ofcs/{ofc_id}/retire` - Retire approved OFC (requires decision_reason)
- `GET /api/admin/ofcs/{ofc_root_id}/history` - View OFC version history

**Documentation:**
- `docs/GOVERNANCE_OFC_APPROVAL_SCHEMA.md` - Database schema specification
- `docs/GOVERNANCE_OFC_APPROVAL_API.md` - API endpoint implementations

**Key Features:**
- No deletes (status transitions only)
- No edit-in-place of approved OFCs
- Complete audit trail via `ofc_state_transitions` table
- Strict state validation (409 on invalid transitions)
- Supersession handling (new versions supersede old approved versions)

### Field OFC UI

**Status:** IMPLEMENTED

Field OFC UI implemented for PSA role. PSAs can nominate OFCs, propose changes, and review submissions.

**Pages (4):**
- `/field/ofcs` - OFC dashboard (My Submissions, Approved OFCs)
- `/field/ofcs/new` - Nominate new OFC
- `/field/ofcs/[id]` - View OFC details (read-only)
- `/field/ofcs/[rootId]/propose` - Propose change to approved OFC

**Features:**
- PSA can nominate new OFCs (creates DRAFT status)
- PSA can submit DRAFT OFCs for review
- PSA can view approved OFCs (read-only)
- PSA can propose changes to approved OFCs (creates new SUBMITTED version)
- No approval/rejection/retirement controls (governing body only)
- No edit-in-place of approved OFCs
- Clear status labels and explanations
- Honest error handling (no optimistic UI)

**Backend Integration:**
- Uses backend endpoints: `/api/runtime/ofcs/mine`, `/api/runtime/ofcs/approved`, `/api/runtime/ofcs`, `/api/runtime/ofcs/{id}/submit`, `/api/runtime/ofcs/{rootId}/propose-change`
- No local data mocks
- No filesystem reads
- Failures surface honestly

### Governance OFC Admin UI

**Status:** IMPLEMENTED

Governance OFC Admin UI implemented for GOVERNING_BODY role. Governing body can review, approve, reject, request revision, and retire OFCs.

**Pages (3):**
- `/admin/ofcs` - Governance dashboard (Review Queue)
- `/admin/ofcs/[ofc_id]` - Review and decision screen
- `/admin/ofcs/[rootId]/history` - Full audit/history view

**Features:**
- Review queue shows SUBMITTED and UNDER_REVIEW OFCs
- Begin review automatically called on detail page load (idempotent)
- Approve OFC (with optional notes)
- Reject OFC (requires decision_reason)
- Request revision (requires decision_reason, sends back to DRAFT)
- Retire approved OFC (requires decision_reason)
- View complete OFC history with all versions
- Supersession handling (shows when OFC supersedes another)
- Explicit decision dialogs with confirmation
- No edit-in-place of approved OFCs
- No delete actions
- All decisions recorded and immutable

**Backend Integration:**
- Uses backend endpoints: `/api/admin/ofcs/review-queue`, `/api/admin/ofcs/{id}/begin-review`, `/api/admin/ofcs/{id}/approve`, `/api/admin/ofcs/{id}/reject`, `/api/admin/ofcs/{id}/request-revision`, `/api/admin/ofcs/{id}/retire`, `/api/admin/ofcs/{rootId}/history`
- No local data mocks
- No filesystem reads
- Errors surface honestly (403, 409 handled explicitly)

### Hard Guards — OFC Governance & Role Enforcement

**Status:** IMPLEMENTATION SPECIFICATION COMPLETE

Hard guards specified to make violations IMPOSSIBLE, not just discouraged. Guards implemented at multiple layers: backend (authoritative), database (constraints), and UI (safety).

**Guard Categories:**
- **A) Role Guards (Backend):** PSA cannot access admin endpoints; GOVERNING_BODY cannot create/submit OFCs; ENGINEERING has no implicit access
- **B) State Transition Guards (Backend):** Strict validation of allowed transitions; 409 Conflict on invalid transitions
- **C) Subtraction Guards (Database + API):** DELETE impossible (permissions revoked); UPDATE of approved content blocked (trigger); decision_reason required (constraint)
- **D) API Surface Guards (psa-web):** Only KEEP routes exposed; no validators, logs, diagnostics, or filesystem-backed APIs
- **E) UI Safety Guards (psa-web):** Field UI has no delete/edit/approve controls; Admin UI has no create controls; decision_reason required in dialogs; buttons disabled during processing

**Documentation:**
- `docs/HARD_GUARDS_SPECIFICATION.md` - Complete guard specifications
- `docs/HARD_GUARDS_TEST_SPECIFICATION.md` - Required test cases
- `docs/HARD_GUARDS_DATABASE_CONSTRAINTS.md` - Database constraint specifications
- `scripts/verify_api_surface.ts` - API surface verification script

**Verification:**
- ✅ No DELETE methods in psa-web API routes
- ✅ No forbidden patterns (validators, logs, diagnostics) in API routes
- ✅ UI guards implemented with explicit comments
- ✅ API surface verification script created

**Implementation Status:**
- **psa-web:** UI guards implemented, API surface verified
- **psa-backend:** Guard specifications complete (implementation pending)
- **Database:** Constraint specifications complete (migration pending)
- **Tests:** Test specifications complete (implementation pending)

### MOVE Routes Reintroduction

**Status:** PLANNED

15 MOVE routes (classified in `docs/API_TRIAGE_v2.md`) are being reintroduced in psa-backend.
These routes were removed from psa-web and must NOT be re-added there.

**MOVE Routes (15):**
- **Admin Routes with Filesystem Access (12):** `/api/admin/coverage`, `/api/admin/candidates/*`, `/api/admin/analytics/*`, `/api/admin/library-ingestion-status`, `/api/admin/ofc-evidence`, `/api/admin/taxonomy/*`
- **Review Statements (3):** `/api/review/statements/*`

**Implementation:**
- Routes implemented in psa-backend under same namespace paths
- Centralized `reference_provider` module for filesystem access
- psa-web client calls updated to use `BACKEND_BASE_URL`
- psa-web remains logic-free (no filesystem reads, no route handlers)

**Documentation:**
- `docs/MOVE_ROUTES_IMPLEMENTATION_PLAN.md` - Implementation plan
- `docs/BACKEND_REFERENCE_PROVIDER_SPEC.md` - Reference provider specification
- `docs/BACKEND_ROUTES_IMPLEMENTATION.md` - Route implementation templates

### Authoritative Files

1. **Taxonomy**
   - `taxonomy/discipline_subtypes.json` - **AUTHORITATIVE** (source: psa-engine)
   - Read-only reference - do not modify in psa-rebuild
   - See `taxonomy/README.md` for details

2. **Baseline Questions**
   - `analytics/runtime/baseline_questions_registry.json` - **AUTHORITATIVE, FROZEN**
   - Status: frozen (versioned_only)
   - Total questions: 416
   - See `analytics/runtime/README.md` for details

3. **Validation Gatekeeper**
   - `tools/validate_baseline_publish_ready.py` - **AUTHORITATIVE**
   - Must pass before baseline can be published
   - Validates: subtype codes, question references, no placeholders, valid response enums

### Validation Requirements

Before any baseline changes:
1. Run `tools/validate_baseline_publish_ready.py`
2. Must pass all checks:
   - All subtypes have subtype_code
   - All questions reference valid subtypes
   - No placeholder language
   - All response enums are YES/NO/N_A
   - Question count matches expected (416)

### Clean-State Rules

- ✅ No placeholders in baseline questions
- ✅ No deprecated logic remains active
- ✅ No empty folders (except runtime directories)
- ✅ No orphaned references
- ✅ Exactly one authoritative source per domain:
  - Taxonomy: `taxonomy/discipline_subtypes.json`
  - Baseline questions: `analytics/runtime/baseline_questions_registry.json`
  - Validation: `tools/validate_baseline_publish_ready.py`

### Archived Files

Historical files archived in `archive/2025-12-21/`:
- `baseline_questions_registry.json.backup` - Old backup
- `ROUTE_TEST_SUMMARY.md` - Historical test summary

### Deleted Files

Removed deprecated/duplicate files:
- `test-routes.js` - One-off test script
- `migrations/run_this.sql` - Deprecated migration
- `migrations/run_this_fixed.sql` - Deprecated migration
- `migrations/01_add_verification_relevance_gate.sql` - Duplicate migration

### Removed Legacy Features

**Legacy OFC catalog page (`/ofcs`) removed.**
OFCs are now assessment-scoped outputs only.
Global OFC browsing is deprecated by design.

### Empty Directories Removed

- `app/admin/data/taxonomy/`
- `app/admin/doctrine/baseline/`
- `app/admin/doctrine/ofcs/`
- `app/admin/system/status/`
- `app/admin/utilities/db-cleanup/`
- `app/admin/utilities/logs/`

### Runtime Directories (KEPT)

These empty directories are kept because they're referenced in the watcher pipeline:
- `analytics/incoming/` - Watcher input directory
- `analytics/library/` - Watcher output directory
- `analytics/processed/` - Watcher processing directory
- `app/processing/` - Runtime processing directory

---

## Backend Endpoints

### Admin OFC Review Queue Endpoint

**Status:** ADDED

Admin OFC review queue endpoint added (read-only, Flask).

- **Endpoint:** `GET /api/admin/ofcs/review-queue`
- **Location:** `psaback/api/admin_ofcs.py`
- **Implementation:** Returns empty list `[]` (placeholder)
- **Registration:** Blueprint registered in `psaback/app.py`
- **Purpose:** Read-only governance visibility (no decisions or mutations)

**Validation:**
After Flask backend restart, endpoint should return:
```
200 OK
[]
```

---

**See `../psa-engine/docs/decisions/PSA_V2_ACCEPTANCE.md` for full system acceptance.**

