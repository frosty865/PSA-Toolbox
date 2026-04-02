# Hard Guards Implementation Summary

**Date:** 2025-12-21  
**Status:** SPECIFICATION COMPLETE - IMPLEMENTATION PENDING IN PSA-BACKEND  
**Location:** psa-backend (implementation), psa-web (specification & UI guards)

---

## Task Completion

### ✅ Completed in psa-web

1. **API Surface Verification:**
   - Created `scripts/verify_api_surface.ts` - Automated route scan
   - Verified no DELETE methods exist
   - Verified no forbidden patterns (validators, logs, diagnostics)
   - All routes are KEEP routes from API_TRIAGE_v2.md

2. **UI Safety Guards:**
   - Field UI: No delete/edit/approve/reject/retire controls
   - Admin UI: No create OFC controls, decision_reason required
   - Buttons disabled during processing
   - Explicit guard comments added to code

3. **Documentation:**
   - `docs/HARD_GUARDS_SPECIFICATION.md` - Complete guard specifications
   - `docs/HARD_GUARDS_TEST_SPECIFICATION.md` - Required test cases
   - `docs/HARD_GUARDS_DATABASE_CONSTRAINTS.md` - Database constraints
   - `docs/STATUS.md` - Updated with hard guards section

---

## Pending Implementation in psa-backend

### Required Work

1. **Role Guard Middleware**
   - Location: `psa-backend/src/middleware/role_guards.py`
   - See: `docs/HARD_GUARDS_SPECIFICATION.md` Section A
   - Functions: `require_psa_role`, `require_governing_body`, `block_engineering_role`

2. **State Transition Validation**
   - Location: `psa-backend/src/routes/admin/ofcs.py`
   - See: `docs/HARD_GUARDS_SPECIFICATION.md` Section B
   - Function: `validate_state_transition()`
   - All endpoints must enforce transitions

3. **Database Constraints**
   - Location: `psa-backend/migrations/`
   - See: `docs/HARD_GUARDS_DATABASE_CONSTRAINTS.md`
   - Migrations:
     - Revoke DELETE permissions
     - Create approved content guard trigger
     - Create state transition guard trigger
     - Revoke UPDATE/DELETE on audit table

4. **API DELETE Route Handler**
   - Location: `psa-backend/src/routes/admin/ofcs.py`
   - Return 405 Method Not Allowed for DELETE requests

5. **Test Suite**
   - Location: `psa-backend/tests/`
   - See: `docs/HARD_GUARDS_TEST_SPECIFICATION.md`
   - Test suites:
     - `test_role_guards.py`
     - `test_state_transitions.py`
     - `test_subtraction_guards.py`

---

## Guard Categories Summary

### A) Role Guards (Backend - PENDING)

**PSA Role:**
- ❌ Cannot call `/api/admin/ofcs/*`
- ❌ Cannot approve/reject/retire OFCs

**GOVERNING_BODY Role:**
- ❌ Cannot create OFCs via `/api/runtime/ofcs` POST
- ❌ Cannot submit OFCs
- ❌ Cannot propose changes

**ENGINEERING Role:**
- ❌ No implicit access (explicitly denied)

### B) State Transition Guards (Backend - PENDING)

**Allowed Transitions ONLY:**
- DRAFT → SUBMITTED
- SUBMITTED → UNDER_REVIEW, APPROVED, REJECTED, DRAFT
- UNDER_REVIEW → APPROVED, REJECTED, DRAFT
- APPROVED → SUPERSEDED, RETIRED

**Everything else → 409 Conflict**

### C) Subtraction Guards (Database + API - PENDING)

**DELETE:**
- ❌ No DELETE routes exist
- ❌ Database permissions revoked

**UPDATE Approved Content:**
- ❌ Database trigger blocks updates
- ❌ API returns 409

**Decision Reason:**
- ✅ Required for REJECTED, RETIRED (schema constraint)

### D) API Surface Guards (psa-web - ✅ COMPLETE)

**Verified:**
- ✅ Only KEEP routes exposed
- ✅ No validators (`/api/admin/validate/*`)
- ✅ No logs (`/api/logs`)
- ✅ No diagnostics (`/api/system/*`, `/api/db/*`)
- ✅ No filesystem-backed APIs

### E) UI Safety Guards (psa-web - ✅ COMPLETE)

**Field UI:**
- ✅ No delete buttons
- ✅ No edit-in-place for approved OFCs
- ✅ No approve/reject/retire controls
- ✅ Submit button only for DRAFT

**Admin UI:**
- ✅ No create OFC controls
- ✅ No text editing
- ✅ decision_reason required in dialogs
- ✅ Buttons disabled during processing

---

## Implementation Checklist

### psa-backend Tasks

- [ ] Implement role guard middleware
- [ ] Implement state transition validation
- [ ] Create database migration (DELETE revoke)
- [ ] Create database migration (approved content guard trigger)
- [ ] Create database migration (state transition guard trigger)
- [ ] Create database migration (audit table permissions)
- [ ] Add DELETE route handler (return 405)
- [ ] Implement test suite for role guards
- [ ] Implement test suite for state transitions
- [ ] Implement test suite for subtraction guards
- [ ] Run all tests and verify 100% pass

### psa-web Tasks (✅ COMPLETE)

- [x] API surface verification script
- [x] UI guards implemented
- [x] Guard comments added
- [x] Documentation created

---

## Verification Commands

### psa-web
```bash
# Verify API surface
npm run verify:api-surface

# Should output: ✅ API surface verified - no violations
```

### psa-backend (when implemented)
```bash
# Run guard tests
pytest tests/test_role_guards.py tests/test_state_transitions.py tests/test_subtraction_guards.py -v

# Verify database constraints
psql -d psa_db -f migrations/verify_guards.sql
```

---

## Key Principles

1. **Violations are IMPOSSIBLE, not discouraged**
2. **Multiple layers of defense** (backend, database, UI)
3. **Database is final authority** (even if application code has bugs)
4. **Tests verify guards work** (not just that code exists)

---

## Documentation References

- **Guard Specifications:** `docs/HARD_GUARDS_SPECIFICATION.md`
- **Test Specifications:** `docs/HARD_GUARDS_TEST_SPECIFICATION.md`
- **Database Constraints:** `docs/HARD_GUARDS_DATABASE_CONSTRAINTS.md`
- **Status Update:** `docs/STATUS.md`

---

**END OF SUMMARY**

