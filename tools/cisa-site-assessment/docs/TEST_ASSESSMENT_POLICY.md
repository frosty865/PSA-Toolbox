# Test Assessment Policy

## Overview

This document defines the policy and mechanisms for identifying, managing, and safely purging test assessments in the PSA system.

## Test Assessment Identification

### Test Marker Rule

An assessment is considered a **TEST** if any of the following conditions are true:

1. **`qa_flag = true`** (primary marker)
2. **`test_run_id IS NOT NULL`** (primary marker)
3. **`facility_name LIKE '[QA]%'`** (fallback defense-in-depth only)

The primary control is `qa_flag` and `test_run_id`. The name prefix `[QA]` is kept only as a fallback safety mechanism and should not be relied upon as the primary identification method.

### Database Schema

The `assessments` table includes the following test-related columns:

- **`qa_flag`** (BOOLEAN NOT NULL DEFAULT FALSE)
  - Primary flag for marking QA/test assessments
  - When `true`, assessment is excluded from production views

- **`test_run_id`** (TEXT NULL)
  - Optional identifier for grouping test assessments by run/batch
  - When set, assessment is considered a test
  - Useful for batch operations and tracking test campaigns

- **`test_purpose`** (TEXT NULL)
  - Optional short description of why the test was created
  - Examples: "OFC regeneration validation", "Gate ordering test", "Integration test"

### Indexes

For efficient filtering, the following indexes exist:

- `idx_assessments_qa_flag` - Index on `qa_flag` (partial index for `qa_flag = false`)
- `idx_assessments_test_run_id` - Index on `test_run_id` (partial index for non-null values)
- `idx_assessments_production` - Composite index for production queries (`qa_flag=false AND test_run_id IS NULL`)

## Query Hygiene

### Production Query Filter

**ALL production assessment queries MUST filter out test assessments** using the following WHERE clause:

```sql
WHERE (qa_flag = false OR qa_flag IS NULL)
  AND (test_run_id IS NULL)
  AND (facility_name NOT LIKE '[QA]%' OR facility_name IS NULL)  -- Fallback only
```

### Affected Queries

The following query locations have been updated to exclude test assessments:

1. **`GET /api/runtime/assessments`** - Assessment list endpoint
2. **`GET /api/runtime/assessments/[id]`** - Assessment detail endpoint
3. **`GET /api/assessment/scoring`** - Assessment scoring endpoint
4. **`tools/regenerate_ofcs_baseline_v2.py`** - OFC regeneration script

### Fallback Safety

The name prefix filter (`facility_name NOT LIKE '[QA]%'`) is included as a defense-in-depth measure. It should not be the primary control, but provides an additional safety layer in case `qa_flag` or `test_run_id` are not properly set.

## Purge Mechanism

### Endpoint

**`POST /api/runtime/admin/purge-test-assessments`**

This endpoint provides a safe, auditable mechanism for purging test assessments.

### Modes

#### DRY_RUN

Returns counts of what would be deleted without actually deleting anything.

**Request:**
```json
{
  "mode": "DRY_RUN",
  "test_run_id": "optional-run-id",
  "older_than_days": 30,
  "limit": 100
}
```

**Response:**
```json
{
  "mode": "DRY_RUN",
  "message": "Dry run completed. No data was deleted.",
  "filters_applied": { ... },
  "counts": {
    "assessments_to_delete": 5,
    "instances_to_delete": 5,
    "responses_to_delete": 150,
    "nominations_to_delete": 10
  },
  "assessment_ids": [ ... ],
  "assessment_details": [ ... ]
}
```

#### EXECUTE

Performs actual deletion in a single database transaction.

**Request:**
```json
{
  "mode": "EXECUTE",
  "test_run_id": "optional-run-id",
  "older_than_days": 30,
  "limit": 100
}
```

**Response:**
```json
{
  "mode": "EXECUTE",
  "message": "Purge completed successfully",
  "filters_applied": { ... },
  "counts": { ... },
  "assessment_ids_deleted": [ ... ]
}
```

### Safety Guards

1. **Hard WHERE Clause**: The purge query MUST only match test assessments:
   ```sql
   WHERE (qa_flag = true OR test_run_id IS NOT NULL OR facility_name LIKE '[QA]%')
   ```

2. **Safety Check**: Before deletion, the system performs a double-check to ensure no non-test assessments are included:
   ```sql
   SELECT COUNT(*) FROM assessments
   WHERE id = ANY($1::uuid[])
   AND NOT (qa_flag = true OR test_run_id IS NOT NULL OR facility_name LIKE '[QA]%')
   ```
   If this returns > 0, the purge is aborted.

3. **Transaction-Based**: All deletions occur in a single database transaction. If any step fails, the entire operation is rolled back.

4. **Cascade Order**: Deletions occur in the correct order to respect foreign key constraints:
   1. `assessment_responses` (depends on `assessment_instances`)
   2. `ofc_nominations` (depends on `assessments`)
   3. `assessment_instances` (depends on `assessments`)
   4. `assessments` (last)

5. **Refuse Empty Purge**: If the filter resolves to 0 rows, EXECUTE mode is refused.

### Audit Logging

All purge operations (including DRY_RUN) are logged to `test_assessment_purge_log` table:

```sql
CREATE TABLE test_assessment_purge_log (
  purge_id uuid PRIMARY KEY,
  purged_at timestamptz NOT NULL,
  purged_by TEXT NULL,
  mode TEXT NOT NULL,  -- 'DRY_RUN' or 'EXECUTE'
  filters_applied JSONB NOT NULL,
  counts JSONB NOT NULL,
  assessment_ids_deleted uuid[] NULL,
  notes TEXT NULL
);
```

This provides a complete audit trail of all purge operations for compliance and debugging.

## Admin UI

### Test Assessments Page

**Route:** `/admin/test-assessments`

**Features:**
- Lists all test assessments (qa_flag=true OR test_run_id IS NOT NULL)
- Shows: ID, name, status, qa_flag, test_run_id, test_purpose, created_at
- Purge controls with filters:
  - Test Run ID (optional)
  - Older Than (days, optional)
  - Limit (max assessments, optional)
- "Dry Run" button - Shows counts without deleting
- "Purge Now" button - Executes purge with confirmation prompt

### Access Control

The test assessments page should be protected by existing admin authentication mechanisms. Ensure only authorized administrators can access this page.

## Best Practices

1. **Mark Tests Explicitly**: When creating test assessments, always set `qa_flag=true` or provide a `test_run_id`.

2. **Use Test Run IDs**: For batch test operations, use a consistent `test_run_id` to group related test assessments. This makes purging by batch easier.

3. **Document Purpose**: Set `test_purpose` to document why the test was created. This helps with auditing and understanding test data.

4. **Regular Cleanup**: Periodically purge old test assessments to keep the database clean. Use the `older_than_days` filter to target old tests.

5. **Dry Run First**: Always run a DRY_RUN before executing a purge to verify the counts and ensure no production data is affected.

6. **Review Audit Logs**: Periodically review `test_assessment_purge_log` to ensure purges are being performed correctly and no issues have occurred.

## Migration

The test assessment markers were added in migration `20260113_add_test_assessment_markers.sql`. This migration:

1. Adds `test_run_id` and `test_purpose` columns
2. Creates indexes for efficient filtering
3. Creates `test_assessment_purge_log` table
4. Updates existing `[QA]` prefixed assessments to have `qa_flag=true`

## Constraints

- **No baseline question changes**: Test assessment marking does not modify baseline questions
- **No gate model changes**: Test assessment marking does not modify the gate model
- **No weakening promotion guards**: Test assessment marking does not affect OFC promotion logic
- **QA exclusion remains default**: QA assessments remain excluded from production views by default
- **No production data corruption**: Purge mechanism has hard guards to prevent deletion of non-test assessments

