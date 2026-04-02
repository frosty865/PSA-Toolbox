# Module VOFC Setup Verification

**NOTE:** This is a documentation file. For executable SQL queries, use `verify_module_vofc_setup.sql` in this directory.

## Quick Start

**PREREQUISITE:** Ensure the module VOFC tables exist. Run this migration first:
- `db/migrations/runtime/20260126_1200_module_vofc_library.sql` (in RUNTIME database)

**Step 1: Check table locations**
```bash
# Option A: Use Python diagnostic (recommended)
python tools/module_seed/diagnose_table_locations.py

# Option B: Use SQL diagnostic (run in both databases)
# In Supabase SQL Editor, run tools/module_seed/check_table_locations.sql
# Run it once in RUNTIME, then once in CORPUS
```

**Step 2: Run verification queries**
```bash
# In Supabase SQL Editor or psql, run:
# tools/module_seed/verify_module_vofc_setup.sql
# (Follow the SECTION A and SECTION B instructions)
```

## 1. Verify UNIQUE constraint on source_registry.doc_sha256

Run in the DB that contains `public.source_registry` (CORPUS or RUNTIME, depending on your setup).

**Expected:** A unique index/constraint including `doc_sha256`

**If not present:** Apply migration:
- `db/migrations/corpus/20260126_add_unique_constraint_doc_sha256.sql`

## 2. Verify Module VOFC Load

After running extract + load, verify:
- VOFC count per module
- Citations are wired to source_registry
- XLSX source registry entry exists

## 3. Verify Triage Module Tagging

Check that triage records module code in scope_tags with structure: `{"tags": {"module": "MODULE_..."}, "triage_rule": "..."}`

## 4. Verify Untraceables Backfill

Check that corpus_documents are linked to source_registry via `file_hash = doc_sha256`

## Next Steps

1. Run extract: `python tools/module_seed/extract_vehicle_ramming_vofcs_from_xlsx.py`
2. Run load: `python tools/module_seed/load_module_vofcs.py tools/module_seed/MODULE_VEHICLE_RAMMING_SAT_vofcs.json`
3. Verify in UI: Navigate to `/admin/modules/MODULE_VEHICLE_RAMMING_SAT` and click "Module VOFCs" tab
4. Run backfill: `npm run corpus:remediate-untraceables` (or `ts-node tools/corpus/remediate_untraceables.ts`)
