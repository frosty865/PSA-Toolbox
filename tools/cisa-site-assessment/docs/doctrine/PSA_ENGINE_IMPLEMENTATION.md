# PSA Engine Implementation Guide: Deprecate BASE-0xx Elements

## Overview

This guide provides step-by-step instructions for implementing the deprecation of legacy BASE-0xx required elements in the `psa_engine` repository.

## Step 1: Copy Helper Module

Copy the `tools/deprecated_elements.py` module from `psa_rebuild` to `psa_engine/tools/`:

```bash
# From psa_rebuild repository
cp tools/deprecated_elements.py ../psa_engine/tools/
```

Or create it directly in `psa_engine/tools/deprecated_elements.py` with the content from the previous step.

## Step 2: Apply Database Migrations

Run the SQL migrations in order:

```bash
cd psa_engine
psql -d your_database_name -f migrations/20250127_add_required_elements_deprecation.sql
psql -d your_database_name -f migrations/20250127_deprecate_base_0xx_video_surveillance.sql
```

**Note**: Copy the migration files from `psa_rebuild/migrations/` to `psa_engine/migrations/` if they don't exist there.

## Step 3: Update OFC Generation Logic

Locate your OFC generation module (typically in `psa_engine/tools/` or `psa_engine/api/`). 

### Example: Flask API Route

If OFC generation is in a Flask route (`api/v2/assessments/<assessment_id>/ofcs`):

```python
from flask import Blueprint, jsonify, request
from tools.deprecated_elements import should_skip_ofc_generation, log_skipped_ofc
import logging

logger = logging.getLogger(__name__)

@bp.route('/api/v2/assessments/<assessment_id>/ofcs', methods=['GET'])
def get_assessment_ofcs(assessment_id):
    """
    Get OFCs for an assessment, excluding deprecated required elements.
    """
    # ... existing code to get assessment and responses ...
    
    ofcs = []
    
    # Get required elements for the assessment
    required_elements = get_required_elements_for_assessment(assessment_id)
    responses = get_responses_for_assessment(assessment_id)
    
    # Filter to only NO responses (vulnerabilities)
    no_responses = [r for r in responses if r.get('response') == 'NO']
    
    for response in no_responses:
        # Find the corresponding required element
        element_id = response.get('required_element_id')
        required_element = next(
            (el for el in required_elements if el.get('element_id') == element_id),
            None
        )
        
        if not required_element:
            continue
        
        # GUARD: Skip deprecated elements
        should_skip, reason = should_skip_ofc_generation(required_element)
        if should_skip:
            log_skipped_ofc(
                required_element_code=required_element.get('element_code'),
                reason='deprecated_required_element',
                deprecated_reason=reason
            )
            continue
        
        # ... continue with normal OFC generation ...
        # Get OFC templates for this element
        ofc_templates = get_ofc_templates_for_element(element_id)
        
        for template in ofc_templates:
            # ... create OFC from template ...
            ofcs.append(created_ofc)
    
    return jsonify({
        'assessment_id': assessment_id,
        'ofcs': ofcs
    })
```

### Example: Standalone OFC Generation Function

If OFC generation is in a separate function:

```python
from tools.deprecated_elements import should_skip_ofc_generation, log_skipped_ofc

def generate_ofcs_for_assessment(assessment_id: str) -> List[Dict]:
    """
    Generate OFCs for an assessment, excluding deprecated required elements.
    
    Args:
        assessment_id: UUID of the assessment
    
    Returns:
        List of OFC dictionaries
    """
    # Get assessment data
    assessment = get_assessment(assessment_id)
    required_elements = get_required_elements_for_assessment(assessment_id)
    responses = get_responses_for_assessment(assessment_id)
    
    ofcs = []
    no_responses = [r for r in responses if r.get('response') == 'NO']
    
    for response in no_responses:
        element_id = response.get('required_element_id')
        required_element = next(
            (el for el in required_elements if el.get('element_id') == element_id),
            None
        )
        
        if not required_element:
            continue
        
        # GUARD: Skip deprecated elements
        should_skip, reason = should_skip_ofc_generation(required_element)
        if should_skip:
            log_skipped_ofc(
                required_element_code=required_element.get('element_code'),
                reason='deprecated_required_element',
                deprecated_reason=reason
            )
            continue
        
        # Get OFC templates
        ofc_templates = get_ofc_templates_for_element(
            element_id=element_id,
            element_code=required_element.get('element_code')
        )
        
        # Generate OFCs from templates
        for template in ofc_templates:
            ofc = create_ofc_from_template(template, assessment_id, required_element)
            ofcs.append(ofc)
    
    return ofcs
```

## Step 4: Update Database Queries

Ensure all queries that fetch required elements include the status filter:

### Example: SQL Query

```python
def get_required_elements_for_assessment(assessment_id: str) -> List[Dict]:
    """
    Get required elements for an assessment, excluding deprecated elements.
    """
    query = """
        SELECT 
            re.element_id,
            re.element_code,
            re.title,
            re.question_text,
            re.discipline_name,
            re.discipline_id,
            re.status,
            re.deprecated_at,
            re.deprecated_reason,
            re.layer
        FROM required_elements re
        INNER JOIN assessment_required_elements are 
            ON re.element_id = are.required_element_id
        WHERE are.assessment_id = %s
          AND re.status = 'active'  -- CRITICAL: Only active elements
        ORDER BY re.order_index
    """
    
    # Execute query and return results
    # ...
```

### Example: Using ORM (SQLAlchemy)

```python
from sqlalchemy import and_

def get_required_elements_for_assessment(assessment_id: str):
    """
    Get required elements for an assessment, excluding deprecated elements.
    """
    return (
        db.session.query(RequiredElement)
        .join(AssessmentRequiredElement)
        .filter(
            and_(
                AssessmentRequiredElement.assessment_id == assessment_id,
                RequiredElement.status == 'active'  # CRITICAL: Only active
            )
        )
        .order_by(RequiredElement.order_index)
        .all()
    )
```

## Step 5: Update Baseline Views

Update your baseline reporting views/queries to exclude deprecated elements:

### SQL View Example

```sql
-- Update baseline vulnerability view
DROP VIEW IF EXISTS v_baseline_vulnerabilities CASCADE;

CREATE VIEW v_baseline_vulnerabilities AS
SELECT 
    re.element_id,
    re.element_code,
    re.title,
    re.question_text,
    re.discipline_name,
    COUNT(DISTINCT a.assessment_id) as assessment_count
FROM required_elements re
LEFT JOIN assessment_responses ar ON re.element_id = ar.required_element_id
LEFT JOIN assessments a ON ar.assessment_id = a.assessment_id
WHERE re.layer = 'baseline'
  AND re.status = 'active'  -- EXCLUDE DEPRECATED
  AND ar.response = 'NO'    -- Only vulnerabilities
GROUP BY re.element_id, re.element_code, re.title, re.question_text, re.discipline_name;
```

## Step 6: Testing

Create test cases to verify the implementation:

### Test 1: Deprecated Element Should Not Generate OFCs

```python
def test_deprecated_element_no_ofc():
    """Test that deprecated elements do not generate OFCs."""
    # Create test assessment with NO response to BASE-061
    assessment_id = create_test_assessment()
    create_test_response(assessment_id, 'BASE-061', 'NO')
    
    # Generate OFCs
    ofcs = generate_ofcs_for_assessment(assessment_id)
    
    # Verify no OFCs for BASE-061
    base061_ofcs = [o for o in ofcs if o.get('required_element_code') == 'BASE-061']
    assert len(base061_ofcs) == 0, "Deprecated element should not generate OFCs"
    
    # Verify log entry exists
    # Check logs for skip message
```

### Test 2: Active Element Should Generate OFCs

```python
def test_active_element_generates_ofc():
    """Test that active elements still generate OFCs normally."""
    # Create test assessment with NO response to BASE-001
    assessment_id = create_test_assessment()
    create_test_response(assessment_id, 'BASE-001', 'NO')
    
    # Generate OFCs
    ofcs = generate_ofcs_for_assessment(assessment_id)
    
    # Verify OFCs generated for BASE-001
    base001_ofcs = [o for o in ofcs if o.get('required_element_code') == 'BASE-001']
    assert len(base001_ofcs) > 0, "Active element should generate OFCs"
```

### Test 3: Historical Assessment Still Loads

```python
def test_historical_assessment_loads():
    """Test that historical assessments with deprecated elements still load."""
    # Load existing assessment that references BASE-061
    assessment_id = 'existing-assessment-with-base061'
    
    assessment = get_assessment(assessment_id)
    assert assessment is not None, "Historical assessment should load"
    
    # Verify deprecated element is in assessment but doesn't generate OFCs
    ofcs = generate_ofcs_for_assessment(assessment_id)
    base061_ofcs = [o for o in ofcs if o.get('required_element_code') == 'BASE-061']
    assert len(base061_ofcs) == 0, "Deprecated elements should not generate OFCs"
```

## Step 7: Validation Checklist

After implementation, verify:

- [ ] Database migrations applied successfully
- [ ] BASE-061 through BASE-071 marked as deprecated in database
- [ ] `tools/deprecated_elements.py` module exists and is importable
- [ ] OFC generation logic includes deprecation guard
- [ ] Database queries filter by `status = 'active'`
- [ ] Baseline views exclude deprecated elements
- [ ] Logs show skipped OFC generation for deprecated elements
- [ ] Tests pass
- [ ] Historical assessments still load correctly
- [ ] No new OFCs generated for BASE-061 through BASE-071
- [ ] Baseline Questions v1 continue to work normally

## Troubleshooting

### Issue: OFCs Still Generated for Deprecated Elements

**Check:**
1. Database migrations applied?
2. Status field populated correctly?
3. OFC generation code includes guard?
4. Database queries include status filter?

### Issue: Historical Assessments Fail to Load

**Check:**
1. Deprecated elements still exist in database (they should)
2. Assessment queries don't filter by status (they shouldn't for historical data)
3. Only OFC generation filters by status, not assessment loading

### Issue: Import Error for deprecated_elements Module

**Check:**
1. File exists at `tools/deprecated_elements.py`
2. Python path includes `tools/` directory
3. Module syntax is correct (Python 3.7+)

## Files to Create/Modify

### Create:
- `tools/deprecated_elements.py` (copy from psa_rebuild)
- `migrations/20250127_add_required_elements_deprecation.sql` (copy from psa_rebuild)
- `migrations/20250127_deprecate_base_0xx_video_surveillance.sql` (copy from psa_rebuild)

### Modify:
- OFC generation module (location depends on your architecture)
- Database queries that fetch required elements
- Baseline reporting views/queries

## Support

For questions or issues:
- Review `docs/doctrine/DEPRECATED_BASELINE_ELEMENTS.md`
- Review `docs/doctrine/BACKEND_OFC_DEPRECATION_GUIDE.md`
- Check database migration logs
- Review application logs for skip messages

---

**Last Updated**: 2025-01-27  
**Target Repository**: `psa_engine`

