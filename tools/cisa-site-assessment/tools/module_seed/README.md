# Module Seed Tools

Tools for managing module VOFCs (Options for Consideration) and module lifecycle.

## Prerequisites

All Python scripts **must be run in a virtual environment (venv)**.

### Setting up venv

```bash
# Create venv (if it doesn't exist)
python -m venv .venv

# Activate venv
# Windows:
.venv\Scripts\activate

# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Required Environment Variables

Set these in `.env.local` or your environment:

- `RUNTIME_DATABASE_URL` - Connection string for RUNTIME database
- `CORPUS_DATABASE_URL` - Connection string for CORPUS database (optional, for source_registry)

## Tools

### Diagnostic Tools

#### `diagnose_table_locations.py`
Check where tables exist (CORPUS vs RUNTIME).

```bash
python tools/module_seed/diagnose_table_locations.py
```

#### `deconflict_module_vofc_tables.py`
Check and clean up duplicate module VOFC tables between databases.

```bash
# Check for issues
python tools/module_seed/deconflict_module_vofc_tables.py

# Auto-fix empty duplicates
python tools/module_seed/deconflict_module_vofc_tables.py --drop-empty
```

### Module VOFC Tools

#### `extract_vehicle_ramming_vofcs_from_xlsx.py`
Extract VOFCs from XLSX file.

```bash
$env:VOFC_LIBRARY_XLSX="D:\PSA_System\psa_rebuild\data\VOFC_Library.xlsx"
python tools/module_seed/extract_vehicle_ramming_vofcs_from_xlsx.py
```

#### `load_module_vofcs.py`
Load module VOFCs from JSON into database.

```bash
python tools/module_seed/load_module_vofcs.py tools/module_seed/MODULE_VEHICLE_RAMMING_SAT_vofcs.json
```

### Module Lifecycle Tools

#### `demote_module_to_draft.py`
Demote a module from ACTIVE to DRAFT status.

```bash
python tools/module_seed/demote_module_to_draft.py MODULE_CODE
```

#### `delete_module.py`
Completely delete a module and all related data.

```bash
# Single module
python tools/module_seed/delete_module.py MODULE_CODE

# Multiple modules
python tools/module_seed/delete_module.py MODULE_CODE_1 MODULE_CODE_2

# Skip confirmation
python tools/module_seed/delete_module.py MODULE_CODE --force
```

## Verification

### SQL Verification

Run `verify_module_vofc_setup.sql` in your databases:
- Section A: RUNTIME database queries
- Section B: CORPUS database queries (if source_registry is there)

### Quick Check

```bash
# Check table locations
python tools/module_seed/diagnose_table_locations.py

# Check for duplicate tables
python tools/module_seed/deconflict_module_vofc_tables.py
```

## Notes

- All scripts check for venv and will exit with an error if not in venv
- Scripts automatically load `.env.local` if available
- Database connections use `RUNTIME_DATABASE_URL` and `CORPUS_DATABASE_URL`
- Module VOFC tables (`module_ofc_library`, `module_ofc_citations`) should ONLY exist in RUNTIME
- `source_registry` should exist in CORPUS (or RUNTIME if migrated there)
