# Verification Guide: Baseline Subtype v1 Seed

This guide walks through committing and verifying the baseline subtype v1 seed to the runtime database.

## Prerequisites

- Access to Supabase SQL Editor for the RUNTIME database
- Access to the PSA application (local or deployed)
- Seed SQL file ready: `tools/outputs/baseline_subtype_v1_seed.sql`

## Step 1: Commit Seed SQL (Supabase SQL Editor)

1. **Open Supabase Dashboard**
   - Navigate to your RUNTIME project (wivohgbuuwxoyfyzntsd)
   - Go to **SQL Editor**

2. **Execute the Seed SQL**
   - Open the file: `d:\psa-workspace\psa_rebuild\tools\outputs\baseline_subtype_v1_seed.sql`
   - Copy the entire contents (should be ~2953 lines)
   - Paste into Supabase SQL Editor
   - Click **Run** (or press Ctrl+Enter)

3. **Verify Execution**
   - Should complete with no errors
   - Expected output: "Success. No rows returned" (INSERT statements don't return rows)
   - If errors occur, check:
     - Table `baseline_spines_runtime` exists
     - Column names match schema (no `updated_at` column)
     - Connection to correct database

## Step 2: Verify DB Counts (SQL)

Run the verification script: `tools/verify_baseline_subtype_seed.sql`

Or run these queries manually:

```sql
-- Total counts
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN active=true THEN 1 ELSE 0 END) AS active_rows,
  SUM(CASE WHEN subtype_code IS NOT NULL AND subtype_code <> '' THEN 1 ELSE 0 END) AS subtype_anchored_rows
FROM public.baseline_spines_runtime;

-- Expected: subtype_anchored_rows = 105
```

```sql
-- Uniqueness check (should return zero rows)
SELECT subtype_code, COUNT(*) AS rows_per_subtype
FROM public.baseline_spines_runtime
WHERE active=true AND subtype_code IS NOT NULL AND subtype_code <> ''
GROUP BY subtype_code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Expected: Zero rows (one baseline spine per subtype_code)
```

```sql
-- Spot check: PER_PEDESTRIAN_ACCESS_CONTROL_POINTS
SELECT 
  canon_id, 
  discipline_code, 
  subtype_code, 
  left(question_text, 80) AS preview, 
  canon_version,
  active
FROM public.baseline_spines_runtime
WHERE subtype_code = 'PER_PEDESTRIAN_ACCESS_CONTROL_POINTS';

-- Expected: 1 row with active=true
```

## Step 3: Verify App Health Endpoint

**Endpoint:** `GET /api/runtime/health`

**Expected Response:**
```json
{
  "server_time": "...",
  "db": { "database": "...", "user": "..." },
  "host": { "addr": "...", "port": ... },
  "schema_checks": {
    "baseline_spines_runtime": {
      "exists": true,
      "counts": {
        "total": 105,
        "active_true": 105,
        "subtype_anchored": 105
      },
      "sample": [
        {
          "canon_id": "BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS",
          "discipline_code": "PER",
          "subtype_code": "PER_PEDESTRIAN_ACCESS_CONTROL_POINTS",
          "preview": "Is a Pedestrian Access Control Points capability implemented?",
          "active": true
        },
        ...
      ]
    }
  }
}
```

**Verification Checklist:**
- ✅ `baseline_spines_runtime.exists = true`
- ✅ `counts.total > 0` and `counts.active_true > 0`
- ✅ `counts.subtype_anchored >= 105`
- ✅ `sample` includes entries with `subtype_code` values
- ✅ Sample includes `PER_PEDESTRIAN_ACCESS_CONTROL_POINTS` (or other PER subtypes)

## Step 4: Verify Admin Question Catalog

1. **Navigate to Admin → Questions Tab**
   - URL: `/admin/questions` (or similar)
   - Should display baseline questions

2. **Verify Display**
   - Baseline question count increased as expected (should show 105 subtype-anchored questions)
   - Filters/grouping by discipline shows PER discipline
   - Filters/grouping by subtype shows `PER_PEDESTRIAN_ACCESS_CONTROL_POINTS`
   - Questions display with `subtype_code` values (not null)

3. **Check Question Details**
   - Click on a PER subtype question
   - Verify `subtype_code` field is populated
   - Verify `discipline_code` = "PER"
   - Verify question text matches expected format

## Step 5: Verify Assessment Questions Endpoint

**Endpoint:** `GET /api/runtime/assessments/<assessmentId>/questions`

**Prerequisites:**
- You need a valid `assessmentId` from the database
- Assessment should exist in `public.assessments` table

**Expected Response Structure:**
```json
{
  "questions": [
    {
      "canon_id": "BASE-PER-PER_PEDESTRIAN_ACCESS_CONTROL_POINTS",
      "discipline_code": "PER",
      "subtype_code": "PER_PEDESTRIAN_ACCESS_CONTROL_POINTS",
      "question_text": "Is a Pedestrian Access Control Points capability implemented?",
      "response_enum": ["YES", "NO", "N_A"],
      "canon_version": "v1",
      "canon_hash": "...",
      "current_response": null,
      "question_type": "BASELINE"
    },
    ...
  ],
  "total": 105,
  "metadata": {
    "baseline_count": 105,
    "expansion_count": 0,
    "sector_code": "...",
    "subsector_code": "...",
    "baseline_version": "v1",
    "source": "baseline_spines_runtime + expansion_questions (assessment-scoped)"
  }
}
```

**Verification Checklist:**
- ✅ `baseline_questions` array includes entries with `subtype_code` values (not null)
- ✅ `PER_*` subtype questions are present (e.g., `PER_PEDESTRIAN_ACCESS_CONTROL_POINTS`)
- ✅ `question_type` = "BASELINE" for all subtype-anchored questions
- ✅ `metadata.baseline_count >= 105`
- ✅ All questions have `discipline_code` and `subtype_code` populated

**To Get an Assessment ID:**
```sql
SELECT id FROM public.assessments LIMIT 1;
```

## Troubleshooting

### Issue: Seed SQL Fails with Column Error
- **Error:** `column "updated_at" does not exist`
- **Solution:** Ensure you're using the latest seed SQL (regenerated after removing `updated_at`)

### Issue: Health Endpoint Shows subtype_anchored = 0
- **Check:** Verify seed SQL executed successfully
- **Check:** Run verification SQL queries to confirm data exists
- **Check:** Ensure `subtype_code` is not NULL or empty string

### Issue: Assessment Questions Endpoint Returns Empty Baseline Questions
- **Check:** Verify `loadBaseline()` function includes `subtype_code` in query
- **Check:** Ensure assessment exists and is properly linked
- **Check:** Verify `active = true` filter is working

### Issue: Admin UI Doesn't Show New Subtypes
- **Check:** Refresh the page (cache may be stale)
- **Check:** Verify API endpoint `/api/runtime/questions` returns subtype-anchored questions
- **Check:** Check browser console for errors

## Success Criteria

✅ **Database:**
- `subtype_anchored_rows = 105` (matches taxonomy count)
- No duplicate `subtype_code` entries (uniqueness check returns zero rows)
- `PER_PEDESTRIAN_ACCESS_CONTROL_POINTS` exists and is active

✅ **API Endpoints:**
- `/api/runtime/health` shows `subtype_anchored >= 105`
- `/api/runtime/assessments/<id>/questions` returns baseline questions with `subtype_code` populated
- Sample includes `PER_PEDESTRIAN_ACCESS_CONTROL_POINTS`

✅ **UI:**
- Admin Questions tab displays baseline questions with subtype filtering
- Questions show `subtype_code` values in UI
- PER discipline subtypes are visible and filterable

## Next Steps

After verification:
1. Document any discrepancies or issues
2. Update runbook if needed
3. Consider running assessment scoring tests to ensure subtype-anchored questions integrate correctly
