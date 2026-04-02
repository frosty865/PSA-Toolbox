# Expansion Questions Format

This document describes the format for importing expansion questions into the CORPUS system.

## Overview

Expansion questions are additive overlays (sector/subsector/technology) that extend beyond the baseline 36 primary questions. They are explicitly applied via overlay selection and matched separately from baseline questions.

## Required Fields

### `expansion_version` (TEXT, required)
- Version identifier for the expansion question set
- Example: `"EXPANSION_QUESTIONS_V1"`
- Used for versioning and grouping questions

### `scope_type` (TEXT, required)
- Must be exactly one of: `"SECTOR"`, `"SUBSECTOR"`, `"TECHNOLOGY"`
- Determines which overlay control array the question belongs to

### `scope_code` (TEXT, required)
- Canonical code for the overlay
- Examples:
  - Sector: `"SECTOR_COMMERCIAL_FACILITIES"`
  - Subsector: `"SUBSECTOR_SPORTS_VENUES"`
  - Technology: `"TECH_CLEAR_BAG_POLICY"`
- Must not contain 'SAFE' (case-insensitive)

### `question_code` (TEXT, required)
- Unique identifier for the question within the expansion_version
- Example: `"EXP_SUBSECTOR_SPORTS_VENUES_Q001"`
- Must be unique per `(expansion_version, question_code)` combination
- Must not contain 'SAFE' (case-insensitive)

### `question_text` (TEXT, required)
- The full question text
- Must not be empty
- Example: `"Does the facility implement clear bag policies for entry?"`

## Optional Fields

### `response_enum` (JSONB, optional)
- Default: `["YES", "NO", "N_A"]`
- Must be exactly this array if provided
- No other response types are allowed

### `is_active` (BOOLEAN, optional)
- Default: `true`
- Set to `false` to disable a question without deleting it

## JSON Format

```json
[
  {
    "expansion_version": "EXPANSION_QUESTIONS_V1",
    "scope_type": "SUBSECTOR",
    "scope_code": "SUBSECTOR_SPORTS_VENUES",
    "question_code": "EXP_SUBSECTOR_SPORTS_VENUES_Q001",
    "question_text": "Does the facility implement clear bag policies for entry?",
    "response_enum": ["YES", "NO", "N_A"],
    "is_active": true
  }
]
```

## CSV Format

Required columns:
- `expansion_version`
- `scope_type`
- `scope_code`
- `question_code`
- `question_text`

Optional columns:
- `response_enum` (must be valid JSON array string: `'["YES","NO","N_A"]'`)
- `is_active` (must be `true` or `false`)

Example CSV:
```csv
expansion_version,scope_type,scope_code,question_code,question_text,is_active
EXPANSION_QUESTIONS_V1,SUBSECTOR,SUBSECTOR_SPORTS_VENUES,EXP_SUBSECTOR_SPORTS_VENUES_Q001,"Does the facility implement clear bag policies for entry?",true
```

## Import Commands

### JSON Import
```bash
python tools/corpus/import_expansion_questions.py --json path/to/expansion_questions.json
```

### CSV Import
```bash
python tools/corpus/import_expansion_questions.py --csv path/to/expansion_questions.csv
```

### Dry Run
```bash
python tools/corpus/import_expansion_questions.py --json path/to/expansion_questions.json --dry-run
```

## Validation Rules

1. **No empty fields**: All required fields must be non-empty
2. **Scope type validation**: `scope_type` must be exactly `SECTOR`, `SUBSECTOR`, or `TECHNOLOGY`
3. **Response enum validation**: If provided, must be exactly `["YES", "NO", "N_A"]`
4. **SAFE prohibition**: No code may contain 'SAFE' (case-insensitive)
5. **Uniqueness**: `(expansion_version, question_code)` must be unique

## Notes

- Questions are upserted by `(expansion_version, question_code)`
- Existing questions with the same key will be updated
- Baseline questions are never modified by this importer
- All operations are CORPUS-scoped only (no RUNTIME database writes)

