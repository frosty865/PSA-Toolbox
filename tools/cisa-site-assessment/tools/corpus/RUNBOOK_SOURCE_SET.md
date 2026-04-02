# CORPUS Source Set Runbook

This runbook provides exact commands for operating the CORPUS system with enforced source_set control.

## Prerequisites

1. CORPUS database migration applied:
   ```sql
   -- Run in CORPUS project SQL Editor
   -- File: migrations/20260113_add_source_set_control.sql
   ```

2. Environment variables set:
   ```bash
   SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
   SUPABASE_CORPUS_DB_PASSWORD="your-password"
   ```

## Commands

### 1. Set Active Source Set

Set the active source set (controls which documents/chunks/candidates are processed):

```bash
# Set to VOFC_LIBRARY (default for XLSX ingestion)
python tools/corpus/set_active_source_set.py VOFC_LIBRARY

# Set to PILOT_DOCS (for pilot PDF documents)
python tools/corpus/set_active_source_set.py PILOT_DOCS
```

**Note:** You can also set `CORPUS_ACTIVE_SOURCE_SET` environment variable (env override wins).

### 2. Check Status

View current source set and data counts:

```bash
python tools/corpus/corpus_status.py
```

Output shows:
- Active source set
- Document count by source_set
- Chunk count by source_set
- Candidate count by source_set

### 3. Ingest VOFC Library XLSX

Ingest `VOFC_Library.xlsx` into CORPUS:

```bash
# Dry run (no DB writes)
python tools/corpus/ingest_vofc_library_xlsx.py --xlsx "tools/ist_ingest/input/VOFC_Library.xlsx" --dry-run

# Actual ingestion
python tools/corpus/ingest_vofc_library_xlsx.py --xlsx "tools/ist_ingest/input/VOFC_Library.xlsx"
```

**Requirements:**
- Active source set must be `VOFC_LIBRARY`
- Creates one document per sheet
- Chunks preserve sheet/row locators
- Idempotent (safe to re-run)

### 4. Run Candidate Discovery

Extract OFC candidates from chunks:

```bash
python tools/mine_ofc_candidates_from_chunks.py --document_id <document_id> --authority_scope "BASELINE_AUTHORITY"
```

**Behavior:**
- Only processes chunks with `source_set = active_source_set`
- Skips chunks with `source_set = 'UNSPECIFIED'` (with warning)
- Tags candidates with active source_set

### 5. Build Matcher Index (BASE=36 Enforced)

Build question matcher index from ALT_SAFE baseline:

```bash
python tools/build_question_matcher_index.py --alt_safe analytics/runtime/alt_safe_model_extracted.json --output analytics/runtime/question_matcher_index.json
```

**Hard Rule:** Index build fails if BASE != 36.

### 6. Run Matching

Match candidates to questions:

```bash
python tools/corpus/match_candidates_to_questions.py --document_id <document_id> --top_k 3 --min_score 0.35
```

**Behavior:**
- Only processes candidates with `source_set = active_source_set`
- Prints active source set in header
- Reports candidate counts inside/outside active set

### 7. Generate Coverage Report

Generate coverage snapshot:

```bash
python tools/generate_pilot_coverage_report.py --document_id <document_id>
```

**Note:** Script name still says "pilot" but works for any source_set.

### 8. Self-Test

Validate source_set configuration:

```bash
python tools/corpus/selftest_source_set.py
```

Checks:
- Active source set is valid
- No UNSPECIFIED documents (when active is VOFC_LIBRARY)
- Documents and chunks exist in active set
- Chunks match their document's source_set

## Complete Workflow Example

```bash
# 1. Set active source set
python tools/corpus/set_active_source_set.py VOFC_LIBRARY

# 2. Check status (should show empty initially)
python tools/corpus/corpus_status.py

# 3. Ingest XLSX
python tools/corpus/ingest_vofc_library_xlsx.py --xlsx "tools/ist_ingest/input/VOFC_Library.xlsx"

# 4. Check status again (should show VOFC_LIBRARY populated)
python tools/corpus/corpus_status.py

# 5. Get document_id from status output, then mine candidates
python tools/mine_ofc_candidates_from_chunks.py --document_id <document_id> --authority_scope "BASELINE_AUTHORITY"

# 6. Build index (if not already built)
python tools/build_question_matcher_index.py

# 7. Run matching
python tools/corpus/match_candidates_to_questions.py --document_id <document_id>

# 8. Generate report
python tools/generate_pilot_coverage_report.py --document_id <document_id>

# 9. Self-test
python tools/corpus/selftest_source_set.py
```

## Hard Rules

1. **No SAFE in source_set:** Any value containing 'SAFE' (case-insensitive) is forbidden.

2. **Active source set required:** All discovery/matching operations require an active source set.

3. **UNSPECIFIED excluded:** Documents/chunks/candidates with `source_set='UNSPECIFIED'` are excluded from processing (with warnings).

4. **No RUNTIME writes:** Discovery/matching tools never write to RUNTIME database.

5. **BASE=36 enforced:** Question matcher index must have exactly 36 BASE questions.

## Troubleshooting

### "Active source set not set"
- Run migration: `migrations/20260113_add_source_set_control.sql`
- Or set manually: `python tools/corpus/set_active_source_set.py VOFC_LIBRARY`

### "No chunks found for this document"
- Check document's source_set matches active source_set
- Verify chunks exist: `SELECT COUNT(*) FROM document_chunks WHERE document_id = '<id>' AND source_set = '<active>'`

### "Invalid source_set value"
- Must be one of: `VOFC_LIBRARY`, `PILOT_DOCS`
- Check: `python tools/corpus/corpus_status.py`

### "BASE != 36" error
- Re-run ALT_SAFE extraction: `python tools/extract_alt_safe_model.py --input <path>`
- Verify extraction produced 36 usable prompts
- Re-build index: `python tools/build_question_matcher_index.py`

### EXPANSION Overlays (Sector/Subsector/Technology) + Dual-Pass Matching

Expansion questions are additive overlays that extend beyond the baseline 36 primary questions. They are explicitly applied via overlay selection and matched separately from baseline questions.

**Workflow:**

1. **Set active source set** (for the documents you're working with):
   ```bash
   python tools/corpus/set_active_source_set.py VOFC_LIBRARY
   ```

2. **(Optional) Import expansion questions** (when you have the file):
   ```bash
   python tools/corpus/import_expansion_questions.py --json path/to/expansion_questions.json
   # OR
   python tools/corpus/import_expansion_questions.py --csv path/to/expansion_questions.csv
   ```
   
   See `docs/EXPANSION_QUESTIONS_FORMAT.md` for file format requirements.

3. **Select overlays** (explicit):
   ```bash
   # Single overlay
   python tools/corpus/set_active_overlays.py --subsector SUBSECTOR_SPORTS_VENUES
   
   # Multiple overlays
   python tools/corpus/set_active_overlays.py --sector SECTOR_COMMERCIAL_FACILITIES --subsector SUBSECTOR_SPORTS_VENUES
   
   # Technology overlay
   python tools/corpus/set_active_overlays.py --technology TECH_CLEAR_BAG_POLICY
   
   # Clear all overlays
   python tools/corpus/set_active_overlays.py --clear
   ```

4. **Build indexes**:
   ```bash
   # BASE index (always required)
   python tools/build_question_matcher_index.py
   
   # EXPANSION index (only if overlays selected)
   python tools/build_expansion_question_matcher_index.py
   ```

5. **Run dual-pass matching**:
   ```bash
   python tools/corpus/dual_pass_match_candidates.py
   ```
   
   This will:
   - Always run PASS A: BASE questions (36 questions)
   - Conditionally run PASS B: EXPANSION questions (if overlays selected and expansion questions exist)

6. **Generate coverage report**:
   ```bash
   python tools/generate_coverage_report.py
   ```
   
   Report includes separate BASE and EXPANSION coverage sections.

**Acceptance Checks:**

- **With no overlays selected:**
  - EXPANSION index builds empty (no error)
  - Matcher runs BASE only; EXPANSION pass is skipped
  - Coverage report shows BASE section only

- **With overlays selected but no expansion questions imported:**
  - EXPANSION index still empty; matcher skips PASS B with clear message

- **With overlays selected and expansion questions imported:**
  - PASS B runs
  - Links are written with `universe='EXPANSION'`
  - Coverage report includes both BASE and EXPANSION sections, separately

### Fixing XLSX Candidate Deduplication

If candidates are being incorrectly deduplicated across different XLSX sheet/row locations, rebuild with locator-aware uniqueness:

**Prerequisites**:
- Migration `db/migrations/corpus/2026_01_13_fix_xlsx_candidate_dedup.sql` must be applied
- Active source set must be `VOFC_LIBRARY`

**Action**:
```bash
python tools/corpus/rebuild_vofc_library_candidates_and_matches.py
```

**What it does**:
1. Confirms active source set is `VOFC_LIBRARY` (hard fails otherwise)
2. Deletes existing VOFC_LIBRARY match links
3. Deletes existing VOFC_LIBRARY candidates
4. Re-runs candidate discovery (with locator-aware uniqueness)
5. Rebuilds question matcher index (BASE=36 enforced)
6. Re-runs candidate matching

**Verification**:
```bash
python tools/corpus/corpus_status.py
# Expected: VOFC_LIBRARY candidates ≈ 242 (allowing small variance for truly empty/invalid rows)
# Expected: locator_type='XLSX' for VOFC_LIBRARY candidates
```

**Note**: This script only operates on `VOFC_LIBRARY` source set. It will not affect other source sets.

