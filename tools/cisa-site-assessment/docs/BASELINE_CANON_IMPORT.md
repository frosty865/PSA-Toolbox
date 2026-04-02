# Baseline Canon Import Runbook

## Overview

This runbook describes the end-to-end process for importing baseline canonical spines from `psa_engine/doctrine/baseline_canon` into the RUNTIME database.

**IMPORTANT:** This process is fail-closed and requires explicit confirmation at each step. Writes only occur with `--apply` flag.

## Prerequisites

1. **Environment Setup**
   - `DATABASE_URL` or `SUPABASE_URL` must point to RUNTIME project (wivohgbuuwxoyfyzntsd)
   - `PSA_DB_TARGET` can be set to `runtime` (optional)

2. **Canon Files**
   - Canon spines must exist at: `psa_engine/doctrine/baseline_canon/baseline_spines.v1.json`
   - File structure: Array of question objects or object with 'spines'/'questions' key

3. **Database Access**
   - Must have read/write access to RUNTIME database
   - Schema must contain question tables (auto-detected)

## Step-by-Step Process

### Step 1: Preflight Database Connection

**Purpose:** Validate that DATABASE_URL points to RUNTIME project.

```powershell
python tools/preflight_db.py --target runtime --show
```

**Expected Output:**
```
Target requested: runtime
Expected project ref: wivohgbuuwxoyfyzntsd
Actual project ref: wivohgbuuwxoyfyzntsd

✅ PASS: Database target matches connection string
```

**Exit Code:** 0 (PASS) or 2 (FAIL)

**If FAIL:** Update `DATABASE_URL` to point to RUNTIME project.

---

### Step 2: Probe Database Schema

**Purpose:** Discover question tables and their structure.

```powershell
python tools/probe_runtime_schema.py --target runtime
```

**Expected Output:**
```
RUNTIME Schema Probe
================================================================================

Connecting to database...
✓ Connected
Probing schema...
✓ Schema probe complete

Summary:
  Total tables: N
  Question tables: M
  Set/Assessment tables: K
  Dimension tables: L

Candidate Question Tables:
  - baseline_questions
    Key columns: question_code, question_text, response_enum, ...

✓ Report written to: analytics/reports/runtime_schema_probe.json
```

**Output File:** `analytics/reports/runtime_schema_probe.json`

**Contains:**
- All tables in public schema
- Question-related tables with columns
- Set/assessment tables with columns
- Dimension tables with columns

---

### Step 3: Dry-Run Import Plan

**Purpose:** Build import plan without writing to database.

```powershell
python tools/import_baseline_canon.py --target runtime --dry-run --plan-out analytics/reports/baseline_canon_import_plan.json
```

**Expected Output:**
```
Baseline Canon Import Tool
================================================================================

Mode: DRY RUN
Target: runtime

Loading canon spines from: D:\PSA_System\psa_rebuild\psa_engine\doctrine\baseline_canon\baseline_spines.v1.json
✓ Loaded N canon questions
Validating canon questions...
✓ All questions validated
Resolving schema mapping...
✓ Detected pattern: BASELINE_QUESTIONS
  Table: baseline_questions
  Code column: question_code
  Text column: question_text
Connecting to database...
✓ Connected
Building import plan...
✓ Plan validated

Import Plan Summary:
  Total questions: N
  Would INSERT: M
  Would UPDATE: K
  Unchanged: L

Sample operations (first 25):
  INSERT     BASE-000
  UPDATE     BASE-001 (text differs)
  UNCHANGED  BASE-002
  ...

✓ Plan written to: analytics/reports/baseline_canon_import_plan.json

⚠️  DRY RUN complete. Use --apply to write changes to database.

✅ Complete
```

**Output File:** `analytics/reports/baseline_canon_import_plan.json`

**Contains:**
- Detected table and mapping
- Counts (total, inserts, updates, unchanged, errors)
- Sample operations (first 25)
- All operations (if ≤100, otherwise truncated)

**Validation Checks:**
1. ✅ No duplicate canon_id in plan
2. ✅ All questions have response_enum = ["YES","NO","N_A"]

---

### Step 3.5: Lock the Mapping (Recommended)

**Purpose:** Freeze the resolved mapping to prevent schema drift.

After a successful dry-run, lock the mapping to ensure consistency:

```powershell
python tools/import_baseline_canon.py --target runtime --lock --print-mapping
```

**Expected Output:**
```
Resolving schema mapping...
✓ Detected pattern: BASELINE_QUESTIONS
  Table: baseline_questions
  Code column: question_code
  Text column: question_text
  Mapping source: auto

Resolved Mapping:
  Pattern: BASELINE_QUESTIONS
  Table: baseline_questions
  Columns:
    code: question_code
    text: question_text
    response_enum: response_enum
    discipline_code: discipline_code
    subtype_code: subtype_code

✓ LOCK WRITTEN: app/importers/baseline_canon_mapping.lock.json
```

**Lock File:** `app/importers/baseline_canon_mapping.lock.json`

**Contains:**
- Lock version and timestamp
- Target database and project reference
- Resolved mapping (table, columns, fixed values)

**After Locking:**

Subsequent runs will automatically prefer the lock:

```powershell
python tools/import_baseline_canon.py --target runtime
```

**Expected Output:**
```
Resolving schema mapping...
  Using lock file: app/importers/baseline_canon_mapping.lock.json
✓ Detected pattern: BASELINE_QUESTIONS
  Table: baseline_questions
  Code column: question_code
  Text column: question_text
  Mapping source: lock
```

**Drift Detection:**

To verify the schema hasn't changed unexpectedly (without using the lock):

```powershell
python tools/import_baseline_canon.py --target runtime --no-lock-prefer
```

**Expected Behavior:**
- Auto-detects mapping from live schema
- Compares against lock file
- **PASS** if mappings match
- **FAIL** if schema has drifted (with detailed diff)

**⚠️ Warning:**

If the database schema is intentionally changed:
1. Validate the new mapping works correctly
2. Regenerate the lock explicitly with `--lock`
3. Do NOT use `--no-lock-prefer` to bypass the check

**Rules:**
- Lock can only be created in DRY-RUN mode (without `--apply`)
- Lock updates must be explicit via `--lock` (no implicit updates)
- Lock file contains only mapping metadata (no credentials)

---

### Step 4: Review Import Plan

**Action:** Review the generated plan JSON file.

**Check:**
- Are the counts reasonable?
- Are the UPDATE operations expected?
- Are there any errors?

**If errors found:**
- Fix canon source file
- Re-run Step 3

---

### Step 5: Apply Import (When Ready)

**⚠️ WARNING:** This step writes to the database. Only run after reviewing the plan.

```powershell
python tools/import_baseline_canon.py --target runtime --apply
```

**Expected Output:**
```
Baseline Canon Import Tool
================================================================================

Mode: APPLY
Target: runtime

[... loading and validation ...]

================================================================================
EXECUTING IMPORT
================================================================================
✓ Import complete:
  Inserted: M
  Updated: K
  Errors: 0

✅ Complete
```

**Exit Code:** 0 (success) or non-zero (failure)

---

## Error Handling

### Preflight Fails

**Error:** "Database target mismatch detected!"

**Fix:**
1. Check `DATABASE_URL` environment variable
2. Verify it points to RUNTIME project (wivohgbuuwxoyfyzntsd)
3. Re-run preflight

### Schema Probe Finds No Question Tables

**Error:** "No question tables found"

**Fix:**
1. Verify database schema is applied
2. Check migrations have been run
3. Verify table names contain 'question'

### Mapping Resolution Fails

**Error:** "No supported question table pattern detected"

**Fix:**
1. Review schema probe report
2. Verify question tables exist
3. Check table has required columns (code, text)
4. May need to update mapper to support new pattern

### Validation Errors

**Error:** "Invalid response_enum" or "Missing required field"

**Fix:**
1. Review canon source file
2. Ensure all questions have:
   - `canon_id` (or `code`, `question_code`, `element_code`)
   - `text` (or `question_text`, `prompt`)
   - `response_enum` = ["YES", "NO", "N_A"] (if present)
3. Fix source file and re-run

### Plan Validation Fails

**Error:** "Duplicate canon_id found in plan"

**Fix:**
1. Review canon source file
2. Remove duplicate canon_id values
3. Re-run import plan

---

## Safety Features

1. **Fail-Closed:** Writes blocked if connection string doesn't match target
2. **Dry-Run Default:** Default mode is dry-run; writes only with `--apply`
3. **Validation:** All questions validated before import
4. **Plan Review:** Import plan generated before any writes
5. **Sanitized Output:** Connection strings sanitized in logs

---

## File Structure

### Canon Source File

**Path:** `psa_engine/doctrine/baseline_canon/baseline_spines.v1.json`

**Expected Structure:**

```json
[
  {
    "canon_id": "BASE-000",
    "text": "Are biometric access systems installed at entry points?",
    "discipline_code": "ACS_BIOMETRIC_ACCESS",
    "subtype_code": "BIOMETRIC_ACCESS",
    "response_enum": ["YES", "NO", "N_A"]
  },
  ...
]
```

**Alternative Structures Supported:**
- Object with `spines` key: `{"spines": [...]}`
- Object with `questions` key: `{"questions": [...]}`
- Object with `required_elements` key: `{"required_elements": [...]}`

**Field Name Aliases:**
- `canon_id`: Also accepts `code`, `question_code`, `element_code`, `element_id`
- `text`: Also accepts `question_text`, `prompt`

---

## Related Documentation

- `docs/DB_TARGETING.md` - Database targeting system
- `tools/preflight_db.py` - Preflight tool
- `tools/probe_runtime_schema.py` - Schema probe tool
- `app/importers/baseline_canon_mapper.py` - Mapping logic
- `tools/import_baseline_canon.py` - Import tool

---

## Troubleshooting

### "Canon file not found"

**Check:**
- Verify `--engine-root` path is correct
- Default: `D:\PSA_System\psa_rebuild\psa_engine`
- Verify file exists at: `{engine_root}/doctrine/baseline_canon/baseline_spines.v1.json`

### "Cannot parse Supabase project reference"

**Check:**
- `DATABASE_URL` format is correct
- Should be: `postgresql://postgres:password@db.{ref}.supabase.co:6543/postgres`
- Or: `https://{ref}.supabase.co`

### "No supported question table pattern detected"

**Check:**
- Run schema probe to see available tables
- Verify question tables exist
- Check table has code and text columns
- May need to update mapper for new schema pattern

---

## Next Steps

After successful import:

1. Verify imported questions in database
2. Test question retrieval via API
3. Validate question display in UI
4. Document any schema changes needed
