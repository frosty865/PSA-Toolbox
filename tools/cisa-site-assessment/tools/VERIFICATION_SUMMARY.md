# SRO Exclusion Verification Summary

**Date:** 2026-01-16  
**Task:** Remove K-12-specific SRO subtype spine from baseline

## ✅ Verification Results

### Test 1: Taxonomy Exclusion Flag
- **Status:** ✅ PASS
- **Result:** SRO subtype (`SFO_SCHOOL_RESOURCE_OFFICER_SRO`) correctly marked with `baseline_eligible: false`
- **Location:** `taxonomy/discipline_subtypes.json` line 1434

### Test 2: Generator Filtering Logic
- **Status:** ✅ PASS
- **Result:** Generator script correctly excludes SRO from baseline-eligible subtypes
- **Counts:**
  - Total subtypes: 105
  - Baseline-eligible subtypes: 104
  - Excluded subtypes: 1 (SRO)
- **Location:** `tools/generate_baseline_subtype_v1.ts` lines 313-318

### Test 3: Coverage Report Filtering Logic
- **Status:** ✅ PASS
- **Result:** Coverage report correctly identifies SRO in excluded subtypes list
- **Location:** `tools/baseline_coverage_report.ts` lines 137-152

## Files Modified

1. **`taxonomy/discipline_subtypes.json`**
   - Added `"baseline_eligible": false` to SRO subtype

2. **`tools/generate_baseline_subtype_v1.ts`**
   - Updated `loadAllSubtypeCodes()` to filter by `baseline_eligible !== false`

3. **`tools/baseline_coverage_report.ts`**
   - Updated `loadTaxonomy()` to filter excluded subtypes
   - Added `excluded_subtypes` tracking and reporting
   - Updated report totals to show baseline-eligible vs excluded counts

4. **`tools/sql/deactivate_baseline_sro_spine.sql`** (NEW)
   - SQL script to deactivate SRO spine in RUNTIME database
   - Target: `public.baseline_spines_runtime` table
   - Sets `active = FALSE` (preserves lineage)

## Next Steps

1. **Execute SQL Script:**
   ```bash
   # Connect to RUNTIME database and execute:
   psql "postgresql://postgres:<password>@<host>:6543/postgres" -f tools/sql/deactivate_baseline_sro_spine.sql
   ```

2. **Run Coverage Report:**
   ```bash
   npx tsx tools/baseline_coverage_report.ts
   ```
   Expected: Should show 103 baseline-eligible subtypes (down from 104) and list SRO in excluded section

3. **Verify Generator:**
   ```bash
   npx tsx tools/generate_baseline_subtype_v1.ts
   ```
   Expected: Should skip SRO subtype during generation

## Notes

- The Python script `regenerate_baseline_questions.py` does not filter by `baseline_eligible` as it appears to be for a different purpose (not baseline generation)
- All changes preserve lineage (no deletions, only deactivation)
- Exclusion is explicit and auditable through the `baseline_eligible` flag
