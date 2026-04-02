# Deprecated Baseline Required Elements (BASE-0xx)

## Overview

This document describes the deprecation of legacy baseline required elements (BASE-0xx) that represent component existence. These elements have been superseded by the modern assessment model and are excluded from active baseline views and OFC generation.

## Deprecated Elements

### Video Surveillance Systems (BASE-061 through BASE-071)

The following required elements have been deprecated:

- **BASE-061** - Video Surveillance Systems (component existence)
- **BASE-062** - Video Surveillance Systems (component existence)
- **BASE-063** - Video Surveillance Systems (component existence)
- **BASE-064** - Video Surveillance Systems (component existence)
- **BASE-065** - Video Surveillance Systems (component existence)
- **BASE-066** - Video Surveillance Systems (component existence)
- **BASE-070** - Video Surveillance Systems (component existence)
- **BASE-071** - Video Surveillance Systems (component existence)

## Why These Elements Were Deprecated

These BASE-0xx required elements originated from a pre-question, pre-component-layer model and are superseded by:

1. **Baseline Questions v1** - Existence/governance-based questions that provide a more comprehensive assessment framework
2. **Component Capability Layer** - A structured approach to component assessment that replaces simple existence checks
3. **Phase 2.5 Evidence-Backed OFCs** - Options for Consideration that are backed by evidence rather than simple component existence

The legacy elements focused solely on component existence ("Does the facility have X?") rather than capability and governance, which are better captured by the modern assessment model.

## Impact

### What Changed

- **OFC Generation**: Deprecated elements no longer generate OFCs (Options for Consideration)
- **Baseline Views**: Deprecated elements are excluded from baseline vulnerability lists and baseline OFC summaries
- **Baseline Reporting**: Deprecated elements do not appear in baseline scoring logic or executive summaries
- **Active Logic**: All active assessment logic excludes deprecated elements

### What Remains Intact

- **Historical Data**: All historical assessments referencing deprecated elements remain intact and can be loaded
- **Database Records**: Deprecated elements are not deleted from the database
- **Primary Keys**: Element IDs and codes remain unchanged
- **Assessment Links**: Historical assessment links to deprecated elements are preserved

## Database Schema

Deprecated elements are marked with the following metadata:

```sql
status = 'deprecated'
deprecated_at = CURRENT_TIMESTAMP
deprecated_reason = 'Superseded by Baseline Questions v1 and Component Capability Layer'
```

## Implementation Details

### Database Migration

Two migrations were created:

1. **`20250127_add_required_elements_deprecation.sql`**
   - Adds `status`, `deprecated_at`, and `deprecated_reason` columns to `required_elements` table
   - Creates indexes for efficient filtering

2. **`20250127_deprecate_base_0xx_video_surveillance.sql`**
   - Marks BASE-061 through BASE-071 as deprecated for Video Surveillance Systems discipline

### Code Changes

#### Frontend (psa_rebuild)

- **`lib/deprecatedElements.ts`**: Helper functions to check and filter deprecated elements
- **`src/data/psaDataProvider.ts`**: OFC generation logic skips deprecated elements
- **`app/api/required-elements/route.ts`**: Filters out deprecated elements from active views

#### Backend (psa_engine)

The OFC generation logic in `psa_engine/tools/` should include a guard:

```python
if required_element.status != 'active':
    # Skip OFC generation
    log_skipped(required_element_code, reason="deprecated_required_element")
    continue
```

### Baseline Views

All baseline views and queries should include:

```sql
WHERE required_element.status = 'active'
  AND source = 'baseline_questions_v1'
```

This explicitly excludes:
- Deprecated required elements
- Legacy BASE-0xx elements (even if not yet marked in database)

## Validation

After implementing the deprecation, verify:

1. ✅ BASE-061 through BASE-071 no longer appear in:
   - Baseline vulnerability lists
   - Baseline OFC lists
   - Baseline scoring results

2. ✅ Historical assessments referencing deprecated elements still load correctly

3. ✅ No new OFCs are generated from BASE-0xx deprecated elements

4. ✅ Baseline Questions v1 remain unaffected and continue to function normally

## Future Deprecations

This deprecation pattern can be extended to other disciplines if similar legacy component existence elements are identified. The same process applies:

1. Identify legacy elements (BASE-0xx pattern)
2. Mark as deprecated in database
3. Update OFC generation logic
4. Update baseline views
5. Document the deprecation

## Questions or Issues

If you encounter issues with deprecated elements:

1. Check that database migrations have been applied
2. Verify that code changes are deployed
3. Ensure baseline views include status filtering
4. Review logs for skipped OFC generation messages

---

**Last Updated**: 2025-01-27  
**Status**: Active Deprecation  
**Authority**: PSA Engineering Team

