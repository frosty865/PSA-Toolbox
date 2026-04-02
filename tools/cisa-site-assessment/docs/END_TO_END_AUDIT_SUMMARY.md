# End-to-End Audit Summary

## Date: 2026-01-24

## Step 1: CORPUS Data Sanity ✅

### Results:
- **Documents**: 76 corpus_documents exist ✅
- **Chunks**: 2,047 document_chunks exist ✅
- **Source Linkage**: Chunks link via `corpus_documents -> source_registry`, but `canonical_sources` linkage is missing
  - ⚠️ Mining will create "UNKNOWN" sources for chunks without canonical_sources linkage
  - This is expected behavior - mining script handles missing source_id

### Chunk Distribution:
- **UNKNOWN**: 2,047 chunks (no source_kind classification available via canonical_sources)
- **Note**: Chunks link to `corpus_documents`, which link to `source_registry`, but `source_registry` doesn't link to `canonical_sources` via `source_key` matching

## Step 2: Mining Status ⚠️

### Current State:
- **CORPUS candidates**: 17 exist
- **MODULE candidates**: 0 (or not counted separately)
- **Issue**: All 17 CORPUS candidates are from MODULE_RESEARCH sources
  - This suggests they were mined before the guardrail was implemented
  - Or mined with `--allow-module-research` flag

### Action Required:
Run mining script to create CORPUS candidates from CORPUS sources:

```bash
# Set environment variable (PowerShell)
$env:ALLOW_MINER_APPLY="YES"

# Run mining (blocks MODULE_RESEARCH by default)
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 500

# Verify results
node tools/verify_mining_results.js
```

**Expected**: New CORPUS candidates created from CORPUS source_kind sources, MODULE_RESEARCH sources blocked by default.

## Step 3: Baseline Targets ✅

### Results:
- **Total targets**: 12 created
- **Max per question**: 4 ✅ (constraint satisfied)
- **Questions with candidates**: 3 out of 130 baseline questions
- **Coverage**: 2.31% ⚠️ (low, but expected with only 17 candidates)

### Target Distribution:
- Questions with 0 candidates: 127
- Questions with 1-3 candidates: 0
- Questions with 4+ candidates: 3

### Action Required:
After mining creates more CORPUS candidates from CORPUS sources, rebuild targets:

```bash
npm run targets:baseline
node tools/verify_target_coverage.js
```

**Expected**: Coverage should improve significantly after mining CORPUS sources.

## Step 4: UI Validation ⏳

### Status: Pending

**To Test**:
1. Open an assessment
2. Answer a baseline question "NO"
3. Verify `OfcCandidatesPanel` appears and lists candidates
4. Click "Promote" on one candidate
5. Verify:
   - Candidate disappears from list (optimistic UI)
   - OFC appears in `OfcDisplay`
   - Diagnostics show correct `ofc_origin='CORPUS'`

### Diagnostic Endpoints:
- `GET /api/admin/diagnostics/corpus/candidate/<candidateId>` - Shows candidate details
- `GET /api/admin/diagnostics/runtime/nominations/by-response/<responseId>` - Shows nomination links

## Summary

### ✅ Completed:
1. CORPUS data verified (76 docs, 2,047 chunks)
2. Baseline targets built (12 targets, max 4 per question)
3. Verification scripts created

### ⚠️ Pending:
1. **Mine CORPUS candidates from CORPUS sources** (Python script - requires Python environment)
   - Current candidates are from MODULE_RESEARCH sources
   - Need to mine from CORPUS source_kind sources
2. **Rebuild targets after mining** (will improve coverage)
3. **UI validation** (test assessment NO questions show candidates)

### 📊 Current Metrics:
- CORPUS candidates: 17 (all from MODULE_RESEARCH - need CORPUS sources)
- Baseline targets: 12
- Coverage: 2.31% (3/130 questions)
- Max per question: 4 ✅

### 🔧 Tools Created:
- `tools/corpus_sanity_audit.js` - CORPUS data verification
- `tools/verify_mining_results.js` - Mining results verification
- `tools/verify_target_coverage.js` - Target coverage verification
- `tools/check_chunk_source_linkage.js` - Source linkage debugging

## Next Steps

1. **Run Mining** (requires Python):
   ```bash
   $env:ALLOW_MINER_APPLY="YES"
   python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 500
   ```

2. **Verify Mining**:
   ```bash
   node tools/verify_mining_results.js
   ```
   - Should show CORPUS candidates from CORPUS sources (not MODULE_RESEARCH)

3. **Rebuild Targets**:
   ```bash
   npm run targets:baseline
   node tools/verify_target_coverage.js
   ```
   - Should show improved coverage

4. **Test UI**:
   - Open assessment
   - Answer NO to baseline question
   - Verify candidates appear
   - Promote candidate
   - Verify nomination link

## Notes

- **Source Linkage**: Chunks link to `corpus_documents`, which link to `source_registry`, but `canonical_sources` linkage via `source_key` is missing. Mining script handles this by creating "UNKNOWN" sources when needed.
- **Guardrail**: The `source_kind` guardrail is implemented and will block MODULE_RESEARCH sources by default. Current 17 candidates were likely mined before guardrail or with `--allow-module-research`.
- **Coverage**: Low coverage (2.31%) is expected with only 17 candidates. After mining CORPUS sources, coverage should improve significantly.
