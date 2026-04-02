# MOVE Routes Implementation Plan

**Date:** 2025-12-21  
**Purpose:** Specification for reintroducing 15 MOVE routes in psa-backend  
**Status:** IMPLEMENTATION PLAN

---

## Overview

This document specifies the implementation of 15 API routes that were classified as MOVE in `docs/API_TRIAGE_v2.md`. These routes were removed from psa-web and must be implemented in psa-backend.

**Key Principle:** psa-web MUST NOT read filesystem for doctrine/artifacts. All filesystem access must be in psa-backend.

---

## MOVE Routes List (15 routes)

### Admin Routes with Filesystem Access (12 routes)

1. **GET /api/admin/coverage**
   - **Data Source:** psa_engine filesystem
   - **Namespace:** `/api/admin/coverage`
   - **Purpose:** Coverage browser for governance oversight
   - **Response:** Summary-level coverage data (not raw filesystem listings)

2. **GET /api/admin/candidates**
   - **Data Source:** `analytics/candidates/` directory
   - **Namespace:** `/api/admin/candidates`
   - **Purpose:** List candidate packages for review
   - **Response:** Array of candidate package summaries

3. **GET /api/admin/candidates/[discipline]/[subtype]**
   - **Data Source:** `analytics/candidates/[discipline]/[subtype].json`
   - **Namespace:** `/api/admin/candidates/[discipline]/[subtype]`
   - **Purpose:** Get specific candidate package
   - **Response:** Candidate package JSON (structured)

4. **GET /api/admin/analytics/coverage-dashboard**
   - **Data Source:** `psaback/tools/reports/CANONICAL_COVERAGE_DASHBOARD.json`
   - **Namespace:** `/api/admin/analytics/coverage-dashboard`
   - **Purpose:** Coverage dashboard metrics
   - **Response:** Coverage dashboard summary

5. **GET /api/admin/analytics/gap-analysis**
   - **Data Source:** `psaback/tools/reports/` (gap analysis files)
   - **Namespace:** `/api/admin/analytics/gap-analysis`
   - **Purpose:** Gap analysis data
   - **Response:** Gap analysis summary

6. **GET /api/admin/analytics/gap-reports**
   - **Data Source:** `psa_engine/analytics/gap_reports/`
   - **Namespace:** `/api/admin/analytics/gap-reports`
   - **Purpose:** Gap reports
   - **Response:** Gap reports summary

7. **GET /api/admin/analytics/gap-candidates**
   - **Data Source:** `psa_engine/analytics/gap_candidates/`
   - **Namespace:** `/api/admin/analytics/gap-candidates`
   - **Purpose:** Gap candidate data
   - **Response:** Gap candidates summary

8. **GET /api/admin/analytics/canonical-content**
   - **Data Source:** `psaback/tools/reports/` (canonical content files)
   - **Namespace:** `/api/admin/analytics/canonical-content`
   - **Purpose:** Canonical content dashboard
   - **Response:** Canonical content summary

9. **GET /api/admin/library-ingestion-status**
   - **Data Source:** `psa_engine/analytics/library/`
   - **Namespace:** `/api/admin/library-ingestion-status`
   - **Purpose:** Library ingestion status
   - **Response:** Library ingestion status summary

10. **GET /api/admin/ofc-evidence**
    - **Data Source:** `coverage_library/` filesystem
    - **Namespace:** `/api/admin/ofc-evidence`
    - **Purpose:** OFC evidence viewer
    - **Response:** OFC evidence summary (NO required_element_code references)

11. **GET /api/admin/taxonomy/disciplines**
    - **Data Source:** `psa_engine/docs/doctrine/taxonomy/disciplines.json`
    - **Namespace:** `/api/admin/taxonomy/disciplines`
    - **Purpose:** Get disciplines from canonical taxonomy file
    - **Response:** Disciplines JSON

12. **GET /api/admin/taxonomy/subtypes**
    - **Data Source:** `psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json`
    - **Namespace:** `/api/admin/taxonomy/subtypes`
    - **Purpose:** Get subtypes from canonical taxonomy file
    - **Response:** Subtypes JSON

### Review Statements Routes (3 routes)

13. **GET /api/review/statements**
    - **Data Source:** Database (cross-assessment scope)
    - **Namespace:** `/api/review/statements` OR `/api/runtime/review/statements`
    - **Purpose:** List review statements (cross-assessment)
    - **Response:** Array of review statements
    - **Note:** Cross-assessment scope - may need assessment-scoped alternative

14. **GET /api/review/statements/[id]**
    - **Data Source:** Database
    - **Namespace:** `/api/review/statements/[id]` OR `/api/runtime/review/statements/[id]`
    - **Methods:** GET, PATCH, DELETE
    - **Purpose:** CRUD operations for review statements
    - **Response:** Review statement object

15. **POST /api/review/statements/bulk**
    - **Data Source:** Database
    - **Namespace:** `/api/review/statements/bulk` OR `/api/runtime/review/statements/bulk`
    - **Methods:** POST
    - **Purpose:** Bulk operations for review statements
    - **Response:** Bulk operation result

---

## Implementation Requirements

### Step 1: Create Reference Provider Module

**Location:** `psa-backend/src/reference_provider/` (or equivalent)

**Functions Required:**

```python
# reference_provider/taxonomy.py
def get_taxonomy_disciplines() -> dict:
    """Load disciplines from psa_engine/docs/doctrine/taxonomy/disciplines.json"""
    pass

def get_taxonomy_subtypes() -> dict:
    """Load subtypes from psa_engine/docs/doctrine/taxonomy/discipline_subtypes.json"""
    pass

# reference_provider/candidates.py
def get_candidate_packages() -> list:
    """List candidate packages from analytics/candidates/"""
    pass

def get_candidate_package(discipline: str, subtype: str) -> dict:
    """Load specific candidate package from analytics/candidates/[discipline]/[subtype].json"""
    pass

# reference_provider/analytics.py
def get_coverage_dashboard() -> dict:
    """Load coverage dashboard from psaback/tools/reports/CANONICAL_COVERAGE_DASHBOARD.json"""
    pass

def get_gap_analysis() -> dict:
    """Load gap analysis from psaback/tools/reports/"""
    pass

def get_gap_reports() -> dict:
    """Load gap reports from psa_engine/analytics/gap_reports/"""
    pass

def get_gap_candidates() -> dict:
    """Load gap candidates from psa_engine/analytics/gap_candidates/"""
    pass

def get_canonical_content() -> dict:
    """Load canonical content from psaback/tools/reports/"""
    pass

# reference_provider/library.py
def get_library_ingestion_status() -> dict:
    """Load library ingestion status from psa_engine/analytics/library/"""
    pass

def get_coverage_data() -> dict:
    """Load coverage data from psa_engine filesystem"""
    pass

def get_ofc_evidence() -> dict:
    """Load OFC evidence from coverage_library/ (NO required_element_code)"""
    pass
```

**Rules:**
- All file reads must use path allowlist
- JSON schema validation (if available)
- Clear error messages when artifacts are missing
- No raw filesystem listings exposed
- Summary-level responses only

### Step 2: Implement Backend Routes

**Route Structure:**

All routes must be implemented under the same namespace paths as the API contract:
- `/api/admin/*` for admin routes
- `/api/review/*` or `/api/runtime/review/*` for review statements

**Route Implementation Pattern:**

```python
from flask import Blueprint, jsonify
from reference_provider import get_taxonomy_disciplines

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

@admin_bp.route('/taxonomy/disciplines', methods=['GET'])
def get_admin_taxonomy_disciplines():
    """GET /api/admin/taxonomy/disciplines"""
    try:
        data = get_taxonomy_disciplines()
        return jsonify(data), 200
    except FileNotFoundError:
        return jsonify({'error': 'Taxonomy file not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

**Requirements:**
- All routes are GET-only (read-only) unless explicitly runtime mutation
- Review statements routes may have POST/PATCH/DELETE (database mutations)
- Return deterministic JSON
- No filesystem browsing
- Summary-level responses (not raw artifacts)

### Step 3: Update psa-web Client Calls

**Environment Variable:**
```env
BACKEND_BASE_URL=http://localhost:5000
```

**Client Call Pattern:**

```typescript
// Before (removed from psa-web):
// const response = await fetch('/api/admin/taxonomy/disciplines');

// After (call backend):
const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:5000';
const response = await fetch(`${BACKEND_BASE_URL}/api/admin/taxonomy/disciplines`);
```

**Rules:**
- No Next.js route proxies (`app/api/**` handlers)
- No local filesystem reads
- Failures should be surfaced as truth ("data not available")
- All client calls must use `BACKEND_BASE_URL`

### Step 4: Data Source Mapping

| Route | Data Source | File Path Pattern |
|-------|-------------|-------------------|
| `/api/admin/coverage` | psa_engine filesystem | Coverage data files |
| `/api/admin/candidates` | analytics/candidates/ | Directory listing |
| `/api/admin/candidates/[discipline]/[subtype]` | analytics/candidates/ | `[discipline]/[subtype].json` |
| `/api/admin/analytics/coverage-dashboard` | psaback/tools/reports/ | `CANONICAL_COVERAGE_DASHBOARD.json` |
| `/api/admin/analytics/gap-analysis` | psaback/tools/reports/ | Gap analysis files |
| `/api/admin/analytics/gap-reports` | psa_engine/analytics/gap_reports/ | Gap report files |
| `/api/admin/analytics/gap-candidates` | psa_engine/analytics/gap_candidates/ | Gap candidate files |
| `/api/admin/analytics/canonical-content` | psaback/tools/reports/ | Canonical content files |
| `/api/admin/library-ingestion-status` | psa_engine/analytics/library/ | Library status files |
| `/api/admin/ofc-evidence` | coverage_library/ | OFC evidence files |
| `/api/admin/taxonomy/disciplines` | psa_engine/docs/doctrine/taxonomy/ | `disciplines.json` |
| `/api/admin/taxonomy/subtypes` | psa_engine/docs/doctrine/taxonomy/ | `discipline_subtypes.json` |
| `/api/review/statements` | Database | `review_statements` table |
| `/api/review/statements/[id]` | Database | `review_statements` table |
| `/api/review/statements/bulk` | Database | `review_statements` table |

---

## Constraints

### Locked Rules

1. **psa-web MUST NOT read filesystem** for doctrine/artifacts
2. **psa-web MUST NOT host MOVE routes** under `app/api/**`
3. **psa-backend serves MOVE routes** via HTTP APIs
4. **Admin endpoints are READ-ONLY** (no validators, no triggers)
5. **No required-elements / BASE-0xx concepts** anywhere
6. **No placeholders** - implement actual functionality

### Response Requirements

- **Summary-level data only** (not raw artifacts)
- **Structured JSON** (not raw file content)
- **Deterministic responses** (same input = same output)
- **Clear error messages** when data unavailable

---

## Verification Checklist

- [ ] All 15 MOVE routes implemented in psa-backend
- [ ] Reference provider module created with path allowlist
- [ ] All routes return summary-level data (not raw filesystem)
- [ ] psa-web client calls updated to use BACKEND_BASE_URL
- [ ] No psa-web route handlers for MOVE routes
- [ ] No filesystem reads in psa-web
- [ ] No required-elements or BASE-0xx references
- [ ] Admin endpoints are read-only (no validators/triggers)
- [ ] Review statements routes handle database mutations correctly
- [ ] Documentation updated in docs/STATUS.md

---

## Next Steps

1. **Implement reference_provider module** in psa-backend
2. **Implement 15 backend routes** using reference_provider
3. **Update psa-web client calls** to use BACKEND_BASE_URL
4. **Verify no filesystem access** in psa-web
5. **Update docs/STATUS.md** with completion note

---

**END OF IMPLEMENTATION PLAN**

