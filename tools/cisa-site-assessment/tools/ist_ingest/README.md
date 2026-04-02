# IST Library Ingestion Tools

Tools for ingesting VOFC_Library.xlsx (DHS/IST legacy content) into the canonical OFC system.

## Quick Start

1. **Install dependencies:**
   ```bash
   # Using the project's virtual environment
   ..\..\venv\Scripts\python.exe -m pip install -r requirements.txt
   
   # Or if you have Python in PATH:
   pip install -r requirements.txt
   ```

2. **Place workbook:**
   ```bash
   cp /path/to/VOFC_Library.xlsx input/
   ```

3. **Run extraction:**
   ```bash
   # Using the project's virtual environment
   ..\..\venv\Scripts\python.exe extract_ist_workbook.py
   
   # Or if Python is in PATH:
   python extract_ist_workbook.py
   ```

4. **Validate:**
   ```bash
   ..\..\venv\Scripts\python.exe validate_ist_extract.py
   ```

5. **Modernize:**
   ```bash
   ..\..\venv\Scripts\python.exe modernize_ist_text.py
   ```

6. **Import to database:**
   ```bash
   cd ../../scripts/db
   python import_ist_library.py
   ```

7. **Verify:**
   ```bash
   python verify_ist_import.py
   ```

## Detailed Documentation

See [RUNBOOK.md](RUNBOOK.md) for complete step-by-step instructions.

## Directory Structure

```
ist_ingest/
├── input/
│   ├── README.md              # Input instructions
│   └── VOFC_Library.xlsx      # Place workbook here
├── output/                    # Generated files
│   ├── ist_extracted_rows.jsonl
│   ├── ist_normalized_packages.json
│   ├── ist_normalized_packages_modern.json
│   └── modernize_diff_report.jsonl
├── extract_ist_workbook.py   # Step 1: Extract
├── validate_ist_extract.py   # Step 2: Validate
├── modernize_ist_text.py     # Step 3: Modernize
├── RUNBOOK.md                # Complete guide
├── README.md                 # This file
└── requirements.txt           # Python dependencies
```

## Features

- **Dynamic header detection** - Handles variations in column names and title rows
- **Row carry-forward logic** - Preserves parent_question and child_node context
- **YES/NO interpretation** - Correctly handles question tree logic
- **Deterministic modernization** - Always-applied text improvements
- **Optional LLM pass** - Set `OLLAMA_URL` for advanced modernization
- **Forbidden terms guard** - Prevents cyber/regulatory language
- **Idempotent import** - Safe to run multiple times

## Requirements

- Python 3.8+
- See `requirements.txt` for package dependencies
- Database access (for import step)
- Discipline mapping file (update `scripts/db/ist_sheet_to_taxonomy_map.json`)

## Notes

- **Never modifies baseline questions** - Only creates supplemental templates
- **PSA-scope only** - No cyber/regulatory language introduced
- **Full audit trail** - All imports tracked with `IST_IMPORT` identifier

