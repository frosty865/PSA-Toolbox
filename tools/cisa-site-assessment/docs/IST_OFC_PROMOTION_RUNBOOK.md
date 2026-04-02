# IST OFC Promotion Runbook

## Prerequisites

- CORPUS database access
- RUNTIME database access
- `ALLOW_MINER_APPLY=YES` environment variable set for mining

## Execution Order

### PHASE 1: Apply Schema Migration (MANUAL - SQL)

**File**: `migrations/20260202_add_source_registry_id_to_ofc_candidates.sql`

**Action**: Run this SQL in CORPUS database (Supabase SQL Editor recommended):

```sql
ALTER TABLE public.ofc_candidate_queue
ADD COLUMN IF NOT EXISTS source_registry_id UUID;

CREATE INDEX IF NOT EXISTS idx_ofc_candidate_queue_source_registry_id 
  ON public.ofc_candidate_queue(source_registry_id)
  WHERE source_registry_id IS NOT NULL;
```

**Verify**: 
```bash
python tools/corpus/discover_linking_schema.py
# Check analytics/reports/ofc_link_schema_discovery.json includes source_registry_id_col
```

---

### PHASE 2: Backfill IST OFCs (AUTOMATED)

**Script**: `tools/corpus/backfill_ist_source_registry_id.py`

**Dry Run**:
```bash
python tools/corpus/backfill_ist_source_registry_id.py
```

**Apply**:
```bash
python tools/corpus/backfill_ist_source_registry_id.py --apply
```

**Verify**:
- IST OFCs now have `source_registry_id` populated
- MINED OFCs remain NULL for `source_registry_id`

---

### PHASE 3: Verify Source Registry Status (AUTOMATED)

**Script**: `tools/corpus/verify_source_registry_status.py`

**Run**:
```bash
python tools/corpus/verify_source_registry_status.py
```

**Expected**: All IST OFC source_registry entries exist (and are ACTIVE if status column exists)

---

### PHASE 4: Refresh Schema Discovery (AUTOMATED)

**Run**:
```bash
python tools/corpus/discover_linking_schema.py
```

**Verify** `analytics/reports/ofc_link_schema_discovery.json` shows:
- `ofc_candidate_queue` includes:
  - `source_id_col`
  - `source_registry_id_col` ✅
  - `submitted_by_col` ✅
- `source_registry` table detected
- `link_table = public.ofc_question_links`

---

### PHASE 5: Mine OFCs from Source Documents (AUTOMATED)

**Prerequisite**: `ALLOW_MINER_APPLY=YES` must be set

**Run**:
```bash
# PowerShell
$env:ALLOW_MINER_APPLY='YES'
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --source-set BASELINE_DOCS --apply

# Or if BASELINE_DOCS doesn't exist:
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --max-chunks 5000 --apply
```

**Verify** `analytics/reports/ofc_mining_v3_report.json`:
- `candidates_inserted > 0`
- `rejected_counts_by_reason` includes expected junk categories
- MINED OFCs have `document_chunk_id` citations
- IST OFCs remain separate (no chunk citations)

---

### PHASE 6: Optional Subtype Enrichment (AUTOMATED)

**Dry Run**:
```bash
python tools/corpus/enrich_ofc_subtypes_by_consensus.py --min-support 5 --consensus 0.70
```

**Review** `analytics/reports/ofc_subtype_consensus_report.json`

**Apply** (if acceptable):
```bash
python tools/corpus/enrich_ofc_subtypes_by_consensus.py --min-support 5 --consensus 0.70 --apply
```

---

### PHASE 7: Calibrate Linker (AUTOMATED)

**Run**:
```bash
python tools/corpus/link_ofcs_to_questions_v1.py --calibrate
```

**Verify** `analytics/reports/ofc_link_calibration.json`:
- `eligible_pairs_count > 0` (includes both chunk-cited MINED and external-verified IST)
- `suggested_thresholds` present
- Health check shows both citation-bound and external-verified OFCs

**Select threshold**: Use `balanced` (P90) or `conservative` (P95)

---

### PHASE 8: Link & Promote (AUTOMATED)

**Preview**:
```bash
python tools/corpus/link_ofcs_to_questions_v1.py --topn 10 --promote-threshold <CALIBRATED_VALUE>
```

**Verify** `analytics/reports/ofc_link_coverage.json`:
- IST OFCs appear in `promoted` results ✅
- `link_explanation` shows:
  - `eligibility_reason = "IST_EXTERNAL_VERIFIED"` for IST OFCs ✅
  - `eligibility_reason = "CHUNK_CITED"` for MINED OFCs ✅
- No blanket promotion (subtype match enforced)
- Max 3 promoted per question

**Apply**:
```bash
python tools/corpus/link_ofcs_to_questions_v1.py --topn 10 --promote-threshold <CALIBRATED_VALUE> --apply
```

**Verify** `public.ofc_question_links`:
- `link_method = "IST_VERIFIED_LINK_V1"` for IST OFCs ✅
- `link_method = "LEXICAL_HYBRID_V1"` for MINED OFCs ✅
- `link_explanation` JSON includes `external_verified` and `eligibility_reason` ✅

---

## Acceptance Criteria Checklist

- [ ] `ofc_candidate_queue` has `source_registry_id` column
- [ ] IST OFCs have `source_registry_id` populated deterministically
- [ ] MINED OFCs have `source_registry_id = NULL`
- [ ] Source documents produce verbatim OFC candidates with chunk citations
- [ ] Junk statements never enter review queue
- [ ] IST OFCs promote without chunk citations via external verification
- [ ] MINED OFCs promote only with chunk citations
- [ ] All promotions subtype-matched and threshold-gated
- [ ] `public.ofc_question_links` populated with correct `link_method` and auditable explanations

---

## Troubleshooting

### Migration fails
- Check CORPUS database connection
- Verify table `ofc_candidate_queue` exists
- Check for existing `source_registry_id` column

### Backfill finds 0 eligible IST OFCs
- Verify `submitted_by = 'IST_IMPORT'` rows exist
- Check `canonical_sources.source_key` is populated
- Verify `source_registry` entries exist for those `source_key` values

### Calibration shows 0 eligible pairs
- Ensure both MINED (with `document_chunk_id`) and IST (with `source_registry_id`) OFCs exist
- Check subtype assignments (`discipline_subtype_id`) on both questions and OFCs
- Run subtype enrichment if needed

### IST OFCs don't promote
- Verify `source_registry_id` is populated
- Check `source_registry` entries exist (and are ACTIVE if status column exists)
- Verify subtype match between IST OFCs and questions
- Check similarity threshold is not too high
