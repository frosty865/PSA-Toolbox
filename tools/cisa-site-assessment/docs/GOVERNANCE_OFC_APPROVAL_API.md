# Governance OFC Approval API Implementation

**Date:** 2025-12-21  
**Purpose:** API endpoint implementations for Governance OFC Approval  
**Location:** psa-backend `src/routes/admin/ofcs.py` (or equivalent)

---

## Overview

All endpoints require `GOVERNING_BODY` role. PSAs and Engineering roles receive 403 Forbidden.

**Namespace:** `/api/admin/ofcs/*`

---

## Authorization Decorator

```python
from functools import wraps
from flask import jsonify, g

def require_governing_body(f):
    """Decorator to require GOVERNING_BODY role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get current user from request context (adjust based on auth system)
        user = g.current_user  # Adjust to actual auth system
        
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        
        if user.role != 'GOVERNING_BODY':
            return jsonify({'error': 'GOVERNING_BODY role required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function
```

---

## Endpoint 1: List Review Queue

```python
from flask import Blueprint, jsonify
from database import get_db_connection

admin_ofcs_bp = Blueprint('admin_ofcs', __name__, url_prefix='/api/admin/ofcs')

@admin_ofcs_bp.route('/review-queue', methods=['GET'])
@require_governing_body
def get_review_queue():
    """
    GET /api/admin/ofcs/review-queue
    
    Returns OFCs with status IN ('SUBMITTED','UNDER_REVIEW').
    Sorted by submitted_at ASC (oldest first).
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                ofc_id,
                ofc_root_id,
                version,
                status,
                ofc_text,
                rationale,
                context_conditions,
                submitted_by,
                submitted_at,
                supersedes_ofc_id
            FROM ofcs
            WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')
            ORDER BY submitted_at ASC NULLS LAST
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        ofcs = []
        for row in cursor.fetchall():
            ofcs.append({
                'ofc_id': str(row[0]),
                'ofc_root_id': str(row[1]),
                'version': row[2],
                'status': row[3],
                'ofc_text': row[4],
                'rationale': row[5],
                'context_conditions': row[6],
                'submitted_by': str(row[7]) if row[7] else None,
                'submitted_at': row[8].isoformat() if row[8] else None,
                'supersedes_ofc_id': str(row[9]) if row[9] else None
            })
        
        return jsonify(ofcs), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 2: Begin Review (Claim for Review)

```python
@admin_ofcs_bp.route('/<ofc_id>/begin-review', methods=['POST'])
@require_governing_body
def begin_review(ofc_id):
    """
    POST /api/admin/ofcs/{ofc_id}/begin-review
    
    Transitions SUBMITTED → UNDER_REVIEW.
    Idempotent if already UNDER_REVIEW.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current status
        cursor.execute("SELECT status FROM ofcs WHERE ofc_id = %s", (ofc_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'OFC not found'}), 404
        
        current_status = row[0]
        
        # If already UNDER_REVIEW, return success (idempotent)
        if current_status == 'UNDER_REVIEW':
            return jsonify({
                'ofc_id': ofc_id,
                'status': 'UNDER_REVIEW'
            }), 200
        
        # Validate transition
        if current_status != 'SUBMITTED':
            return jsonify({
                'error': f'Invalid transition: {current_status} → UNDER_REVIEW. Only SUBMITTED can transition to UNDER_REVIEW.'
            }), 409
        
        # Get current user
        user_id = g.current_user.user_id
        
        # Transition
        cursor.execute("""
            UPDATE ofcs
            SET status = 'UNDER_REVIEW',
                updated_at = now()
            WHERE ofc_id = %s
        """, (ofc_id,))
        
        # Record audit
        cursor.execute("""
            INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by)
            VALUES (%s, %s, %s, %s)
        """, (ofc_id, current_status, 'UNDER_REVIEW', user_id))
        
        conn.commit()
        
        return jsonify({
            'ofc_id': ofc_id,
            'status': 'UNDER_REVIEW'
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 3: Approve OFC

```python
@admin_ofcs_bp.route('/<ofc_id>/approve', methods=['POST'])
@require_governing_body
def approve_ofc(ofc_id):
    """
    POST /api/admin/ofcs/{ofc_id}/approve
    
    Transitions SUBMITTED/UNDER_REVIEW → APPROVED.
    Handles supersession if supersedes_ofc_id is set.
    """
    try:
        data = request.get_json() or {}
        notes = data.get('notes')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current OFC
        cursor.execute("""
            SELECT status, supersedes_ofc_id
            FROM ofcs
            WHERE ofc_id = %s
        """, (ofc_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'OFC not found'}), 404
        
        current_status = row[0]
        supersedes_ofc_id = row[1]
        
        # Validate transition
        if current_status not in ('SUBMITTED', 'UNDER_REVIEW'):
            return jsonify({
                'error': f'Invalid transition: {current_status} → APPROVED. Only SUBMITTED or UNDER_REVIEW can be approved.'
            }), 409
        
        # Get current user
        user_id = g.current_user.user_id
        
        # Handle supersession
        if supersedes_ofc_id:
            # Validate superseded OFC exists and is APPROVED
            cursor.execute("""
                SELECT status FROM ofcs WHERE ofc_id = %s
            """, (supersedes_ofc_id,))
            superseded_row = cursor.fetchone()
            
            if not superseded_row:
                return jsonify({'error': 'Superseded OFC not found'}), 400
            
            if superseded_row[0] != 'APPROVED':
                return jsonify({
                    'error': f'Superseded OFC must be APPROVED, found: {superseded_row[0]}'
                }), 400
            
            # Transition superseded OFC to SUPERSEDED
            cursor.execute("""
                UPDATE ofcs
                SET status = 'SUPERSEDED',
                    updated_at = now()
                WHERE ofc_id = %s
            """, (supersedes_ofc_id,))
            
            # Record audit for superseded OFC
            cursor.execute("""
                INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, notes)
                VALUES (%s, %s, %s, %s, %s)
            """, (supersedes_ofc_id, 'APPROVED', 'SUPERSEDED', user_id, f'Superseded by {ofc_id}'))
        
        # Transition to APPROVED
        cursor.execute("""
            UPDATE ofcs
            SET status = 'APPROVED',
                approved_by = %s,
                approved_at = now(),
                updated_at = now()
            WHERE ofc_id = %s
        """, (user_id, ofc_id))
        
        # Record audit
        cursor.execute("""
            INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, notes)
            VALUES (%s, %s, %s, %s, %s)
        """, (ofc_id, current_status, 'APPROVED', user_id, notes))
        
        conn.commit()
        
        # Get approved_at timestamp
        cursor.execute("SELECT approved_at FROM ofcs WHERE ofc_id = %s", (ofc_id,))
        approved_at = cursor.fetchone()[0]
        
        return jsonify({
            'ofc_id': ofc_id,
            'status': 'APPROVED',
            'approved_at': approved_at.isoformat()
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 4: Reject OFC

```python
@admin_ofcs_bp.route('/<ofc_id>/reject', methods=['POST'])
@require_governing_body
def reject_ofc(ofc_id):
    """
    POST /api/admin/ofcs/{ofc_id}/reject
    
    Transitions SUBMITTED/UNDER_REVIEW → REJECTED.
    Requires decision_reason.
    """
    try:
        data = request.get_json()
        
        if not data or 'decision_reason' not in data:
            return jsonify({'error': 'decision_reason is required'}), 400
        
        decision_reason = data['decision_reason']
        
        if not decision_reason or not decision_reason.strip():
            return jsonify({'error': 'decision_reason cannot be empty'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current status
        cursor.execute("SELECT status FROM ofcs WHERE ofc_id = %s", (ofc_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'OFC not found'}), 404
        
        current_status = row[0]
        
        # Validate transition
        if current_status not in ('SUBMITTED', 'UNDER_REVIEW'):
            return jsonify({
                'error': f'Invalid transition: {current_status} → REJECTED. Only SUBMITTED or UNDER_REVIEW can be rejected.'
            }), 409
        
        # Get current user
        user_id = g.current_user.user_id
        
        # Transition
        cursor.execute("""
            UPDATE ofcs
            SET status = 'REJECTED',
                decision_reason = %s,
                updated_at = now()
            WHERE ofc_id = %s
        """, (decision_reason, ofc_id))
        
        # Record audit
        cursor.execute("""
            INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, decision_reason)
            VALUES (%s, %s, %s, %s, %s)
        """, (ofc_id, current_status, 'REJECTED', user_id, decision_reason))
        
        conn.commit()
        
        return jsonify({
            'ofc_id': ofc_id,
            'status': 'REJECTED'
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 5: Request Revision

```python
@admin_ofcs_bp.route('/<ofc_id>/request-revision', methods=['POST'])
@require_governing_body
def request_revision(ofc_id):
    """
    POST /api/admin/ofcs/{ofc_id}/request-revision
    
    Transitions SUBMITTED/UNDER_REVIEW → DRAFT.
    Requires decision_reason (reason for revision request).
    """
    try:
        data = request.get_json()
        
        if not data or 'decision_reason' not in data:
            return jsonify({'error': 'decision_reason is required'}), 400
        
        decision_reason = data['decision_reason']
        
        if not decision_reason or not decision_reason.strip():
            return jsonify({'error': 'decision_reason cannot be empty'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current status
        cursor.execute("SELECT status FROM ofcs WHERE ofc_id = %s", (ofc_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'OFC not found'}), 404
        
        current_status = row[0]
        
        # Validate transition
        if current_status not in ('SUBMITTED', 'UNDER_REVIEW'):
            return jsonify({
                'error': f'Invalid transition: {current_status} → DRAFT. Only SUBMITTED or UNDER_REVIEW can be sent back for revision.'
            }), 409
        
        # Get current user
        user_id = g.current_user.user_id
        
        # Transition
        cursor.execute("""
            UPDATE ofcs
            SET status = 'DRAFT',
                decision_reason = %s,
                submitted_by = NULL,
                submitted_at = NULL,
                updated_at = now()
            WHERE ofc_id = %s
        """, (decision_reason, ofc_id))
        
        # Record audit
        cursor.execute("""
            INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, decision_reason)
            VALUES (%s, %s, %s, %s, %s)
        """, (ofc_id, current_status, 'DRAFT', user_id, decision_reason))
        
        conn.commit()
        
        return jsonify({
            'ofc_id': ofc_id,
            'status': 'DRAFT'
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 6: Retire Approved OFC

```python
@admin_ofcs_bp.route('/<ofc_id>/retire', methods=['POST'])
@require_governing_body
def retire_ofc(ofc_id):
    """
    POST /api/admin/ofcs/{ofc_id}/retire
    
    Transitions APPROVED → RETIRED.
    Requires decision_reason.
    """
    try:
        data = request.get_json()
        
        if not data or 'decision_reason' not in data:
            return jsonify({'error': 'decision_reason is required'}), 400
        
        decision_reason = data['decision_reason']
        
        if not decision_reason or not decision_reason.strip():
            return jsonify({'error': 'decision_reason cannot be empty'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current status
        cursor.execute("SELECT status FROM ofcs WHERE ofc_id = %s", (ofc_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'OFC not found'}), 404
        
        current_status = row[0]
        
        # Validate transition
        if current_status != 'APPROVED':
            return jsonify({
                'error': f'Invalid transition: {current_status} → RETIRED. Only APPROVED OFCs can be retired.'
            }), 409
        
        # Get current user
        user_id = g.current_user.user_id
        
        # Transition
        cursor.execute("""
            UPDATE ofcs
            SET status = 'RETIRED',
                decision_reason = %s,
                updated_at = now()
            WHERE ofc_id = %s
        """, (decision_reason, ofc_id))
        
        # Record audit
        cursor.execute("""
            INSERT INTO ofc_state_transitions (ofc_id, from_status, to_status, transitioned_by, decision_reason)
            VALUES (%s, %s, %s, %s, %s)
        """, (ofc_id, current_status, 'RETIRED', user_id, decision_reason))
        
        conn.commit()
        
        return jsonify({
            'ofc_id': ofc_id,
            'status': 'RETIRED'
        }), 200
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
```

---

## Endpoint 7: Read OFC History

```python
@admin_ofcs_bp.route('/<ofc_root_id>/history', methods=['GET'])
@require_governing_body
def get_ofc_history(ofc_root_id):
    """
    GET /api/admin/ofcs/{ofc_root_id}/history
    
    Returns all versions for ofc_root_id.
    Includes approvals, rejections, superseded/retired status, decision reasons.
    Sorted by version ASC.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                ofc_id,
                version,
                status,
                ofc_text,
                rationale,
                submitted_by,
                submitted_at,
                approved_by,
                approved_at,
                decision_reason,
                supersedes_ofc_id
            FROM ofcs
            WHERE ofc_root_id = %s
            ORDER BY version ASC
        """
        
        cursor.execute(query, (ofc_root_id,))
        rows = cursor.fetchall()
        
        if not rows:
            return jsonify({'error': 'OFC root not found'}), 404
        
        history = []
        for row in rows:
            history.append({
                'ofc_id': str(row[0]),
                'version': row[1],
                'status': row[2],
                'ofc_text': row[3],
                'rationale': row[4],
                'submitted_by': str(row[5]) if row[5] else None,
                'submitted_at': row[6].isoformat() if row[6] else None,
                'approved_by': str(row[7]) if row[7] else None,
                'approved_at': row[8].isoformat() if row[8] else None,
                'decision_reason': row[9],
                'supersedes_ofc_id': str(row[10]) if row[10] else None
            })
        
        return jsonify(history), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## Blueprint Registration

```python
# In main app file (e.g., app.py)
from routes.admin.ofcs import admin_ofcs_bp

app.register_blueprint(admin_ofcs_bp)
```

---

## Error Responses

### 400 Bad Request
- Missing required fields (decision_reason)
- Invalid supersedes_ofc_id reference

### 403 Forbidden
- User does not have GOVERNING_BODY role

### 404 Not Found
- OFC not found
- OFC root not found

### 409 Conflict
- Invalid state transition (e.g., trying to approve an already APPROVED OFC)

### 500 Internal Server Error
- Database errors
- Unexpected exceptions

---

**END OF API IMPLEMENTATION**

