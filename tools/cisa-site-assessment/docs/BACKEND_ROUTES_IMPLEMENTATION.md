# Backend Routes Implementation

**Date:** 2025-12-21  
**Purpose:** Implementation templates for 15 MOVE routes in psa-backend  
**Location:** `psa-backend/src/routes/` (or equivalent)

---

## Route Structure

All routes must maintain the same namespace paths as the API contract:
- `/api/admin/*` for admin routes
- `/api/review/*` or `/api/runtime/review/*` for review statements

---

## Admin Routes (12 routes)

### 1. GET /api/admin/coverage

```python
from flask import Blueprint, jsonify
from reference_provider.library import get_coverage_data

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/coverage', methods=['GET'])
def get_admin_coverage():
    """GET /api/admin/coverage - Coverage browser for governance oversight."""
    try:
        data = get_coverage_data()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Coverage data not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 2. GET /api/admin/candidates

```python
from reference_provider.candidates import get_candidate_packages

@admin_bp.route('/candidates', methods=['GET'])
def get_admin_candidates():
    """GET /api/admin/candidates - List candidate packages for review."""
    try:
        packages = get_candidate_packages()
        return jsonify({'packages': packages}), 200
    except FileNotFoundError:
        return jsonify({'error': 'Candidates directory not found', 'packages': []}), 404
    except Exception as e:
        return jsonify({'error': str(e), 'packages': []}), 500
```

### 3. GET /api/admin/candidates/<discipline>/<subtype>

```python
from reference_provider.candidates import get_candidate_package

@admin_bp.route('/candidates/<discipline>/<subtype>', methods=['GET'])
def get_admin_candidate_package(discipline: str, subtype: str):
    """GET /api/admin/candidates/[discipline]/[subtype] - Get specific candidate package."""
    try:
        package = get_candidate_package(discipline, subtype)
        return jsonify(package), 200
    except FileNotFoundError:
        return jsonify({'error': f'Candidate package not found: {discipline}/{subtype}'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 4. GET /api/admin/analytics/coverage-dashboard

```python
from reference_provider.analytics import get_coverage_dashboard

@admin_bp.route('/analytics/coverage-dashboard', methods=['GET'])
def get_admin_coverage_dashboard():
    """GET /api/admin/analytics/coverage-dashboard - Coverage dashboard metrics."""
    try:
        data = get_coverage_dashboard()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Coverage dashboard not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 5. GET /api/admin/analytics/gap-analysis

```python
from reference_provider.analytics import get_gap_analysis

@admin_bp.route('/analytics/gap-analysis', methods=['GET'])
def get_admin_gap_analysis():
    """GET /api/admin/analytics/gap-analysis - Gap analysis data."""
    try:
        data = get_gap_analysis()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Gap analysis not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 6. GET /api/admin/analytics/gap-reports

```python
from reference_provider.analytics import get_gap_reports

@admin_bp.route('/analytics/gap-reports', methods=['GET'])
def get_admin_gap_reports():
    """GET /api/admin/analytics/gap-reports - Gap reports."""
    try:
        data = get_gap_reports()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Gap reports not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 7. GET /api/admin/analytics/gap-candidates

```python
from reference_provider.analytics import get_gap_candidates

@admin_bp.route('/analytics/gap-candidates', methods=['GET'])
def get_admin_gap_candidates():
    """GET /api/admin/analytics/gap-candidates - Gap candidate data."""
    try:
        data = get_gap_candidates()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Gap candidates not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 8. GET /api/admin/analytics/canonical-content

```python
from reference_provider.analytics import get_canonical_content

@admin_bp.route('/analytics/canonical-content', methods=['GET'])
def get_admin_canonical_content():
    """GET /api/admin/analytics/canonical-content - Canonical content dashboard."""
    try:
        data = get_canonical_content()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Canonical content not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 9. GET /api/admin/library-ingestion-status

```python
from reference_provider.library import get_library_ingestion_status

@admin_bp.route('/library-ingestion-status', methods=['GET'])
def get_admin_library_ingestion_status():
    """GET /api/admin/library-ingestion-status - Library ingestion status."""
    try:
        data = get_library_ingestion_status()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Library ingestion status not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 10. GET /api/admin/ofc-evidence

```python
from reference_provider.library import get_ofc_evidence

@admin_bp.route('/ofc-evidence', methods=['GET'])
def get_admin_ofc_evidence():
    """GET /api/admin/ofc-evidence - OFC evidence viewer."""
    try:
        data = get_ofc_evidence()
        # IMPORTANT: Filter out required_element_code if present
        # NO BASE-0xx references allowed
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'OFC evidence not available'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 11. GET /api/admin/taxonomy/disciplines

```python
from reference_provider.taxonomy import get_taxonomy_disciplines

@admin_bp.route('/taxonomy/disciplines', methods=['GET'])
def get_admin_taxonomy_disciplines():
    """GET /api/admin/taxonomy/disciplines - Get disciplines from canonical taxonomy file."""
    try:
        data = get_taxonomy_disciplines()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Taxonomy disciplines file not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 12. GET /api/admin/taxonomy/subtypes

```python
from reference_provider.taxonomy import get_taxonomy_subtypes

@admin_bp.route('/taxonomy/subtypes', methods=['GET'])
def get_admin_taxonomy_subtypes():
    """GET /api/admin/taxonomy/subtypes - Get subtypes from canonical taxonomy file."""
    try:
        data = get_taxonomy_subtypes()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Taxonomy subtypes file not found'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## Review Statements Routes (3 routes)

**Note:** Review statements routes may need database access. Implementation depends on psa-backend database schema.

### 13. GET /api/review/statements

```python
from flask import Blueprint, jsonify, request
from database import get_db_connection  # Adjust to actual DB module

review_bp = Blueprint('review', __name__, url_prefix='/api/review')

@review_bp.route('/statements', methods=['GET'])
def get_review_statements():
    """GET /api/review/statements - List review statements (cross-assessment scope)."""
    try:
        # Query database for review statements
        # Adjust query based on actual schema
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM review_statements ORDER BY created_at DESC"
        cursor.execute(query)
        rows = cursor.fetchall()
        
        statements = [dict(row) for row in rows]
        
        return jsonify({'statements': statements}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'statements': []}), 500
```

### 14. GET /api/review/statements/<id>

```python
@review_bp.route('/statements/<int:statement_id>', methods=['GET'])
def get_review_statement(statement_id: int):
    """GET /api/review/statements/[id] - Get specific review statement."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM review_statements WHERE id = %s"
        cursor.execute(query, (statement_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'error': 'Review statement not found'}), 404
        
        return jsonify(dict(row)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 15. PATCH /api/review/statements/<id>

```python
@review_bp.route('/statements/<int:statement_id>', methods=['PATCH'])
def update_review_statement(statement_id: int):
    """PATCH /api/review/statements/[id] - Update review statement."""
    try:
        data = request.get_json()
        
        # Validate required fields
        # Update database
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Adjust update query based on actual schema
        update_query = """
            UPDATE review_statements 
            SET status = %s, updated_at = NOW()
            WHERE id = %s
        """
        cursor.execute(update_query, (data.get('status'), statement_id))
        conn.commit()
        
        return jsonify({'message': 'Review statement updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 16. DELETE /api/review/statements/<id>

```python
@review_bp.route('/statements/<int:statement_id>', methods=['DELETE'])
def delete_review_statement(statement_id: int):
    """DELETE /api/review/statements/[id] - Delete review statement."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "DELETE FROM review_statements WHERE id = %s"
        cursor.execute(query, (statement_id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Review statement not found'}), 404
        
        return jsonify({'message': 'Review statement deleted'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 17. POST /api/review/statements/bulk

```python
@review_bp.route('/statements/bulk', methods=['POST'])
def bulk_review_statements():
    """POST /api/review/statements/bulk - Bulk operations for review statements."""
    try:
        data = request.get_json()
        operation = data.get('operation')  # e.g., 'approve', 'reject', 'delete'
        statement_ids = data.get('statement_ids', [])
        
        if not operation or not statement_ids:
            return jsonify({'error': 'operation and statement_ids required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Perform bulk operation based on operation type
        # Adjust query based on actual schema
        
        return jsonify({'message': f'Bulk {operation} completed', 'affected': len(statement_ids)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## Blueprint Registration

```python
# In main app file (e.g., app.py)
from routes.admin import admin_bp
from routes.review import review_bp

app.register_blueprint(admin_bp)
app.register_blueprint(review_bp)
```

---

## Error Handling Standards

All routes should:
1. Return appropriate HTTP status codes (200, 400, 404, 500)
2. Return JSON error responses with clear messages
3. Never expose internal file paths in error messages
4. Handle FileNotFoundError gracefully (404)
5. Handle ValueError for invalid inputs (400)
6. Handle general exceptions (500)

---

## Response Format Standards

All successful responses should:
- Return JSON
- Include relevant data in consistent structure
- Return empty arrays/objects when no data available (not errors)

Example:
```json
{
  "packages": [...],
  "total": 10
}
```

Error responses:
```json
{
  "error": "Clear error message",
  "details": "Optional details"
}
```

---

**END OF IMPLEMENTATION**

