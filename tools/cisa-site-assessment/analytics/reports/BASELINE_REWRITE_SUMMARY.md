# Baseline Question Rewrite Summary

**Date:** 2025-12-28  
**Status:** COMPLETE ✅

## Overview

Baseline question text has been rewritten to match the gate model intent:
- **CONTROL_EXISTS**: Ask if control is present/installed
- **CONTROL_OPERABLE**: Ask if control functions at basic observable level
- **CONTROL_RESILIENCE**: Ask if a single obvious failure disables the control

## Process Summary

### Inputs
- Migration table: `analytics/reports/baseline_migration_table.csv`
- Baseline questions: `analytics/runtime/baseline_questions_registry.json`
- Baseline validity ruleset

### Processing
- **Total Questions Processed:** 416
- **Rewritten:** 208 questions
- **Retired:** 208 questions (preserved with original text)
- **Kept:** 0 questions

### Rewrite Rules Applied

1. **CONTROL_EXISTS Gate:**
   - Ask only whether the control is present/installed
   - Use concrete installation/presence language
   - Example: "Are biometric access systems installed at controlled entry points?"

2. **CONTROL_OPERABLE Gate:**
   - Ask only whether the control functions at a basic observable level
   - Use concrete operational language
   - Example: "Are biometric access systems operational and functioning?"

3. **CONTROL_RESILIENCE Gate:**
   - Ask only whether a single obvious failure disables the control
   - Use concrete resilience language
   - Example: "Are recording storage systems configured with redundancy or backup to prevent single-point failure?"

### Constraints Maintained

✅ **DO NOT change question_id** - All IDs preserved  
✅ **DO NOT add qualifiers, examples, or guidance text** - Questions remain concise  
✅ **DO NOT reference policies, plans, or personnel** - Only observable conditions  
✅ **DO NOT normalize or merge questions** - Each question rewritten independently  
✅ **DO NOT change gate assignments** - Gate mappings from migration table preserved

## Validation Results

### ✅ All Rewritten Questions Pass Validation

- **Validation Errors:** 0
- **Validation Warnings:** 5 (non-blocking)

All rewritten questions:
- Use concrete, observable language
- Avoid abstract terms (capabilities, processes, procedures, roles, ensured, managed)
- Maintain YES / NO / N_A response model
- Can be answered during a site visit

### Abstract Terms Removed

The rewrite process removed or replaced:
- "capabilities" → "systems" or "components"
- "processes" → removed (not observable)
- "procedures" → removed (not observable)
- "governance" → "security oversight systems" (for observable aspects)
- "ensured" → removed (not observable)
- "managed" → removed (not observable)

## Outputs

### 1. Updated Baseline Question Set
**File:** `analytics/runtime/baseline_questions_registry_rewritten.json`

- Contains all 416 questions with rewritten text
- Retired questions preserved with original text
- Metadata includes rewrite timestamp and version

### 2. Rewrite Log
**Files:**
- `analytics/reports/baseline_rewrite_log.json` (machine-readable)
- `analytics/reports/baseline_rewrite_log.md` (human-readable)

Contains:
- Question ID
- Mapped gate
- Action (REWRITE/RETIRE)
- Old text
- New text
- Rewrite reason

### 3. Validation Report
**File:** `analytics/reports/baseline_rewrite_validation.json`

Contains:
- Summary statistics
- Validation errors (0 found)
- Validation warnings (5 found, non-blocking)

## Gate Distribution

| Gate | Count | Source |
|------|-------|--------|
| CONTROL_EXISTS | 104 | SYSTEMS dimension |
| CONTROL_OPERABLE | 97 | MAINTENANCE_ASSURANCE (standard) |
| CONTROL_RESILIENCE | 7 | MAINTENANCE_ASSURANCE (resilience-eligible) |
| **Total Active** | **208** | |
| RETIRED | 208 | PLANS_PROCEDURES, PERSONNEL_RESPONSIBILITY |

## Example Rewrites

### CONTROL_EXISTS
- **Old:** "Does the facility have biometric access capabilities?"
- **New:** "Are biometric access systems installed at controlled entry points?"

### CONTROL_OPERABLE
- **Old:** "Are processes in place to ensure biometric access capabilities are maintained?"
- **New:** "Are biometric access systems operational and functioning?"

### CONTROL_RESILIENCE
- **Old:** "Are processes in place to ensure electronic access control capabilities are maintained?"
- **New:** "Are electronic access control systems configured with redundancy to prevent single-point failure?"

## Next Steps

The rewritten baseline question set is ready for:
1. Review and approval
2. Integration into baseline question registry
3. Use in field assessments

## Related Documentation

- `docs/baseline/BASELINE_MIGRATION_TABLE.md` - Migration table documentation
- `analytics/reports/baseline_migration_table.csv` - Migration table
- `analytics/reports/baseline_rewrite_log.json` - Detailed rewrite log
- `analytics/reports/baseline_rewrite_validation.json` - Validation results

