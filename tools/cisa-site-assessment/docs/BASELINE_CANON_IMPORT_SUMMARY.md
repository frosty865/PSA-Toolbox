# Baseline Canon Import Implementation Summary

## Overview

Complete implementation of baseline canon import system with fail-closed safety guards and dry-run support.

## Files Created

### Tools

1. **`tools/probe_runtime_schema.py`**
   - Probes RUNTIME database schema
   - Discovers question tables, set tables, dimension tables
   - Outputs JSON report: `analytics/reports/runtime_schema_probe.json`
   - Must target RUNTIME only
   - Calls `guard_write("runtime")` before connection

2. **`tools/import_baseline_canon.py`** (upgraded)
   - Full implementation with dry-run plan generation
   - Loads canon spines from `psa_engine/doctrine/baseline_canon/baseline_spines.v1.json`
   - Auto-detects schema mapping
   - Builds import plan (inserts/updates/unchanged)
   - Validates plan (no duplicates, correct response_enum)
   - Outputs plan JSON: `analytics/reports/baseline_canon_import_plan.json`
   - Writes only with `--apply` flag
   - Must target RUNTIME only

### Modules

3. **`app/importers/baseline_canon_mapper.py`**
   - Loads and normalizes canon spines (handles multiple JSON structures)
   - Probes database schema (live or from probe file)
   - Detects question table patterns:
     - PATTERN A: Single questions table
     - PATTERN B: baseline_questions table
   - Resolves column mappings (code, text, response_enum, discipline_code, subtype_code)
   - Fails closed if no supported pattern detected

4. **`app/importers/__init__.py`**
   - Package initialization

### Documentation

5. **`docs/BASELINE_CANON_IMPORT.md`**
   - Complete runbook with step-by-step instructions
   - Error handling guide
   - Troubleshooting section

## Safety Features

✅ **Fail-Closed Guards:**
- Preflight check validates RUNTIME connection
- Schema probe validates RUNTIME connection
- Import tool validates RUNTIME connection
- All tools refuse non-RUNTIME targets

✅ **Dry-Run Default:**
- Import tool defaults to dry-run
- Writes only with `--apply` flag
- Plan generated before any writes

✅ **Validation:**
- All canon questions validated (required fields, response_enum)
- Plan validated (no duplicates, all have canon_id)
- Schema mapping validated (required columns present)

✅ **No Guessing:**
- Schema auto-detected from database
- Mapping resolved from detected schema
- Fails if pattern cannot be determined

## Usage Flow

### 1. Preflight
```powershell
python tools/preflight_db.py --target runtime --show
```

### 2. Probe Schema
```powershell
python tools/probe_runtime_schema.py --target runtime
```

### 3. Dry-Run Import Plan
```powershell
python tools/import_baseline_canon.py --target runtime
```

### 4. Review Plan
- Check `analytics/reports/baseline_canon_import_plan.json`
- Verify counts and operations

### 5. Apply (When Ready)
```powershell
python tools/import_baseline_canon.py --target runtime --apply
```

## Canon File Structure

**Path:** `psa_engine/doctrine/baseline_canon/baseline_spines.v1.json`

**Supported Formats:**
- Array of questions: `[{...}, {...}]`
- Object with `spines` key: `{"spines": [...]}`
- Object with `questions` key: `{"questions": [...]}`
- Object with `required_elements` key: `{"required_elements": [...]}`

**Question Fields:**
- `canon_id` (required) - Also accepts: `code`, `question_code`, `element_code`, `element_id`
- `text` (required) - Also accepts: `question_text`, `prompt`
- `discipline_code` (optional)
- `subtype_code` (optional)
- `response_enum` (optional, defaults to `["YES", "NO", "N_A"]`)

## Schema Detection

The mapper detects two patterns:

**PATTERN A: Single Questions Table**
- Table with 'question' in name
- Has code column (code, question_code, etc.)
- Has text column (text, question_text, prompt)

**PATTERN B: Baseline Questions Table**
- Table with 'baseline' and 'question' in name
- Has code column
- Has text column

If neither pattern detected, raises RuntimeError with top 5 candidate tables.

## Import Plan Structure

```json
{
  "generated_at": "2026-01-14T...",
  "dry_run": true,
  "canon_source": "path/to/canon.json",
  "detected_table": "baseline_questions",
  "mapping": {
    "pattern": "BASELINE_QUESTIONS",
    "table": "baseline_questions",
    "columns": {
      "code": "question_code",
      "text": "question_text",
      "response_enum": "response_enum",
      "discipline_code": "discipline_code",
      "subtype_code": "subtype_code"
    }
  },
  "counts": {
    "total": 100,
    "inserts": 50,
    "updates": 10,
    "unchanged": 40,
    "errors": 0
  },
  "sample_operations": [...],
  "all_operations": [...] // if ≤100, else null
}
```

## Validation Checks

1. **Canon Question Validation:**
   - ✅ Has `canon_id`
   - ✅ Has `text`
   - ✅ `response_enum` = `["YES", "NO", "N_A"]` (if present)

2. **Plan Validation:**
   - ✅ No duplicate `canon_id` in plan
   - ✅ All operations have `canon_id`

## Error Handling

All tools provide clear error messages:

- **Preflight fails:** Shows expected vs actual project ref
- **Schema probe fails:** Shows connection error details
- **Mapping fails:** Shows top 5 candidate tables with columns
- **Validation fails:** Shows specific validation errors
- **Plan validation fails:** Shows duplicate IDs or missing fields

## Related Files

- `app/db/db_targets.py` - Target definitions
- `app/db/db_guard.py` - Connection guard
- `app/db/db_router.py` - Target routing
- `tools/preflight_db.py` - Preflight tool
- `docs/DB_TARGETING.md` - Database targeting docs

## Next Steps

1. Run preflight to validate connection
2. Run schema probe to discover tables
3. Run dry-run import to generate plan
4. Review plan JSON
5. Apply import when ready (with `--apply`)
