# Hard Guards Specification — OFC Governance & Role Enforcement

**Date:** 2025-12-21  
**Purpose:** Comprehensive guard specifications to make violations IMPOSSIBLE  
**Status:** IMPLEMENTATION SPECIFICATION

---

## Overview

This document specifies hard guards that must be implemented to ensure OFC governance violations are **IMPOSSIBLE**, not just discouraged. Guards are implemented at multiple layers: backend (authoritative), database (constraints), and UI (safety).

---

## A) ROLE GUARDS — BACKEND (MANDATORY)

### Implementation Location
**psa-backend** `src/middleware/role_guards.py` (or equivalent)

### Required Guards

#### 1. PSA Role Restrictions

**PSA role CANNOT:**
- Call any `/api/admin/ofcs/*` endpoint
- Approve OFCs
- Reject OFCs
- Retire OFCs
- Request revision

**Enforcement:**
```python
def require_psa_role(f):
    """Decorator to require PSA role and block admin endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = g.current_user
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        if user.role != 'PSA':
            return jsonify({'error': 'PSA role required'}), 403
        
        # PSA cannot access admin endpoints
        if request.path.startswith('/api/admin/ofcs'):
            return jsonify({'error': 'PSA role cannot access admin endpoints'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
```

#### 2. GOVERNING_BODY Role Restrictions

**GOVERNING_BODY role CANNOT:**
- Create OFCs via `/api/runtime/ofcs` POST
- Submit OFCs via `/api/runtime/ofcs/{id}/submit`
- Propose changes via `/api/runtime/ofcs/{rootId}/propose-change`

**Enforcement:**
```python
def require_governing_body(f):
    """Decorator to require GOVERNING_BODY role and block runtime mutations."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = g.current_user
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        if user.role != 'GOVERNING_BODY':
            return jsonify({'error': 'GOVERNING_BODY role required'}), 403
        
        # GOVERNING_BODY cannot create/submit/propose OFCs
        if request.path.startswith('/api/runtime/ofcs') and request.method in ['POST', 'PATCH']:
            if '/submit' in request.path or '/propose-change' in request.path:
                return jsonify({'error': 'GOVERNING_BODY role cannot create or submit OFCs'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
```

#### 3. ENGINEERING Role Restrictions

**ENGINEERING role:**
- Has NO implicit access to OFC endpoints
- Must be explicitly denied unless granted
- Cannot approve, reject, or retire OFCs

**Enforcement:**
```python
def block_engineering_role(f):
    """Decorator to explicitly deny ENGINEERING role (default: NO access)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = g.current_user
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        # ENGINEERING role explicitly denied (unless explicitly granted elsewhere)
        if user.role == 'ENGINEERING':
            return jsonify({'error': 'ENGINEERING role not authorized for this operation'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
```

### Test Cases (REQUIRED)

```python
def test_psa_cannot_access_admin_endpoints():
    """PSA calling /api/admin/ofcs/* → 403"""
    # Test all admin endpoints return 403 for PSA role
    pass

def test_admin_cannot_create_ofcs():
    """GOVERNING_BODY calling /api/runtime/ofcs POST → 403"""
    pass

def test_engineering_denied():
    """ENGINEERING calling either admin or runtime OFC endpoints → 403"""
    pass
```

---

## B) STATE TRANSITION GUARDS — BACKEND

### Implementation Location
**psa-backend** `src/routes/admin/ofcs.py` (in each transition endpoint)

### Allowed Transitions ONLY

```python
ALLOWED_TRANSITIONS = {
    'DRAFT': ['SUBMITTED'],
    'SUBMITTED': ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DRAFT'],
    'UNDER_REVIEW': ['APPROVED', 'REJECTED', 'DRAFT'],
    'APPROVED': ['SUPERSEDED', 'RETIRED'],
    'REJECTED': [],  # Terminal state
    'RETIRED': [],   # Terminal state
    'SUPERSEDED': [], # Terminal state
}

def validate_state_transition(from_status: str, to_status: str) -> bool:
    """Validate state transition is allowed."""
    allowed = ALLOWED_TRANSITIONS.get(from_status, [])
    return to_status in allowed

def enforce_state_transition(ofc_id: str, to_status: str):
    """Enforce state transition with validation."""
    # Get current status
    current_status = get_ofc_status(ofc_id)
    
    if not validate_state_transition(current_status, to_status):
        raise ValueError(
            f'Invalid transition: {current_status} → {to_status}. '
            f'Allowed transitions from {current_status}: {ALLOWED_TRANSITIONS.get(current_status, [])}'
        )
    
    # Proceed with transition
    return transition_ofc_status(ofc_id, to_status)
```

### Test Cases (REQUIRED)

```python
def test_approve_draft_fails():
    """Approve DRAFT → 409"""
    # Attempt to approve a DRAFT OFC
    # Expect 409 Conflict
    pass

def test_retire_submitted_fails():
    """Retire SUBMITTED → 409"""
    pass

def test_submit_approved_fails():
    """Submit APPROVED → 409"""
    pass

def test_reject_retired_fails():
    """Reject RETIRED → 409"""
    pass
```

---

## C) SUBTRACTION GUARDS — DATABASE + API

### 1. DELETE is Impossible

#### Database Constraint
```sql
-- Revoke DELETE permission on ofcs table
REVOKE DELETE ON TABLE ofcs FROM PUBLIC;
REVOKE DELETE ON TABLE ofcs FROM app_role;
REVOKE DELETE ON TABLE ofcs FROM admin_role;

-- Only system/superuser can delete (for emergency only)
-- Application roles cannot delete
```

#### API Constraint
```python
# NO DELETE routes exist
# If DELETE attempted, return 405 Method Not Allowed

@admin_ofcs_bp.route('/<ofc_id>', methods=['DELETE'])
def delete_ofc(ofc_id):
    """DELETE is not allowed - return 405."""
    return jsonify({'error': 'DELETE not allowed. Use status transitions (RETIRED) instead.'}), 405
```

### 2. UPDATE of Approved Content is Impossible

#### Database Constraint
```sql
-- Trigger to prevent updates to approved OFC content
CREATE OR REPLACE FUNCTION prevent_approved_ofc_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is APPROVED, only allow status changes
    IF OLD.status = 'APPROVED' THEN
        -- Allow status changes only
        IF NEW.status != OLD.status THEN
            RETURN NEW;  -- Status transition allowed
        END IF;
        
        -- Block content changes
        IF NEW.ofc_text != OLD.ofc_text OR
           NEW.rationale != OLD.rationale OR
           NEW.context_conditions != OLD.context_conditions THEN
            RAISE EXCEPTION 'Cannot modify approved OFC content. Create new version instead.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ofc_approved_content_guard
    BEFORE UPDATE ON ofcs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_approved_ofc_updates();
```

#### API Constraint
```python
@admin_ofcs_bp.route('/<ofc_id>', methods=['PATCH', 'PUT'])
def update_ofc(ofc_id):
    """Updates to approved OFCs are not allowed."""
    ofc = get_ofc(ofc_id)
    
    if ofc.status == 'APPROVED':
        return jsonify({
            'error': 'Cannot modify approved OFC. Create new version instead.'
        }), 409
    
    # Only allow updates to DRAFT/SUBMITTED/UNDER_REVIEW
    # ...
```

### 3. Retirement Requires decision_reason

#### Database Constraint
```sql
-- Already enforced in schema CHECK constraint
-- status IN ('REJECTED', 'RETIRED') AND decision_reason IS NOT NULL
```

#### API Constraint
```python
@admin_ofcs_bp.route('/<ofc_id>/retire', methods=['POST'])
@require_governing_body
def retire_ofc(ofc_id):
    data = request.get_json()
    
    if not data or 'decision_reason' not in data:
        return jsonify({'error': 'decision_reason is required'}), 422
    
    if not data['decision_reason'] or not data['decision_reason'].strip():
        return jsonify({'error': 'decision_reason cannot be empty'}), 422
    
    # Proceed with retirement
    # ...
```

### Test Cases (REQUIRED)

```python
def test_delete_returns_405():
    """DELETE /ofcs/{id} → 405 or 404"""
    pass

def test_update_approved_content_fails():
    """UPDATE approved ofc_text → blocked"""
    pass

def test_retire_without_reason_fails():
    """Retire without decision_reason → 422"""
    pass
```

---

## D) API SURFACE GUARDS — PSA-WEB

### Verification Requirements

**psa-web MUST:**
1. Host ONLY KEEP routes (from API_TRIAGE_v2.md)
2. NOT expose:
   - Validators (`/api/admin/validate/*`)
   - Logs (`/api/logs`)
   - Diagnostics (`/api/system/*`, `/api/db/*`)
   - Filesystem-backed APIs (MOVE routes)

### Automated Route Scan

```typescript
// scripts/verify_api_surface.ts
import { glob } from 'glob';
import { readFileSync } from 'fs';

const FORBIDDEN_PATTERNS = [
  /\/api\/admin\/validate\//,
  /\/api\/logs/,
  /\/api\/system\//,
  /\/api\/db\//,
  /\/api\/fixtures\//,
];

const ALLOWED_ROUTES = [
  // Runtime routes
  /^\/api\/runtime\/assessments/,
  /^\/api\/runtime\/documents/,
  // Reference routes
  /^\/api\/reference\//,
  // Admin routes (read-only only)
  /^\/api\/admin\/status/,
  /^\/api\/admin\/coverage-summary/,
];

function verifyApiSurface() {
  const routeFiles = glob.sync('app/api/**/route.ts');
  const violations = [];
  
  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf-8');
    const path = file.replace('app/api/', '/api/').replace('/route.ts', '');
    
    // Check for forbidden patterns
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(path)) {
        violations.push({
          file,
          path,
          reason: `Forbidden pattern: ${pattern}`,
        });
      }
    }
    
    // Verify allowed routes
    const isAllowed = ALLOWED_ROUTES.some(pattern => pattern.test(path));
    if (!isAllowed && !path.includes('/[')) {  // Dynamic routes need manual check
      violations.push({
        file,
        path,
        reason: 'Not in allowed routes list',
      });
    }
  }
  
  if (violations.length > 0) {
    console.error('API Surface Violations:');
    violations.forEach(v => console.error(`  ${v.path}: ${v.reason}`));
    process.exit(1);
  }
  
  console.log('✅ API surface verified - no violations');
}
```

---

## E) UI SAFETY GUARDS — PSA-WEB

### Field UI Guards

**Required:**
- No delete buttons
- No edit-in-place for approved OFCs
- No approve/reject/retire controls
- Submit button only visible for DRAFT

**Implementation:**
```typescript
// In field/ofcs/[id]/page.tsx
// Verify no forbidden controls exist

// ✅ Allowed
{ofc.status === 'DRAFT' && (
  <button onClick={handleSubmit}>Submit for Review</button>
)}

// ❌ Forbidden (must not exist)
{ofc.status === 'APPROVED' && (
  <button onClick={handleEdit}>Edit</button>  // FORBIDDEN
)}
{ofc.status === 'APPROVED' && (
  <button onClick={handleDelete}>Delete</button>  // FORBIDDEN
)}
```

### Admin UI Guards

**Required:**
- No create OFC controls
- No text editing
- decision_reason required in dialogs
- Buttons disabled during in-flight requests

**Implementation:**
```typescript
// In admin/ofcs/[ofc_id]/page.tsx
// Verify required guards

// ✅ Required validation
const handleReject = async () => {
  if (!rejectReason.trim()) {
    setError('Decision reason is required');
    return;  // Guard: cannot proceed without reason
  }
  // ...
};

// ✅ Disabled during processing
<button
  onClick={handleApprove}
  disabled={processing}  // Guard: prevent double-submission
>
  {processing ? 'Processing...' : 'Approve'}
</button>
```

### Test Cases (REQUIRED)

```typescript
// __tests__/ui_guards.test.tsx
describe('Field UI Guards', () => {
  it('should not render delete button', () => {
    // Snapshot test
  });
  
  it('should not render approve button for PSA', () => {
    // Role-based render test
  });
  
  it('should only show submit for DRAFT status', () => {
    // Status-based render test
  });
});

describe('Admin UI Guards', () => {
  it('should not render create OFC button', () => {
    // Snapshot test
  });
  
  it('should require decision_reason for reject', () => {
    // Validation test
  });
  
  it('should disable buttons during processing', () => {
    // State test
  });
});
```

---

## Implementation Checklist

### Backend (psa-backend)
- [ ] Role guard middleware implemented
- [ ] State transition validation implemented
- [ ] Database constraints added (DELETE revoke, UPDATE trigger)
- [ ] API DELETE routes return 405
- [ ] Test suite for role violations
- [ ] Test suite for state transitions
- [ ] Test suite for subtraction attempts

### Frontend (psa-web)
- [ ] API surface verification script
- [ ] UI guards implemented in field pages
- [ ] UI guards implemented in admin pages
- [ ] Snapshot tests for UI guards
- [ ] Role-based render tests

---

## Verification Commands

```bash
# Verify API surface
npm run verify:api-surface

# Run guard tests
npm run test:guards

# Verify UI guards
npm run test:ui-guards
```

---

**END OF SPECIFICATION**

