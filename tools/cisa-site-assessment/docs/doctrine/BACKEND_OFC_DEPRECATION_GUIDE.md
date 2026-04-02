# Backend OFC Generation - Deprecation Implementation Guide

## Overview

This guide provides instructions for updating the OFC generation logic in `psa_engine/tools/` to exclude deprecated required elements.

## Required Changes

### Step 1: Add Status Check in OFC Generation

In your OFC generation module (typically in `psa_engine/tools/`), add a guard to skip deprecated required elements:

```python
# Example: In your OFC generation function

def generate_ofcs_for_assessment(assessment_id):
    """
    Generate OFCs for an assessment, excluding deprecated required elements.
    """
    # ... existing code to get required elements and responses ...
    
    for required_element in required_elements:
        # GUARD: Skip deprecated elements
        if required_element.get('status') != 'active':
            log_skipped(
                required_element_code=required_element.get('element_code'),
                reason="deprecated_required_element",
                deprecated_reason=required_element.get('deprecated_reason', 'Element is deprecated')
            )
            continue
        
        # Legacy check: Also skip BASE-061 through BASE-071 for Video Surveillance Systems
        # This is a fallback if status field is not yet populated
        legacy_deprecated_codes = [
            'BASE-061', 'BASE-062', 'BASE-063', 'BASE-064',
            'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071'
        ]
        if (required_element.get('element_code') in legacy_deprecated_codes and
            required_element.get('discipline_name') == 'Video Surveillance Systems'):
            log_skipped(
                required_element_code=required_element.get('element_code'),
                reason="deprecated_required_element",
                deprecated_reason="Legacy component existence element - superseded by Baseline Questions v1"
            )
            continue
        
        # ... continue with normal OFC generation ...
```

### Step 2: Update Database Queries

Ensure all queries that fetch required elements for OFC generation include the status filter:

```python
# Example query
query = """
    SELECT 
        re.element_id,
        re.element_code,
        re.title,
        re.question_text,
        re.discipline_name,
        re.status,
        re.deprecated_at,
        re.deprecated_reason
    FROM required_elements re
    WHERE re.status = 'active'  -- CRITICAL: Only active elements
      AND re.layer = 'baseline'
      AND re.discipline_name = %s
"""
```

### Step 3: Logging

Add logging to track when OFCs are skipped due to deprecation:

```python
import logging

logger = logging.getLogger(__name__)

def log_skipped(required_element_code, reason, deprecated_reason=None):
    """Log when OFC generation is skipped for a deprecated element."""
    logger.info(
        f"Skipping OFC generation for deprecated element: {required_element_code}",
        extra={
            'required_element_code': required_element_code,
            'reason': reason,
            'deprecated_reason': deprecated_reason,
            'event_type': 'ofc_generation_skipped'
        }
    )
```

## Validation

After implementing the changes, verify:

1. ✅ No OFCs are generated for BASE-061 through BASE-071
2. ✅ Logs show skipped OFC generation for deprecated elements
3. ✅ Baseline Questions v1 elements continue to generate OFCs normally
4. ✅ Historical assessments still load correctly (deprecated elements remain in database)

## Testing

Test cases to verify:

1. **Test Deprecated Element**: Create a test assessment with a NO response to BASE-061
   - Expected: No OFC generated
   - Expected: Log entry showing skip

2. **Test Active Element**: Create a test assessment with a NO response to BASE-001
   - Expected: OFC generated normally

3. **Test Historical Assessment**: Load an existing assessment that references BASE-061
   - Expected: Assessment loads successfully
   - Expected: No new OFCs generated for deprecated elements

## Database Schema

Ensure the `required_elements` table has the deprecation columns:

```sql
status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'deprecated'))
deprecated_at TIMESTAMP WITH TIME ZONE
deprecated_reason TEXT
```

Run the migration `20250127_add_required_elements_deprecation.sql` before implementing code changes.

## Questions

If you encounter issues:

1. Verify database migrations have been applied
2. Check that `status` column exists and has correct values
3. Review logs for skip messages
4. Ensure queries include `WHERE status = 'active'` filter

---

**Last Updated**: 2025-01-27  
**Target**: `psa_engine/tools/` (OFC generation module)

