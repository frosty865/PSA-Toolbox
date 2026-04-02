# Sector and Subsector Question Generation

## Overview

This tool generates sector- and subsector-specific questions that are additive to baseline questions. The questions follow capability-based templates and ensure no duplication or restatement of baseline content.

## Files Created

1. **`analytics/runtime/baseline_questions_registry.json`**
   - Baseline questions registry (source of truth for baseline questions)
   - Extracted from `app/lib/fixtures/required_elements_baseline.json`

2. **`analytics/tools/generate_sector_subsector_questions.py`**
   - Main generation script
   - Loads taxonomy from database
   - Generates questions using templates
   - Validates output

## Output Structure

Questions are written to:

```
analytics/questions/
├── sector/
│   └── <sector_name>/
│       └── <discipline_name>/
│           └── <subtype_name>.json
└── subsector/
    └── <sector_name>/
        └── <subsector_name>/
            └── <discipline_name>/
                └── <subtype_name>.json
```

## Question Templates

The script uses four template categories:

1. **SYSTEMS**: "The facility has system capabilities to support {subtype_scope} that address {condition}."
2. **PLANS_PROCEDURES**: "The facility has documented plans or procedures that enable the facility to manage {subtype_scope} capabilities in support of {condition}."
3. **MAINTENANCE_ASSURANCE**: "The facility has defined activities to sustain {subtype_scope} capabilities in environments where {condition} applies."
4. **PERSONNEL_RESPONSIBILITY**: "The facility has documented roles and responsibilities for {subtype_scope} capabilities related to {condition}."

## Output File Format

Each output file contains:

```json
{
  "metadata": {
    "authority_scope": "SECTOR" | "SUBSECTOR",
    "sector_id": "...",
    "sector_name": "...",
    "subsector_id": "..." (if applicable),
    "subsector_name": "..." (if applicable),
    "discipline_id": "...",
    "discipline_name": "...",
    "discipline_subtype_id": "...",
    "discipline_subtype_name": "..."
  },
  "rationale": "Explanation of why baseline is insufficient",
  "questions": [
    {
      "question_text": "...",
      "template_category": "SYSTEMS" | "PLANS_PROCEDURES" | "MAINTENANCE_ASSURANCE" | "PERSONNEL_RESPONSIBILITY",
      "discipline_id": "...",
      "discipline_name": "...",
      "discipline_subtype_id": "...",
      "discipline_subtype_name": "...",
      "sector_id": "...",
      "sector_name": "...",
      "subsector_id": "..." (if applicable),
      "subsector_name": "..." (if applicable)
    }
  ]
}
```

## Usage

### Prerequisites

1. Database connection configured (DATABASE_URL in env.local or .env.local)
2. Python 3.x with psycopg2 installed
3. Baseline questions registry at `analytics/runtime/baseline_questions_registry.json`

### Running the Script

```bash
# From project root
python analytics/tools/generate_sector_subsector_questions.py
```

Or with virtual environment:

```bash
venv/Scripts/python.exe analytics/tools/generate_sector_subsector_questions.py
```

### What It Does

1. **Loads baseline questions** from the registry
2. **Connects to database** to fetch:
   - Sectors (active only)
   - Subsectors (active only)
   - Disciplines (active only)
   - Discipline subtypes (active only)
3. **Generates sector questions** for each sector/discipline/subtype combination
4. **Generates subsector questions** for each subsector/discipline/subtype combination
5. **Validates output**:
   - No duplicate question text across files
   - No baseline question restatements
   - All questions map to valid discipline/subtype
6. **Prints summary** with counts per sector/subsector

## Validation Rules

The script enforces:

- ✅ No duplicate question text across any generated files
- ✅ No questions that restate baseline questions
- ✅ All questions must map to valid discipline/subtype combinations
- ✅ Questions must be additive (introduce scope not covered by baseline)

**The script will FAIL HARD on any validation violation.**

## Template Selection

The script uses heuristics to determine which template category to use based on subtype name:

- Contains "system" or "capability" → SYSTEMS
- Contains "plan", "procedure", or "policy" → PLANS_PROCEDURES
- Contains "maintenance", "assurance", or "testing" → MAINTENANCE_ASSURANCE
- Contains "personnel", "responsibility", or "role" → PERSONNEL_RESPONSIBILITY
- Default → SYSTEMS

**Note**: This is a simplified implementation. In practice, you may want to refine template selection based on actual subtype characteristics or add explicit mappings.

## Customization

To customize question generation:

1. **Modify templates**: Edit `QUESTION_TEMPLATES` dictionary
2. **Adjust template selection**: Modify `determine_template_category()` function
3. **Change generation logic**: Modify `should_generate_question()` function to add custom rules
4. **Add filtering**: Filter sectors/subsectors/disciplines before generation

## Notes

- Questions are file-authoritative (no database writes)
- Baseline questions are frozen and never modified
- Sector/subsector questions are additive-only
- All questions follow capability-based template style
- Output files use safe filename characters (replaces `/` and `\` with `_`)

