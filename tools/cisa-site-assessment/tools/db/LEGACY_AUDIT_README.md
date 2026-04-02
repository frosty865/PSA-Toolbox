# Legacy V1 Tables Audit & Quarantine

Tools to identify and safely quarantine legacy V1 tables without data loss.

## Overview

This process identifies tables that are likely leftover from v1 and no longer used, then quarantines them by renaming (reversible operation). No deletions are performed automatically.

## Tools

### 1. `audit_legacy_v1_tables.ts`
Audits both CORPUS and RUNTIME databases to identify legacy candidates.

**What it does:**
- Connects to CORPUS + RUNTIME databases
- Collects table metadata (row counts, size, FK relationships, timestamps)
- Scans codebase for table references (app/, tools/, scripts/, migrations/)
- Flags tables as "likely legacy" based on conservative criteria

**Criteria for "likely legacy":**
- Zero code references AND
- Zero incoming foreign keys (nothing depends on it) AND
- Either zero rows OR no updates in 90+ days

**Outputs:**
- `analytics/reports/legacy_v1_audit_corpus.json`
- `analytics/reports/legacy_v1_audit_runtime.json`
- `analytics/reports/legacy_v1_candidates.md` (human-readable summary)

### 2. `generate_quarantine_sql.ts`
Generates reversible RENAME SQL statements for quarantine.

**What it does:**
- Reads audit reports
- Filters tables that meet quarantine criteria (zero code refs + zero dependencies)
- Generates `ALTER TABLE ... RENAME TO legacy_v1__...` statements
- Includes reverse instructions in comments

**Outputs:**
- `analytics/reports/quarantine_corpus.sql`
- `analytics/reports/quarantine_runtime.sql`

## Usage

### Step 1: Run Audit
```bash
npm run db:legacy-audit
```

This will:
1. Connect to both databases
2. Inventory all tables
3. Scan codebase for references
4. Generate reports

### Step 2: Review Results
Review the generated markdown report:
```
analytics/reports/legacy_v1_candidates.md
```

Check:
- Which tables are flagged as legacy
- Evidence (row counts, code refs, dependencies)
- Tables with zero code refs but still in use (manual review)

### Step 3: Generate Quarantine SQL
```bash
npm run db:legacy-quarantine-sql
```

This creates SQL files with reversible RENAME operations.

### Step 4: Apply Quarantine
**IMPORTANT:** Review SQL files before running!

```sql
-- Run against CORPUS database
-- Source: analytics/reports/quarantine_corpus.sql

-- Run against RUNTIME database
-- Source: analytics/reports/quarantine_runtime.sql
```

### Step 5: Test Application
Run the application and pipelines for a day to ensure nothing breaks.

### Step 6: Generate Drop Script (Optional)
After validation, create a separate DROP script if needed.

## Safety Features

### Reversible Operations
All quarantine operations are reversible:
```sql
-- Quarantine
ALTER TABLE public.old_table RENAME TO legacy_v1__old_table;

-- Reverse (if needed)
ALTER TABLE public.legacy_v1__old_table RENAME TO old_table;
```

### Conservative Criteria
- Only quarantines tables with:
  - Zero code references
  - Zero incoming foreign keys
- False positives are OK (can be reversed)
- False negatives are avoided (conservative approach)

### No Automatic Deletions
- This process only renames tables
- DROP statements are generated separately after validation

## Table Name Handling

PostgreSQL identifier limit is 63 characters. If a legacy name would exceed this:
- Original: `very_long_table_name_that_exceeds_limit`
- Legacy: `legacy_v1__very_long_table_name_that_exceeds_lim_a1b2c3d4`

The hash ensures uniqueness if truncation occurs.

## Code Scanning

The audit scans for common table reference patterns:
- `"public.table_name"`
- `from public.table_name`
- `.from('table_name')`
- `INSERT INTO table_name`
- `UPDATE table_name`
- And more...

Searches in:
- `app/` (Next.js application)
- `tools/` (utility scripts)
- `scripts/` (build scripts)
- `migrations/` (database migrations)

## Run Order

1. ✅ `npm run db:legacy-audit` - Generate audit reports
2. ✅ Review `analytics/reports/legacy_v1_candidates.md`
3. ✅ `npm run db:legacy-quarantine-sql` - Generate quarantine SQL
4. ✅ Review SQL files
5. ✅ Apply quarantine SQL to CORPUS + RUNTIME
6. ✅ Test application + pipelines (1 day)
7. ✅ If nothing breaks, generate DROP script (separate step)

## Done Criteria

- ✅ Verified list of unused v1 tables with evidence
- ✅ Unused tables are quarantined (renamed), not deleted
- ✅ Application and tools still function
- ✅ Next step (optional) is generating DROP script after validation

## Troubleshooting

### No tables found
- Check database connections (CORPUS_DATABASE_URL, RUNTIME_DATABASE_URL)
- Verify tables exist in public schema

### Code scanning issues
- Ensure ripgrep (`rg`) or grep is available
- Check file permissions in app/, tools/, scripts/, migrations/

### Quarantine SQL errors
- Verify table names don't conflict
- Check PostgreSQL identifier length limits
- Ensure tables exist before renaming

## Related Tools

- `db:audit` - General pool separation audit
- `db:pool-diff` - Compare CORPUS vs RUNTIME schemas
- `db:pool-cleanup-sql` - Generate cleanup SQL for duplicates
