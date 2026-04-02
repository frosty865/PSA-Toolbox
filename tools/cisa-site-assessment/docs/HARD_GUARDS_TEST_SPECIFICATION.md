# Hard Guards Test Specification

**Date:** 2025-12-21  
**Purpose:** Test specifications for all hard guards  
**Status:** TEST SPECIFICATION

---

## Overview

This document specifies required test cases to verify all hard guards are working correctly. Tests must be implemented in both psa-backend and psa-web.

---

## A) ROLE GUARD TESTS — BACKEND

### Test Suite: `tests/test_role_guards.py`

```python
import pytest
from flask import Flask
from app import create_app

@pytest.fixture
def app():
    return create_app()

@pytest.fixture
def psa_user():
    return {'user_id': 'psa-123', 'role': 'PSA'}

@pytest.fixture
def governing_body_user():
    return {'user_id': 'gov-456', 'role': 'GOVERNING_BODY'}

@pytest.fixture
def engineering_user():
    return {'user_id': 'eng-789', 'role': 'ENGINEERING'}

class TestPSARoleGuards:
    """PSA role cannot access admin endpoints."""
    
    def test_psa_cannot_access_review_queue(self, app, psa_user):
        """PSA calling GET /api/admin/ofcs/review-queue → 403"""
        with app.test_client() as client:
            # Set PSA user in session/auth
            response = client.get('/api/admin/ofcs/review-queue')
            assert response.status_code == 403
            assert 'GOVERNING_BODY role required' in response.json['error']
    
    def test_psa_cannot_approve_ofc(self, app, psa_user):
        """PSA calling POST /api/admin/ofcs/{id}/approve → 403"""
        with app.test_client() as client:
            response = client.post('/api/admin/ofcs/test-id/approve', json={})
            assert response.status_code == 403
    
    def test_psa_cannot_reject_ofc(self, app, psa_user):
        """PSA calling POST /api/admin/ofcs/{id}/reject → 403"""
        with app.test_client() as client:
            response = client.post('/api/admin/ofcs/test-id/reject', json={'decision_reason': 'test'})
            assert response.status_code == 403
    
    def test_psa_cannot_retire_ofc(self, app, psa_user):
        """PSA calling POST /api/admin/ofcs/{id}/retire → 403"""
        with app.test_client() as client:
            response = client.post('/api/admin/ofcs/test-id/retire', json={'decision_reason': 'test'})
            assert response.status_code == 403

class TestGoverningBodyRoleGuards:
    """GOVERNING_BODY role cannot create/submit OFCs."""
    
    def test_governing_body_cannot_create_ofc(self, app, governing_body_user):
        """GOVERNING_BODY calling POST /api/runtime/ofcs → 403"""
        with app.test_client() as client:
            response = client.post('/api/runtime/ofcs', json={
                'ofc_text': 'test',
                'rationale': 'test'
            })
            assert response.status_code == 403
            assert 'cannot create' in response.json['error'].lower()
    
    def test_governing_body_cannot_submit_ofc(self, app, governing_body_user):
        """GOVERNING_BODY calling POST /api/runtime/ofcs/{id}/submit → 403"""
        with app.test_client() as client:
            response = client.post('/api/runtime/ofcs/test-id/submit')
            assert response.status_code == 403
    
    def test_governing_body_cannot_propose_change(self, app, governing_body_user):
        """GOVERNING_BODY calling POST /api/runtime/ofcs/{rootId}/propose-change → 403"""
        with app.test_client() as client:
            response = client.post('/api/runtime/ofcs/test-root/propose-change', json={
                'ofc_text': 'test',
                'rationale': 'test'
            })
            assert response.status_code == 403

class TestEngineeringRoleGuards:
    """ENGINEERING role has no implicit access."""
    
    def test_engineering_cannot_access_admin_endpoints(self, app, engineering_user):
        """ENGINEERING calling /api/admin/ofcs/* → 403"""
        with app.test_client() as client:
            response = client.get('/api/admin/ofcs/review-queue')
            assert response.status_code == 403
    
    def test_engineering_cannot_access_runtime_endpoints(self, app, engineering_user):
        """ENGINEERING calling /api/runtime/ofcs/* → 403"""
        with app.test_client() as client:
            response = client.post('/api/runtime/ofcs', json={
                'ofc_text': 'test',
                'rationale': 'test'
            })
            assert response.status_code == 403
```

---

## B) STATE TRANSITION GUARD TESTS — BACKEND

### Test Suite: `tests/test_state_transitions.py`

```python
import pytest
from app.routes.admin.ofcs import validate_state_transition

class TestStateTransitions:
    """Test valid and invalid state transitions."""
    
    def test_approve_draft_fails(self):
        """Approve DRAFT → 409"""
        assert not validate_state_transition('DRAFT', 'APPROVED')
    
    def test_retire_submitted_fails(self):
        """Retire SUBMITTED → 409"""
        assert not validate_state_transition('SUBMITTED', 'RETIRED')
    
    def test_submit_approved_fails(self):
        """Submit APPROVED → 409"""
        assert not validate_state_transition('APPROVED', 'SUBMITTED')
    
    def test_reject_retired_fails(self):
        """Reject RETIRED → 409"""
        assert not validate_state_transition('RETIRED', 'REJECTED')
    
    def test_valid_transitions(self):
        """Test all valid transitions pass."""
        assert validate_state_transition('DRAFT', 'SUBMITTED')
        assert validate_state_transition('SUBMITTED', 'UNDER_REVIEW')
        assert validate_state_transition('UNDER_REVIEW', 'APPROVED')
        assert validate_state_transition('UNDER_REVIEW', 'REJECTED')
        assert validate_state_transition('UNDER_REVIEW', 'DRAFT')
        assert validate_state_transition('APPROVED', 'SUPERSEDED')
        assert validate_state_transition('APPROVED', 'RETIRED')
    
    def test_endpoint_enforces_transitions(self, app, governing_body_user):
        """Test that endpoints return 409 on invalid transitions."""
        # Create a DRAFT OFC
        ofc_id = create_test_ofc(status='DRAFT')
        
        # Attempt to approve it (should fail)
        with app.test_client() as client:
            response = client.post(f'/api/admin/ofcs/{ofc_id}/approve', json={})
            assert response.status_code == 409
            assert 'Invalid transition' in response.json['error']
```

---

## C) SUBTRACTION GUARD TESTS — BACKEND

### Test Suite: `tests/test_subtraction_guards.py`

```python
import pytest
from app.database import get_db_connection

class TestSubtractionGuards:
    """Test that subtraction operations are impossible."""
    
    def test_delete_returns_405(self, app, governing_body_user):
        """DELETE /api/admin/ofcs/{id} → 405 Method Not Allowed"""
        ofc_id = create_test_ofc()
        
        with app.test_client() as client:
            response = client.delete(f'/api/admin/ofcs/{ofc_id}')
            assert response.status_code == 405
            assert 'DELETE not allowed' in response.json['error']
    
    def test_update_approved_content_fails(self, app, governing_body_user):
        """UPDATE approved ofc_text → blocked"""
        ofc_id = create_test_ofc(status='APPROVED')
        
        with app.test_client() as client:
            response = client.patch(f'/api/admin/ofcs/{ofc_id}', json={
                'ofc_text': 'Modified text'
            })
            assert response.status_code == 409
            assert 'Cannot modify approved OFC' in response.json['error']
    
    def test_retire_without_reason_fails(self, app, governing_body_user):
        """Retire without decision_reason → 422"""
        ofc_id = create_test_ofc(status='APPROVED')
        
        with app.test_client() as client:
            response = client.post(f'/api/admin/ofcs/{ofc_id}/retire', json={})
            assert response.status_code == 422
            assert 'decision_reason is required' in response.json['error']
    
    def test_database_delete_permission_revoked(self):
        """Verify database role cannot DELETE."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Attempt DELETE (should fail with permission error)
        with pytest.raises(Exception) as exc_info:
            cursor.execute("DELETE FROM ofcs WHERE ofc_id = 'test-id'")
        
        assert 'permission denied' in str(exc_info.value).lower() or \
               'insufficient privilege' in str(exc_info.value).lower()
    
    def test_database_trigger_blocks_approved_updates(self):
        """Verify database trigger blocks approved OFC content updates."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create approved OFC
        ofc_id = create_test_ofc(status='APPROVED')
        
        # Attempt to update content (should fail)
        with pytest.raises(Exception) as exc_info:
            cursor.execute("""
                UPDATE ofcs 
                SET ofc_text = 'Modified'
                WHERE ofc_id = %s
            """, (ofc_id,))
            conn.commit()
        
        assert 'cannot modify approved' in str(exc_info.value).lower()
```

---

## D) API SURFACE GUARD TESTS — PSA-WEB

### Test Suite: `__tests__/api_surface.test.ts`

```typescript
import { verifyApiSurface } from '../scripts/verify_api_surface';

describe('API Surface Guards', () => {
  it('should only expose KEEP routes', () => {
    const { violations, passed } = verifyApiSurface();
    expect(passed).toBe(true);
    expect(violations).toHaveLength(0);
  });
  
  it('should not expose validator endpoints', () => {
    // Verify no /api/admin/validate/* routes exist
    const routeFiles = glob.sync('app/api/admin/validate/**/route.ts');
    expect(routeFiles).toHaveLength(0);
  });
  
  it('should not expose log endpoints', () => {
    // Verify no /api/logs route exists
    const routeFiles = glob.sync('app/api/logs/route.ts');
    expect(routeFiles).toHaveLength(0);
  });
  
  it('should not expose system diagnostic endpoints', () => {
    // Verify no /api/system/* routes exist
    const routeFiles = glob.sync('app/api/system/**/route.ts');
    expect(routeFiles).toHaveLength(0);
  });
});
```

---

## E) UI SAFETY GUARD TESTS — PSA-WEB

### Test Suite: `__tests__/ui_guards.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import FieldOfcDetailPage from '@/app/field/ofcs/[id]/page';
import AdminOfcReviewPage from '@/app/admin/ofcs/[ofc_id]/page';

describe('Field UI Guards', () => {
  it('should not render delete button', () => {
    const ofc = { ofc_id: '1', status: 'DRAFT', ofc_text: 'Test', rationale: 'Test' };
    render(<FieldOfcDetailPage />);
    
    const deleteButton = screen.queryByText(/delete/i);
    expect(deleteButton).not.toBeInTheDocument();
  });
  
  it('should not render approve button for PSA', () => {
    const ofc = { ofc_id: '1', status: 'SUBMITTED', ofc_text: 'Test', rationale: 'Test' };
    render(<FieldOfcDetailPage />);
    
    const approveButton = screen.queryByText(/approve/i);
    expect(approveButton).not.toBeInTheDocument();
  });
  
  it('should only show submit for DRAFT status', () => {
    const draftOfc = { ofc_id: '1', status: 'DRAFT', ofc_text: 'Test', rationale: 'Test' };
    render(<FieldOfcDetailPage />);
    
    const submitButton = screen.queryByText(/submit for review/i);
    // Should only appear for DRAFT
    // Implementation depends on how component receives OFC data
  });
  
  it('should not allow edit-in-place of approved OFCs', () => {
    const approvedOfc = { ofc_id: '1', status: 'APPROVED', ofc_text: 'Test', rationale: 'Test' };
    render(<FieldOfcDetailPage />);
    
    const editButton = screen.queryByText(/edit/i);
    expect(editButton).not.toBeInTheDocument();
  });
});

describe('Admin UI Guards', () => {
  it('should not render create OFC button', () => {
    render(<AdminOfcReviewPage />);
    
    const createButton = screen.queryByText(/create|nominate|new ofc/i);
    expect(createButton).not.toBeInTheDocument();
  });
  
  it('should require decision_reason for reject', () => {
    render(<AdminOfcReviewPage />);
    
    const rejectButton = screen.getByText(/reject/i);
    rejectButton.click();
    
    const reasonInput = screen.getByLabelText(/decision reason/i);
    expect(reasonInput).toBeRequired();
  });
  
  it('should disable buttons during processing', () => {
    const { rerender } = render(<AdminOfcReviewPage processing={false} />);
    
    const approveButton = screen.getByText(/approve/i);
    expect(approveButton).not.toBeDisabled();
    
    rerender(<AdminOfcReviewPage processing={true} />);
    expect(approveButton).toBeDisabled();
  });
});
```

---

## Test Execution

### Backend Tests
```bash
# Run all guard tests
pytest tests/test_role_guards.py tests/test_state_transitions.py tests/test_subtraction_guards.py -v

# Run specific test suite
pytest tests/test_role_guards.py::TestPSARoleGuards -v
```

### Frontend Tests
```bash
# Run API surface verification
npm run verify:api-surface

# Run UI guard tests
npm run test:ui-guards

# Run all tests
npm test
```

---

## Test Coverage Requirements

### Minimum Coverage
- **Role Guards:** 100% of role combinations tested
- **State Transitions:** All valid and invalid transitions tested
- **Subtraction Guards:** All subtraction attempts tested
- **API Surface:** All routes verified
- **UI Guards:** All forbidden controls verified absent

---

**END OF TEST SPECIFICATION**

