# Database Targeting Implementation Summary

## Overview

A deterministic database targeting system has been implemented to enforce strict separation between RUNTIME and CORPUS Supabase projects. All writer tools must explicitly specify their target and pass validation before any database writes.

## Files Created

### Core Modules

1. **`app/db/db_targets.py`**
   - Authoritative target definitions: `TARGETS = {"runtime": "wivohgbuuwxoyfyzntsd", "corpus": "yylslokiaovdythzrbgt"}`
   - Target normalization: `normalize_target()`
   - Reference lookup: `get_expected_ref()`

2. **`app/db/db_guard.py`**
   - Connection string parsing: `parse_supabase_project_ref()`
   - Connection string retrieval: `get_conn_str()`
   - Sanitization: `sanitize_conn_str()`
   - Target validation: `require_db_target()`

3. **`app/db/db_router.py`**
   - Environment resolution: `resolve_target_from_env()`
   - CLI/Env resolution: `require_target_from_cli_or_env()`
   - Write guard: `guard_write()`

4. **`app/db/__init__.py`**
   - Package exports

### Tools

5. **`tools/preflight_db.py`**
   - Preflight validation tool
   - Usage: `python tools/preflight_db.py --target runtime|corpus [--show]`
   - Exit codes: 0 (PASS), 2 (FAIL)

6. **`tools/import_baseline_canon.py`**
   - Stub tool for baseline canon import
   - Must target RUNTIME only
   - Requires explicit mapping (TODO)

### Documentation

7. **`docs/DB_TARGETING.md`**
   - Complete usage documentation
   - Environment variables
   - Error messages
   - Validation checklist

## Updated Writer Tools

The following tools have been updated to require `--target` and `--apply`:

1. **`tools/import_ofc_templates.py`**
   - Added `--target` argument
   - Added `--apply` flag (default: dry-run)
   - Calls `guard_write(target)` before connection

2. **`tools/import_sources.py`**
   - Added `--target` argument
   - Added `--apply` flag (default: dry-run)
   - Calls `guard_write(target)` before connection

3. **`tools/import_ofc_library.py`**
   - Added `--target` argument
   - Added `--apply` flag (default: dry-run)
   - Calls `guard_write(target)` before connection

4. **`tools/corpus/import_expansion_questions.py`**
   - Added `--target` argument (default: corpus)
   - Added `--apply` flag (default: dry-run)
   - Validates target is "corpus"
   - Calls `guard_write(target)` before connection

## Usage Pattern

All updated writer tools follow this pattern:

```python
from app.db.db_router import guard_write, require_target_from_cli_or_env

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['runtime', 'corpus'])
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    
    # Resolve and guard target
    target = require_target_from_cli_or_env(args.target)
    guard_write(target)  # Hard-fails if mismatch detected
    
    # ... connect to database ...
    
    # Only write if --apply is set
    if args.apply:
        # ... perform writes ...
    else:
        print("DRY RUN: Use --apply to write changes")
```

## Validation

### Preflight Check

Before running any writer tool:

```bash
# Validate RUNTIME connection
python tools/preflight_db.py --target runtime

# Validate CORPUS connection
python tools/preflight_db.py --target corpus
```

### Writer Tool Usage

```bash
# Dry-run (default)
python tools/import_ofc_templates.py --target runtime

# Apply changes
python tools/import_ofc_templates.py --target runtime --apply

# Using environment variable
PSA_DB_TARGET=runtime python tools/import_ofc_templates.py --apply
```

## Safety Features

1. **Fail Closed**: Writes are blocked if connection string doesn't match target
2. **No Implicit Selection**: Target must be explicitly specified
3. **Dry-Run Default**: Tools default to dry-run unless `--apply` is set
4. **Clear Error Messages**: Mismatches show expected vs actual project refs
5. **Sanitized Output**: Connection strings are sanitized before printing

## Next Steps

Additional writer tools that may need updating:
- `tools/corpus/ingest_*.py` scripts
- `scripts/db/import_*.py` scripts
- Any other tools that write to database

These should follow the same pattern:
1. Add `--target` argument
2. Add `--apply` flag
3. Call `guard_write(target)` before connection
4. Only write if `--apply` is set

## Related Documentation

- `docs/DB_TARGETING.md` - Complete usage guide
- `app/db/db_targets.py` - Target definitions
- `app/db/db_guard.py` - Guard implementation
- `app/db/db_router.py` - Router implementation
