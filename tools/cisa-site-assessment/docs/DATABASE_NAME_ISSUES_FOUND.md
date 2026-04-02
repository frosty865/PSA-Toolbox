# Database Name Issues Found

## Critical Issues (Must Fix)

### 1. `env.local` - DATABASE_URL still points to `postgres`
**File**: `env.local` line 8
**Issue**: `DATABASE_URL=postgresql://.../postgres`
**Fix**: Update to `/psa_runtime` or remove if not needed (app should use RUNTIME_DATABASE_URL)

### 2. `model/db/db_config.py` - Hardcoded `dbname=postgres`
**File**: `model/db/db_config.py` lines 128, 168
**Issue**: Python DSN construction hardcodes `dbname=postgres`
**Impact**: Python tools may connect to wrong database
**Fix**: Extract database name from connection string or use environment variable

### 3. `tools/seed_baseline_spines_local.ts` - Hardcoded `/postgres`
**File**: `tools/seed_baseline_spines_local.ts` line 50
**Issue**: Connection string hardcodes `/postgres`
**Fix**: Use `RUNTIME_DATABASE_URL` environment variable or extract database name

### 4. `scripts/test_db_connections.js` - Hardcoded `/postgres`
**File**: `scripts/test_db_connections.js` lines 29, 67, 88
**Issue**: Connection strings hardcode `/postgres`
**Fix**: Use `RUNTIME_DATABASE_URL` and `CORPUS_DATABASE_URL` environment variables

## Medium Priority (Should Fix)

### 5. Python Tools - Hardcoded `database='postgres'`
**Files**:
- `tools/copy_baseline_spines_to_psa_runtime.py` (line 28 - source DB, OK)
- `tools/copy_schema_to_psa_runtime.py` (line 98 - source DB, OK)
- `tools/copy_schema_to_psa_runtime_v2.py` (line 32 - source DB, OK)
- `tools/check_baseline_spines_columns.py` (line 12 - source DB, OK)

**Note**: These are OK because they're reading from the source `postgres` database. Only fix if you want them to be configurable.

### 6. Documentation - References to `postgres` database name
**Files**: Various docs files
**Issue**: Documentation examples show `/postgres` in connection strings
**Fix**: Update examples to show both `/psa_corpus`/`/psa_runtime` (preferred) and `/postgres` (fallback)

## Low Priority (Documentation Only)

### 7. Python Scripts - Hardcoded `/postgres` in connection strings
**Files**:
- `tools/backfill/backfill_document_citations.py`
- `tools/corpus/ingest_one_document.py`
- `tools/corpus_ingest_pdf.py`
- `tools/corpus/source_set.py`
- `tools/corpus/overlay_control.py`
- Various other corpus tools

**Note**: These are CORPUS tools that may intentionally use `postgres` database name. Check if they should use `psa_corpus` instead.

## Summary

**Critical**: 4 files need immediate attention
**Medium**: Documentation updates recommended
**Low**: Python corpus tools may need review

---

## ✅ FIXES APPLIED

### 1. `env.local` - Updated DATABASE_URL
- **Fixed**: Commented out legacy `DATABASE_URL` and added `RUNTIME_DATABASE_URL` pointing to `psa_runtime`
- **Status**: ✅ Fixed

### 2. `model/db/db_config.py` - Extract database name from connection strings
- **Fixed**: Updated `get_postgres_dsn()` to extract database name from `CORPUS_DATABASE_URL` and `RUNTIME_DATABASE_URL`
- **Default**: Falls back to `psa_corpus` and `psa_runtime` respectively
- **Status**: ✅ Fixed

### 3. `tools/seed_baseline_spines_local.ts` - Use RUNTIME_DATABASE_URL
- **Fixed**: Updated to prefer `RUNTIME_DATABASE_URL` environment variable
- **Fallback**: Constructs connection string with `psa_runtime` database name
- **Status**: ✅ Fixed

### 4. `scripts/test_db_connections.js` - Use proper environment variables
- **Fixed**: Updated to prefer `RUNTIME_DATABASE_URL` and `CORPUS_DATABASE_URL`
- **Fallback**: Constructs connection strings with `psa_runtime` and `psa_corpus` database names
- **Status**: ✅ Fixed

### 5. `tools/run_source_registry_migration.py` - Extract database name
- **Fixed**: Updated to extract database name from `CORPUS_DATABASE_URL`
- **Default**: Falls back to `psa_corpus`
- **Status**: ✅ Fixed

---

## ⚠️ REMAINING ISSUES (Non-Critical)

### Python Corpus Tools
Many Python corpus tools still hardcode `/postgres` in connection strings. These are typically:
- One-off scripts for data migration
- Tools that read from the source `postgres` database (which is OK)
- Tools that may need manual updates if database names change

**Recommendation**: Review these tools individually if they need to target `psa_corpus` instead of `postgres`.

### Documentation
Various documentation files show examples with `/postgres` database name. These should be updated to show both:
- Preferred: `/psa_corpus` and `/psa_runtime`
- Fallback: `/postgres` (for managed environments where database creation isn't permitted)

**Recommendation**: Update documentation as needed, but not critical for functionality.
