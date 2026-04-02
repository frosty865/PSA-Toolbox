# Database Targeting System

## Overview

The PSA Tool uses two separate Supabase projects for different data:

- **RUNTIME** (project ref: `wivohgbuuwxoyfyzntsd`)
  - Assessment data, responses, OFC library, expansion questions
  - Tables: `assessments`, `assessment_instances`, `assessment_responses`, `ofc_nominations`, `ofc_library`, `expansion_questions`

- **CORPUS** (project ref: `yylslokiaovdythzrbgt`)
  - Document ingestion, OFC candidates, canonical sources
  - Tables: `canonical_sources`, `documents`, `document_chunks`, `ingestion_runs`, `ofc_candidate_queue`, `ofc_candidate_targets`

## Safety Guard System

All writer tools must explicitly specify which database they target. The system enforces "fail closed" behavior: writes are blocked if the configured connection string doesn't match the intended target.

## Environment Variables

### Required

- `DATABASE_URL` or `SUPABASE_URL` - Database connection string
  - Must point to one of the two Supabase projects
  - Format: `postgresql://postgres:password@db.{project_ref}.supabase.co:6543/postgres`
  - Or: `https://{project_ref}.supabase.co`

### Optional

- `PSA_DB_TARGET` - Default target if `--target` is not provided
  - Values: `runtime` or `corpus`
  - Recommended for scripts that always target the same database

## Usage

### Preflight Check

Before running any writer tool, validate your database connection:

```bash
# Check RUNTIME connection
python tools/preflight_db.py --target runtime

# Check CORPUS connection
python tools/preflight_db.py --target corpus

# Show connection details
python tools/preflight_db.py --target runtime --show
```

**Exit codes:**
- `0` - PASS: Database target matches connection string
- `2` - FAIL: Mismatch detected or invalid configuration

### Writer Tools

All writer tools must:

1. Accept `--target runtime|corpus` argument (or use `PSA_DB_TARGET` env var)
2. Call `guard_write(target)` before any database writes
3. Require `--apply` flag for actual writes (default: dry-run)

**Example:**

```python
from app.db.db_router import guard_write, require_target_from_cli_or_env

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['runtime', 'corpus'])
    parser.add_argument('--apply', action='store_true', help='Apply changes (default: dry-run)')
    args = parser.parse_args()
    
    # Resolve and guard target
    target = require_target_from_cli_or_env(args.target)
    guard_write(target)  # Hard-fails if mismatch detected
    
    # Proceed with writes only if --apply is set
    if args.apply:
        # ... perform writes ...
    else:
        print("DRY RUN: Use --apply to write changes")
```

## Fail Closed Behavior

The system enforces strict validation:

1. **Connection string parsing** - Must be able to extract project reference
   - If parsing fails → RuntimeError, exit code 2

2. **Target matching** - Parsed ref must match expected ref for target
   - If mismatch → RuntimeError with details, exit code 2

3. **No implicit selection** - Target must be explicitly specified
   - If missing → ValueError, exit code 2

## Error Messages

The system provides clear, actionable error messages:

```
ERROR: Database target mismatch detected!
  Requested target: runtime
  Expected project ref: wivohgbuuwxoyfyzntsd
  Actual project ref: yylslokiaovdythzrbgt
  Connection string (sanitized): db.yylslokiaovdythzrbgt.supabase.co:6543/postgres

This is a safety guard to prevent writing to the wrong database.
To fix: Update DATABASE_URL or SUPABASE_URL to point to the correct project.
```

## Implementation Details

### Module Structure

- `app/db/db_targets.py` - Authoritative target definitions and normalization
- `app/db/db_guard.py` - Connection string parsing and validation
- `app/db/db_router.py` - Target resolution and guard integration

### Project Reference Parsing

The system extracts project references from:
- PostgreSQL connection strings: `postgresql://...@db.{ref}.supabase.co:port/db`
- HTTPS URLs: `https://{ref}.supabase.co`
- Alternative formats: `db.{ref}.supabase.co`

### Sanitization

Connection strings are sanitized before printing:
- Passwords are replaced with `***`
- Only hostname, port, and database name are shown
- No credentials are logged or displayed

## Validation Checklist

Before deploying writer tools, verify:

- ✅ With `DATABASE_URL` pointing to RUNTIME:
  - `preflight --target runtime` → PASS
  - `preflight --target corpus` → FAIL (hard)

- ✅ With `DATABASE_URL` pointing to CORPUS:
  - `preflight --target corpus` → PASS
  - `preflight --target runtime` → FAIL (hard)

- ✅ Writer tools:
  - Without `--target` (and no `PSA_DB_TARGET`) → Refuse to run
  - Without `--apply` → Dry-run only, no writes

## Related Documentation

- `app/db/db_targets.py` - Target definitions
- `app/db/db_guard.py` - Guard implementation
- `app/db/db_router.py` - Router implementation
- `tools/preflight_db.py` - Preflight tool
- `docs/BASELINE_CANON_IMPORT.md` - Baseline canon import runbook