# OFC Purge Instructions

## Quick Start

### Windows (PowerShell)

**DRY RUN (Preview what would be deleted):**
```powershell
cd D:\PSA_System\psa_rebuild
.\scripts\run_ofc_purge.bat
```

**APPLY (Actually delete all OFCs):**
```powershell
cd D:\PSA_System\psa_rebuild
$env:ALLOW_OFC_RESET="YES"
.\scripts\run_ofc_purge.bat --apply
```

**VERIFY (Check purge status):**
```powershell
cd D:\PSA_System\psa_rebuild
.\scripts\verify_ofc_purge.bat
```

### Windows (Command Prompt)

**DRY RUN:**
```cmd
cd D:\PSA_System\psa_rebuild
scripts\run_ofc_purge.bat
```

**APPLY:**
```cmd
cd D:\PSA_System\psa_rebuild
set ALLOW_OFC_RESET=YES
scripts\run_ofc_purge.bat --apply
```

**VERIFY:**
```cmd
cd D:\PSA_System\psa_rebuild
scripts\verify_ofc_purge.bat
```

### Unix/Mac/Linux

**DRY RUN (using venv):**
```bash
cd /path/to/psa_rebuild
source venv/bin/activate
python tools/corpus/purge_all_ofcs.py
deactivate
```

**APPLY (using venv):**
```bash
cd /path/to/psa_rebuild
source venv/bin/activate
ALLOW_OFC_RESET=YES python tools/corpus/purge_all_ofcs.py --apply
deactivate
```

**VERIFY (using venv):**
```bash
cd /path/to/psa_rebuild
source venv/bin/activate
python tools/corpus/verify_ofc_purge.py
deactivate
```

**Or use the shell script wrapper:**
```bash
cd /path/to/psa_rebuild
./scripts/run_ofc_purge.sh          # DRY RUN
ALLOW_OFC_RESET=YES ./scripts/run_ofc_purge.sh --apply  # APPLY
./scripts/verify_ofc_purge.sh       # VERIFY
```

## What Gets Deleted

The purge script deletes from these tables (in order):
1. `ofc_question_links` - Links between OFCs and questions
2. `ofc_candidate_targets` - Candidate-to-question target mappings
3. `ofc_candidate_queue` - All OFC candidates (CORPUS and MODULE origins)

## What Gets Preserved

- `corpus_documents` - All documents
- `document_chunks` - All document chunks
- `canonical_sources` - All source references
- `source_registry` - Source registry entries
- `baseline_spines_runtime` - All questions
- `disciplines` - Discipline taxonomy
- `discipline_subtypes` - Subtype taxonomy
- All other tables

## Safety Guards

1. **DRY RUN by default** - No data deleted unless `--apply` is used
2. **Environment variable guard** - `ALLOW_OFC_RESET=YES` required for `--apply`
3. **Transaction safety** - All deletions in single transaction (rollback on error)
4. **Verification** - Script verifies deletion after commit

## Expected Output

### DRY RUN
```
======================================================================
PSA OFC DOCTRINE V1 - FULL PURGE
======================================================================

Mode: DRY RUN
Timestamp: 2026-02-03T12:00:00Z

[INFO] This is a DRY RUN. No data will be deleted.
[INFO] Use --apply with ALLOW_OFC_RESET=YES to apply deletions.

[INFO] Discovering OFC-related tables...
[INFO] ofc_candidate_queue: 1234 rows
[INFO] ofc_question_links: 567 rows
[INFO] ofc_candidate_targets: 890 rows

[DRY RUN] Would delete:
  - ofc_question_links: 567 rows
  - ofc_candidate_targets: 890 rows
  - ofc_candidate_queue: 1234 rows

======================================================================
PURGE SUMMARY
======================================================================

Total rows would be deleted: 2691
  ofc_question_links: 567 → 0
  ofc_candidate_targets: 890 → 0
  ofc_candidate_queue: 1234 → 0

[OK] DRY RUN complete. Review report and use --apply to execute.
[OK] Report written to: analytics/reports/ofc_full_purge_report.json
```

### APPLY
```
======================================================================
PSA OFC DOCTRINE V1 - FULL PURGE
======================================================================

Mode: APPLY
Timestamp: 2026-02-03T12:00:00Z

[WARN] This will DELETE ALL OFCs from CORPUS database!
[WARN] This action cannot be undone.
[WARN] Preserved: documents, chunks, sources, questions, taxonomy

[INFO] Discovering OFC-related tables...
[INFO] ofc_candidate_queue: 1234 rows
[INFO] ofc_question_links: 567 rows
[INFO] ofc_candidate_targets: 890 rows

[APPLY] Deleting from ofc_question_links...
[OK] Deleted 567 rows from ofc_question_links

[APPLY] Deleting from ofc_candidate_targets...
[OK] Deleted 890 rows from ofc_candidate_targets

[APPLY] Deleting from ofc_candidate_queue...
[OK] Deleted 1234 rows from ofc_candidate_queue

[OK] Transaction committed

[VERIFY] Verifying deletion...
[OK] ofc_question_links: 0 rows (verified)
[OK] ofc_candidate_targets: 0 rows (verified)
[OK] ofc_candidate_queue: 0 rows (verified)

======================================================================
PURGE SUMMARY
======================================================================

Total rows deleted: 2691
  ofc_question_links: 567 → 567
  ofc_candidate_targets: 890 → 890
  ofc_candidate_queue: 1234 → 1234

[OK] Purge complete. All OFCs removed from CORPUS database.
[OK] Report written to: analytics/reports/ofc_full_purge_report.json
```

## Verification

After running the purge, verify with:

```bash
python tools/corpus/verify_ofc_purge.py
```

Expected output:
```
======================================================================
OFC PURGE VERIFICATION
======================================================================

✓ ofc_candidate_queue: 0 rows
✓ ofc_question_links: 0 rows
✓ ofc_candidate_targets: 0 rows

======================================================================
✅ VERIFICATION PASSED
All OFC tables are empty (purge successful)
```

## Important: Always Use venv

**RULE: All Python scripts MUST be run from venv.**

The batch/shell scripts automatically activate venv before running Python. If running Python directly, you must activate venv first:

**Windows:**
```cmd
venv\Scripts\activate
python tools\corpus\purge_all_ofcs.py
```

**Unix/Mac/Linux:**
```bash
source venv/bin/activate
python tools/corpus/purge_all_ofcs.py
```

## Troubleshooting

### "Python not found"
- Ensure Python 3.8+ is installed
- Create virtual environment: `python -m venv venv`
- Activate venv: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Unix)
- **Always use venv Python, never system Python directly**

### "ALLOW_OFC_RESET=YES required"
- Set environment variable before running
- Windows: `set ALLOW_OFC_RESET=YES`
- Unix: `export ALLOW_OFC_RESET=YES`

### "Database connection failed"
- Check `.env.local` file exists
- Verify `CORPUS_DATABASE_URL` or `SUPABASE_CORPUS_URL` + `SUPABASE_CORPUS_DB_PASSWORD` are set

### "Table does not exist"
- This is OK - script skips non-existent tables
- Only existing tables are purged

## Report File

After running (DRY RUN or APPLY), a report is written to:
`analytics/reports/ofc_full_purge_report.json`

This contains:
- Mode (DRY_RUN or APPLY)
- Timestamp
- Table counts (before/after)
- Any errors encountered

---

**See also:** `docs/doctrine/PSA_OFC_DOCTRINE_V1.md`
