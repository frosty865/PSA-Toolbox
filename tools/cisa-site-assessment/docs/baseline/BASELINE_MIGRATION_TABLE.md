# Baseline Question Migration Table

**Generated:** 2025-12-28  
**Baseline Version:** Baseline_Questions_v1  
**Status:** COMPLETE

## Overview

This document describes the baseline question migration table that maps existing baseline questions to the new baseline gate model.

## New Baseline Gate Model

The new baseline gate model consists of three gates:

1. **CONTROL_EXISTS** - Verifies that a control/system exists
2. **CONTROL_OPERABLE** - Verifies that a control/system is operational
3. **CONTROL_RESILIENCE** - Verifies that a control/system has resilience capabilities

## Gate Mapping Rules

### Global Mapping Rules

| Legacy Dimension | Mapped Gate | Notes |
|-----------------|-------------|-------|
| SYSTEMS | CONTROL_EXISTS | Maps to existence gate |
| MAINTENANCE_ASSURANCE | CONTROL_OPERABLE | Default mapping (may be CONTROL_RESILIENCE based on subtype) |
| PLANS_PROCEDURES | RETIRE | Forbidden dimension (non-observable) |
| PERSONNEL_RESPONSIBILITY | RETIRE | Forbidden dimension (non-observable) |

### Forbidden Dimensions

The following dimensions are **forbidden** and all questions in these dimensions are **RETIRED**:
- **PLANS_PROCEDURES**: Documentation-focused, not observable
- **PERSONNEL_RESPONSIBILITY**: Organizational structure-focused, not observable

## Migration Table Format

The migration table contains the following columns:

- **discipline**: Discipline name
- **subtype**: Subtype name
- **legacy_question_id**: Original question ID (BASE-###)
- **legacy_dimension**: Original capability dimension
- **mapped_gate**: New gate (CONTROL_EXISTS, CONTROL_OPERABLE, CONTROL_RESILIENCE, or NULL if retired)
- **action**: Migration action (KEEP | REWRITE | COLLAPSE | RETIRE)
- **replacement_id**: ID of question this collapses into (nullable)
- **notes**: Concise factual reason for action

## Action Types

### KEEP
Question is valid and observable. Gate is valid and text already meets observability requirements.

**Rare:** Most questions require rewriting due to abstract language.

### REWRITE
Question maps to a valid gate but text violates observability rules. Question must be rewritten to use observable language.

**Common:** Most questions with valid gates need rewriting.

### COLLAPSE
Multiple legacy questions map to the same gate for a subtype. All questions collapse into the lowest BASE-### ID.

**Process:**
1. Identify all questions for a subtype that map to the same gate
2. Find the question with the lowest BASE-### ID
3. Mark that question as primary (action may be KEEP or REWRITE)
4. Mark other questions as COLLAPSE with replacement_id pointing to primary

### RETIRE
Question is in a forbidden dimension or maps to RETIRE. Question is removed from baseline.

**Applied to:**
- All PLANS_PROCEDURES questions
- All PERSONNEL_RESPONSIBILITY questions

## Migration Summary

### Total Questions Processed: 416

### By Action

| Action | Count | Percentage |
|--------|-------|------------|
| RETIRE | 208 | 50% |
| REWRITE | 208 | 50% |
| KEEP | 0 | 0% |
| COLLAPSE | 0 | 0% |

### By Gate

| Gate | Count |
|------|-------|
| CONTROL_EXISTS | 104 |
| CONTROL_OPERABLE | 97 |
| CONTROL_RESILIENCE | 7 |

### Breakdown

- **SYSTEMS dimension (104 questions)**: All map to CONTROL_EXISTS, all require REWRITE (abstract "capabilities" language)
- **MAINTENANCE_ASSURANCE dimension (104 questions)**: 
  - 97 map to CONTROL_OPERABLE (standard operational maintenance)
  - 7 map to CONTROL_RESILIENCE (resilience-eligible subtypes with centralized dependency or single-point failure risk)
  - All require REWRITE (assurance language)
- **PLANS_PROCEDURES dimension (104 questions)**: All RETIRED (forbidden dimension)
- **PERSONNEL_RESPONSIBILITY dimension (104 questions)**: All RETIRED (forbidden dimension)

### Resilience-Eligible Subtypes (7 questions mapped to CONTROL_RESILIENCE)

- **Video Surveillance Systems:**
  - Recording / Storage (NVR/DVR): 1 question
  - System Architecture: 1 question
- **Access Control Systems:**
  - Electronic Access Control (controllers/panels): 1 question
- **Intrusion Detection Systems:**
  - Alarm Panels: 1 question
- **Other (centralized dependency/single-point failure risk):**
  - Backup Communications: 1 question
  - Redundancy / Backup Systems: 1 question
  - Sensitive Item Storage: 1 question

## Verification

✅ **Verification Passed**

All checks passed:
- Every remaining baseline question maps to exactly one gate
- No baseline question maps to a forbidden dimension
- All replacement_ids reference valid question IDs

## Output Files

1. **CSV:** `analytics/reports/baseline_migration_table.csv`
   - Machine-readable migration table
   - Suitable for import into spreadsheets or databases

2. **JSON:** `analytics/reports/baseline_migration_table.json`
   - Machine-readable migration table with metadata
   - Includes summary statistics and verification results

3. **Summary:** `analytics/reports/baseline_migration_summary.md`
   - Human-readable summary report
   - Includes counts and verification status

## Constraints Enforced

✅ **NO new questions** - Only existing questions are mapped  
✅ **NO new IDs** - All IDs preserved from original baseline  
✅ **NO framework language** - Retired questions contain framework language  
✅ **NO manual edits** - All actions determined by rules  
✅ **NO inference** - Only defined rules applied

## Next Steps

1. **Review Migration Table:**
   - Examine `baseline_migration_table.csv` for detailed mappings
   - Verify gate assignments are correct

2. **Rewrite Questions:**
   - For REWRITE actions, transform abstract language to observable conditions
   - Preserve question IDs during rewrite

3. **Handle Collapsing:**
   - If multiple questions collapse, ensure lowest ID is preserved
   - Update any references to collapsed questions

4. **Retire Questions:**
   - Remove RETIRED questions from baseline
   - Document retirement in baseline version history

## Related Documentation

- `docs/baseline/BASELINE_VALIDITY_RULES.md` - Baseline validity rules
- `analytics/reports/baseline_validity_violations.md` - Validity violations report
- `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md` - Integrity audit summary

