# Baseline Refactor Runbook

This runbook guides the process of refactoring legacy baseline questions into boundary-based control assertions.

## Prerequisites

1. Legacy baseline questions JSON file (e.g., `analytics/runtime/baseline_questions_registry_v2.json`)
2. Python 3.8+ with standard library (no external dependencies)
3. Access to `psa_engine/tools/analyze_legacy_baseline_for_refactor.py`

## Step 1: Run Analyzer

Run the analyzer tool to generate classification reports:

```bash
python psa_engine/tools/analyze_legacy_baseline_for_refactor.py \
  --input_json analytics/runtime/baseline_questions_registry_v2.json \
  --out_dir analytics/reports
```

**Expected Output:**
- `legacy_baseline_refactor_map.json` - Complete classification map
- `legacy_baseline_drop_list.json` - Questions to drop
- `legacy_baseline_move_to_smg.json` - Questions to move to SMG
- `legacy_baseline_move_to_component.json` - Questions to move to component checklists
- `legacy_baseline_move_to_expansion.json` - Questions to move to expansion layer
- `legacy_baseline_rewrite_candidates.json` - Questions that can be rewritten

## Step 2: Review Outputs

### Priority 1: Review DROP List
Start with `legacy_baseline_drop_list.json`:
- Verify questions cannot be rewritten without subjective judgment
- Confirm solution artifacts cannot be removed cleanly
- Document any edge cases

### Priority 2: Review MOVE_TO_SMG
Review `legacy_baseline_move_to_smg.json`:
- Confirm these are governance/process questions
- Verify they're not subtype-specific
- Plan integration into SMG discipline

### Priority 3: Review MOVE_TO_EXPANSION
Review `legacy_baseline_move_to_expansion.json`:
- Verify sector/subsector context is required
- Plan migration to expansion layer

### Priority 4: Review REWRITE Candidates
Review `legacy_baseline_rewrite_candidates.json`:
- Check proposed rewrites for accuracy
- Manually curate rewrites that need refinement
- Verify boundary anchors are present
- Ensure control behavior is explicit

## Step 3: Author Baseline Canon v1.0.1 Spines

Using the rewrite candidates and proposed rewrites:

1. **Open discipline files** in `psa_engine/doctrine/baseline_canon/disciplines/`
2. **For each REWRITE candidate:**
   - Review proposed rewrite
   - Refine if needed (ensure boundary anchor + control behavior)
   - Add to appropriate discipline file
   - Assign sequential `canon_id` (e.g., `ACS-1`, `ACS-2`, etc.)
   - Set `response_enum: ["YES", "NO", "N_A"]`
   - Set `discipline_code` and `subtype_code`

3. **Follow canonical discipline order:**
   - PER, ACS, IDS, VSS, INT, FAC, KEY, COM, EAP, EMR, ISC, SFO, SMG, CPTED

4. **Validate:**
   ```bash
   python psa_engine/tools/validate_baseline_canon_spines.py
   ```

## Step 4: Rebuild Baseline Spines

After authoring discipline files:

```bash
python psa_engine/tools/build_baseline_spines_v1.py
```

This generates `psa_engine/doctrine/baseline_canon/baseline_spines.v1.json`

## Step 5: Import to RUNTIME

Use the existing guarded import tool:

```bash
# Preflight check
python tools/preflight_db.py --target runtime --show

# Dry-run import
python tools/import_baseline_canon.py --target runtime --dry-run --print-mapping

# Review plan
cat analytics/reports/baseline_canon_import_plan.json

# Lock mapping (after reviewing)
python tools/import_baseline_canon.py --target runtime --lock --print-mapping

# Apply import
python tools/import_baseline_canon.py --target runtime --apply --i-understand-this-writes
```

## Step 6: Verify New Assessments

Verify that new assessments select canon-only:

```bash
python tools/verify_runtime_baseline_selection.py --target runtime
```

**Expected:**
- `legacy_BASE_count = 0`
- `canon_count > 0`
- `verify_pass = true`

## Step 7: Handle Moved Questions

### MOVE_TO_SMG
- Integrate into SMG discipline spines
- Ensure not duplicated per-subtype

### MOVE_TO_COMPONENT_CHECKLIST
- Add to component checklist structure (future work)
- Not part of baseline canon

### MOVE_TO_EXPANSION
- Migrate to expansion layer (future work)
- Not part of baseline canon

### DROP
- Document in migration notes
- Do not include in baseline canon

## Troubleshooting

### Analyzer fails to load input
- Check JSON structure matches expected patterns
- Verify file path is correct
- Check file encoding (must be UTF-8)

### Proposed rewrites are inaccurate
- Review rewrite templates in analyzer script
- Add new templates for missing subtypes
- Manually curate rewrites as needed

### Import fails
- Verify preflight check passes
- Check mapping lock file exists
- Review schema drift if detected

## Notes

- The analyzer is deterministic: same input = same output
- Manual curation is required for rewrite candidates
- Not all questions can be rewritten; some must be dropped
- Sector/subsector questions belong in expansion, not baseline
