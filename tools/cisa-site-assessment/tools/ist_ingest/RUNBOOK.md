# IST Library Ingestion Runbook

Complete workflow for ingesting VOFC_Library.xlsx into the canonical OFC system.

## Prerequisites

1. **Workbook**: Copy `VOFC_Library.xlsx` to `tools/ist_ingest/input/`
2. **Python dependencies**:
   ```bash
   pip install pandas openpyxl psycopg2-binary requests
   ```
3. **Database access**: Ensure `DATABASE_URL` or database credentials are set in `env.local`
4. **Discipline mapping**: Update `scripts/db/ist_sheet_to_taxonomy_map.json` with actual UUIDs

## Step 1: Extract Workbook

Extract all sheets from the Excel workbook into normalized JSON format.

```bash
cd tools/ist_ingest
python extract_ist_workbook.py
```

**Outputs:**
- `output/ist_extracted_rows.jsonl` - One JSON record per row
- `output/ist_normalized_packages.json` - Grouped by discipline/sheet

**What it does:**
- Reads all sheets (tabs) from the workbook
- Detects header rows dynamically
- Normalizes column names (case-insensitive matching)
- Applies carry-forward rules for parent_question and child_node
- Exports normalized records

## Step 2: Validate Extract

Validate the extracted data for quality and completeness.

```bash
python validate_ist_extract.py
```

**Checks:**
- At least 1 discipline sheet parsed
- Each discipline has >= 10 records
- % rows with parent_question not null > 50%
- If ofc_text exists then reference must exist

**Exit codes:**
- `0` = Validation passed
- `1` = Validation failed (fix issues before proceeding)

## Step 3: Modernize Text

Modernize phrasing while preserving meaning.

```bash
python modernize_ist_text.py
```

**Optional LLM pass:**
Set `OLLAMA_URL` environment variable to enable LLM-based modernization:
```bash
export OLLAMA_URL=http://localhost:11434
python modernize_ist_text.py
```

**Outputs:**
- `output/ist_normalized_packages_modern.json` - Modernized packages
- `output/modernize_diff_report.jsonl` - Before/after diff for changed fields

**What it does:**
- Deterministic rewrites (always applied):
  - Replace dated terms (manpower → staffing, guards → security personnel, etc.)
  - Remove double negatives
  - Normalize question style
  - Remove "should consider" duplications
- Optional LLM pass (if OLLAMA_URL set):
  - Rewrites text fields using local Ollama
  - Preserves meaning, no implementation details
  - No cyber/regulatory language
- Forbidden terms guard:
  - Fails if cyber/regulatory terms are introduced

## Step 4: Prepare Discipline Mapping

Before importing, update the discipline mapping file with actual UUIDs from your database.

```bash
# Get discipline UUIDs
psql $DATABASE_URL -c "SELECT id, name, code FROM disciplines ORDER BY name;"

# Get subtype UUIDs (if needed)
psql $DATABASE_URL -c "SELECT id, name, code, discipline_id FROM discipline_subtypes ORDER BY name;"
```

Edit `scripts/db/ist_sheet_to_taxonomy_map.json`:
```json
{
  "Access Control": {
    "discipline_id": "actual-uuid-here",
    "discipline_subtype_id": null
  },
  ...
}
```

**Important:** The importer will fail if a sheet_name is missing from the mapping.

## Step 5: Import to Database

Import modernized data into active tables.

```bash
cd ../../scripts/db
python import_ist_library.py
```

**What it does:**
- Imports questions into the existing question table
- Imports OFC nominations
- Auto-approves to canonical if `SECURITY_MODE == DISABLED`

**Tables modified:**
- Question table - Questions written via standard import path
- `public.ofc_nominations` - OFC nominations (submitted_by = 'IST_IMPORT')
- `public.canonical_ofcs` - Only if auto-approve enabled
- `public.canonical_ofc_citations` - Only if auto-approve enabled
- `public.ofc_nomination_decisions` - Only if auto-approve enabled

**DO NOT modifies:**
- `public.baseline_questions` - Never touched (baseline questions are authoritative and immutable)
- Legacy tables - Never touched

**Idempotency:**
- Uses natural keys (codes) for upsert
- Duplicate nominations are skipped (based on hash of ofc_text)

## Step 6: Verify Import

Verify that the import was successful.

```bash
python verify_ist_import.py
```

**Checks:**
- Questions imported via standard question table
- Number of nominations > 0
- If DISABLED mode: canonical_ofcs increased and each has >=1 citation

**Expected output:**
```
Questions: Imported via standard question table (verification skipped)
  ✓ PASS

OFC nominations (IST_IMPORT): 45
  ✓ PASS

Security mode: DISABLED
Canonical OFCs (IST_IMPORT): 45
  ✓ All canonical OFCs have citations (45 total)
  ✓ PASS
```

## Troubleshooting

### Extract fails to find headers
- Check that the workbook has the expected column names
- Some sheets may have title rows before headers - the extractor handles this automatically

### Validation fails on reference check
- Some OFCs may legitimately not have references in the source
- Review the validation errors and decide if you need to add references manually

### LLM modernization introduces forbidden terms
- The script will fail with an error message
- Review the diff report to see what changed
- You may need to adjust the LLM prompt or skip LLM pass

### Import fails on missing discipline mapping
- Ensure all sheet names from the workbook are in `ist_sheet_to_taxonomy_map.json`
- Sheet names must match exactly (case-sensitive)

### Auto-approve not working
- Check `SECURITY_MODE` in `system_settings` table
- Only `DISABLED` mode enables auto-approve
- In `ENGINEERING` or `ENFORCED` modes, nominations remain `SUBMITTED` for review

## File Locations

```
tools/ist_ingest/
├── input/
│   └── VOFC_Library.xlsx          # Input workbook (copy here)
├── output/
│   ├── ist_extracted_rows.jsonl    # Step 1 output
│   ├── ist_normalized_packages.json # Step 1 output
│   ├── ist_normalized_packages_modern.json # Step 3 output
│   └── modernize_diff_report.jsonl # Step 3 output
├── extract_ist_workbook.py         # Step 1
├── validate_ist_extract.py         # Step 2
├── modernize_ist_text.py           # Step 3
└── RUNBOOK.md                      # This file

scripts/db/
├── ist_sheet_to_taxonomy_map.json  # Discipline mapping (update before Step 5)
├── import_ist_library.py           # Step 5
└── verify_ist_import.py            # Step 6
```

## Notes

- **No baseline modification**: This process never touches `baseline_questions` (baseline questions are authoritative and immutable)
- **Question imports**: Questions are written to the existing question table via standard import path
- **Engineering submissions**: Nominations are submitted by `ENGINEER` role (not FIELD)
- **Idempotent**: Running import multiple times is safe (uses upsert logic)
- **OFC quarantine**: Only OFC nominations with `reference_unresolved == true` are quarantined

