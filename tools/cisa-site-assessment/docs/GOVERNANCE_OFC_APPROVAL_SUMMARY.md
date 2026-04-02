# Governance OFC Approval API - Implementation Summary

**Date:** 2025-12-21  
**Status:** IMPLEMENTATION SPECIFICATION COMPLETE  
**Location:** psa-backend

---

## Overview

Complete specification for implementing Governance OFC Approval API endpoints in psa-backend.
All endpoints require `GOVERNING_BODY` role. PSAs and Engineering roles receive 403 Forbidden.

---

## Deliverables

### ✅ Database Schema
- **File:** `docs/GOVERNANCE_OFC_APPROVAL_SCHEMA.md`
- **Tables:**
  - `ofcs` - OFC records with versioning and status workflow
  - `ofc_state_transitions` - Complete audit trail
- **Status Values:** DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, RETIRED, SUPERSEDED
- **Constraints:** No deletes, no edit-in-place, strict state validation

### ✅ API Endpoints
- **File:** `docs/GOVERNANCE_OFC_APPROVAL_API.md`
- **7 Endpoints:**
  1. `GET /api/admin/ofcs/review-queue` - List review queue
  2. `POST /api/admin/ofcs/{ofc_id}/begin-review` - Claim for review
  3. `POST /api/admin/ofcs/{ofc_id}/approve` - Approve OFC
  4. `POST /api/admin/ofcs/{ofc_id}/reject` - Reject OFC
  5. `POST /api/admin/ofcs/{ofc_id}/request-revision` - Send back to draft
  6. `POST /api/admin/ofcs/{ofc_id}/retire` - Retire approved OFC
  7. `GET /api/admin/ofcs/{ofc_root_id}/history` - View OFC history

---

## Key Requirements

### Authorization
- All endpoints require `GOVERNING_BODY` role
- PSAs receive 403 Forbidden
- Engineering receives 403 Forbidden (unless explicitly desired - default: NO)

### State Transitions
- Strict validation (409 Conflict on invalid transitions)
- All transitions recorded in `ofc_state_transitions` table
- Idempotent where reasonable (begin-review)

### Integrity Guarantees
- **No deletes:** Status transitions only (including RETIRED)
- **No edit-in-place:** Approved OFCs cannot be edited; new versions required
- **Audit trail:** Every state change recorded
- **Supersession:** New approved versions automatically supersede old approved versions

### Required Fields
- `decision_reason` required for: REJECTED, RETIRED, revision requests
- `notes` optional for: APPROVED

---

## Implementation Checklist

### Database
- [ ] Run migration to create `ofcs` table
- [ ] Run migration to create `ofc_state_transitions` table
- [ ] Verify indexes created
- [ ] Verify constraints enforced

### API Implementation
- [ ] Create authorization decorator `require_governing_body`
- [ ] Implement `GET /api/admin/ofcs/review-queue`
- [ ] Implement `POST /api/admin/ofcs/{ofc_id}/begin-review`
- [ ] Implement `POST /api/admin/ofcs/{ofc_id}/approve` (with supersession handling)
- [ ] Implement `POST /api/admin/ofcs/{ofc_id}/reject`
- [ ] Implement `POST /api/admin/ofcs/{ofc_id}/request-revision`
- [ ] Implement `POST /api/admin/ofcs/{ofc_id}/retire`
- [ ] Implement `GET /api/admin/ofcs/{ofc_root_id}/history`
- [ ] Register blueprint in main app

### Testing
- [ ] Test authorization (403 for non-GOVERNING_BODY)
- [ ] Test state transitions (valid and invalid)
- [ ] Test supersession logic
- [ ] Test audit trail recording
- [ ] Test idempotent operations
- [ ] Test required field validation

---

## Status Flow Diagram

```
DRAFT
  ↓ (user submission)
SUBMITTED
  ↓ (begin-review)
UNDER_REVIEW
  ↓
  ├─→ APPROVED → RETIRED
  ├─→ REJECTED
  └─→ DRAFT (revision request)

APPROVED → SUPERSEDED (when new version approved)
```

---

## Example Usage

### 1. List Review Queue
```bash
GET /api/admin/ofcs/review-queue
Authorization: Bearer <governing-body-token>
```

### 2. Begin Review
```bash
POST /api/admin/ofcs/{ofc_id}/begin-review
Authorization: Bearer <governing-body-token>
```

### 3. Approve OFC
```bash
POST /api/admin/ofcs/{ofc_id}/approve
Authorization: Bearer <governing-body-token>
Content-Type: application/json

{
  "notes": "Approved for baseline use"
}
```

### 4. Reject OFC
```bash
POST /api/admin/ofcs/{ofc_id}/reject
Authorization: Bearer <governing-body-token>
Content-Type: application/json

{
  "decision_reason": "Does not meet baseline requirements"
}
```

### 5. Request Revision
```bash
POST /api/admin/ofcs/{ofc_id}/request-revision
Authorization: Bearer <governing-body-token>
Content-Type: application/json

{
  "decision_reason": "Rationale needs clarification"
}
```

### 6. Retire Approved OFC
```bash
POST /api/admin/ofcs/{ofc_id}/retire
Authorization: Bearer <governing-body-token>
Content-Type: application/json

{
  "decision_reason": "Superseded by updated guidance"
}
```

### 7. View History
```bash
GET /api/admin/ofcs/{ofc_root_id}/history
Authorization: Bearer <governing-body-token>
```

---

## Error Handling

### 400 Bad Request
- Missing required `decision_reason`
- Invalid `supersedes_ofc_id` reference

### 403 Forbidden
- User does not have `GOVERNING_BODY` role

### 404 Not Found
- OFC not found
- OFC root not found

### 409 Conflict
- Invalid state transition (e.g., trying to approve an already APPROVED OFC)

### 500 Internal Server Error
- Database errors
- Unexpected exceptions

---

## Documentation References

- **Schema:** `docs/GOVERNANCE_OFC_APPROVAL_SCHEMA.md`
- **API Implementation:** `docs/GOVERNANCE_OFC_APPROVAL_API.md`
- **Status Update:** `docs/STATUS.md`

---

**END OF SUMMARY**

