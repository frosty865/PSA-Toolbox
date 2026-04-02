# CORPUS Candidates & Target Building Status

## Current Status

### ✅ Completed

1. **Migration Applied**: `ofc_origin` column locked with NOT NULL + CHECK constraint
   - ✅ Column exists and is enforced
   - ✅ All existing data normalized (17 MODULE candidates)
   - ✅ No NULL or invalid values

2. **Target Building**: Candidate targets created for baseline questions
   - ✅ 12 targets created
   - ✅ 3 questions have candidates (all with 4+ candidates)
   - ✅ Targets linked by subtype matching

### ⚠️ Pending

1. **CORPUS Mining**: Need to run mining script to create CORPUS candidates
   - Current: 0 CORPUS candidates
   - Prerequisites met: 2047 chunks, 76 documents ready
   - Action required: Run mining script (requires Python)

2. **Coverage**: Currently only 2.9% coverage (3/104 questions)
   - Need CORPUS candidates to improve coverage
   - Target: 50%+ coverage after mining

## Current Metrics

```
📊 Total targets: 12
📋 Baseline questions: 104
✅ Questions with candidates: 3
📈 Coverage: 2.9%

🎯 Candidates by origin:
   MODULE: 17
   CORPUS: 0

📊 Target distribution:
   Questions with 0 candidates: 101
   Questions with 1-3 candidates: 0
   Questions with 4+ candidates: 3
```

## Next Steps

### Step 1: Run CORPUS Mining

**Option A: Using Python directly**
```bash
cd psa_rebuild
export ALLOW_MINER_APPLY=YES  # Linux/Mac
# OR
$env:ALLOW_MINER_APPLY="YES"  # Windows PowerShell

python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 500
```

**Option B: Manual instructions**
See `docs/CORPUS_MINING_INSTRUCTIONS.md` for detailed steps.

### Step 2: Rebuild Targets

After mining creates CORPUS candidates, rebuild targets:

```bash
npm run targets:baseline
```

### Step 3: Verify Coverage

Check improved coverage:

```bash
node tools/verify_target_coverage.js
```

### Step 4: Test in UI

1. Open an assessment
2. Answer at least one question "NO"
3. Verify candidates panel shows candidates
4. Promote one candidate
5. Verify it disappears from list and appears in OFC display

## Files Created

- ✅ `db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql` - Migration
- ✅ `db/migrations/20260124_0007_verify_ofc_origin.sql` - Verification SQL
- ✅ `tools/verify_ofc_origin_migration.py` - Python verifier
- ✅ `tools/run_ofc_origin_migration.js` - Node.js migration runner
- ✅ `tools/check_corpus_prereqs.js` - Prerequisites checker
- ✅ `tools/verify_target_coverage.js` - Coverage reporter
- ✅ `docs/OFC_ORIGIN_MIGRATION_INSTRUCTIONS.md` - Migration docs
- ✅ `docs/CORPUS_MINING_INSTRUCTIONS.md` - Mining instructions

## System Status

- ✅ Database schema: Locked and enforced
- ✅ API endpoints: Hardened (no dynamic checks)
- ✅ Mining scripts: Updated (force CORPUS origin)
- ✅ Target building: Working (12 targets created)
- ⚠️ CORPUS candidates: Need mining (0 currently)
- ⚠️ Coverage: Low (2.9%, need 50%+)

## Done Criteria Status

- ✅ CORPUS candidates exist: **NO** (0 CORPUS candidates, need mining)
- ✅ ofc_candidate_targets populated: **YES** (12 targets)
- ⚠️ Assessment NO questions show candidates: **PARTIAL** (only 3 questions have candidates)
- ⚠️ Promote works end-to-end: **NEEDS TESTING** (after mining completes)

## Summary

The infrastructure is complete and working:
- Database constraints enforced
- Target building script working
- 12 targets created from MODULE candidates

**Action Required**: Run corpus mining to create CORPUS candidates, then rebuild targets for better coverage.
