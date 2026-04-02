# Baseline Question Integrity Review - Complete Documentation

**Date:** 2025-12-27  
**Baseline Version:** Baseline_Questions_v1  
**Status:** FROZEN (versioned_only)

## Overview

This document provides complete documentation for the baseline question integrity review and correction system. The review identified systemic issues with baseline question formulation that violate observability criteria.

## Phase 1: Audit - COMPLETE ✅

### Audit Tool

**File:** `tools/audit_baseline_integrity.py`

**Purpose:** Scans all baseline questions and flags violations of baseline observability criteria.

**Violation Criteria:**
- Uses abstract terms (capabilities, processes, program, governance)
- Can be answered YES without observing a physical condition
- Focuses on documentation, roles, or assurance instead of system behavior
- Would yield YES at a facility with weak or fragile security architecture

**Usage:**
```bash
python tools/audit_baseline_integrity.py
```

**Output:**
- `analytics/reports/baseline_integrity_audit.json` - Machine-readable violation data
- `analytics/reports/baseline_integrity_audit.md` - Human-readable detailed report

### Audit Results

**Total Questions:** 416  
**Violations Found:** 416 (100% violation rate)

**Breakdown by Recommended Handling:**
- **REWRITE:** 104 questions (SYSTEMS dimension - abstract "capabilities" language)
- **DEMOTE:** 208 questions (PLANS_PROCEDURES + PERSONNEL_RESPONSIBILITY - inherently non-observable)
- **COLLAPSE:** 104 questions (MAINTENANCE_ASSURANCE - process-based, not observable)

**Breakdown by Capability Dimension:**
- **SYSTEMS:** 104 violations (abstract "capabilities" language)
- **PLANS_PROCEDURES:** 104 violations (documentation-focused)
- **MAINTENANCE_ASSURANCE:** 104 violations (process-focused)
- **PERSONNEL_RESPONSIBILITY:** 104 violations (organizational structure-focused)

## Phase 2: Correction - PENDING

### Recommended Actions

#### 1. Rewrite SYSTEMS Dimension Questions (104 questions)

**Issue:** Questions use abstract "capabilities" language instead of asking about physical systems.

**Example Transformation:**
- **Before:** "Does the facility have biometric access capabilities?"
- **After:** "Are biometric access readers installed at controlled entry points?"

**Guidelines:**
- Remove "capabilities" language
- Ask about specific physical components
- Use observable verbs: "installed", "operational", "present", "configured"
- Focus on what can be seen/inspected, not abstract capability

#### 2. Remove or Demote Non-Observable Dimensions (312 questions)

**PLANS_PROCEDURES (104 questions):**
- **Issue:** Questions focus on documentation, not observable conditions
- **Recommendation:** Remove from baseline or move to sector/subsector overlays
- **Rationale:** Documentation cannot be verified through on-site observation alone

**PERSONNEL_RESPONSIBILITY (104 questions):**
- **Issue:** Questions focus on roles/organizational structure, not physical systems
- **Recommendation:** Remove from baseline or move to sector/subsector overlays
- **Rationale:** Organizational structure cannot be verified through physical inspection

**MAINTENANCE_ASSURANCE (104 questions):**
- **Issue:** Questions focus on processes/assurance, not physical state
- **Recommendation:** Collapse into reduced set of observable maintenance indicators
- **Alternative:** Focus on physical evidence: "Are maintenance logs visible?", "Are systems operational?"

### Correction Workflow

1. **Review Detailed Violations:** `analytics/reports/baseline_integrity_audit.md`
2. **Prioritize by Impact:** Start with SYSTEMS dimension (most fixable)
3. **Rewrite Questions:** Transform abstract language to observable conditions
4. **Validate Corrections:** Run audit again to verify fixes
5. **Decide on Non-Observable Dimensions:** Remove, demote, or collapse

## Phase 3: Enforcement - COMPLETE ✅

### Validation Ruleset

**File:** `tools/validate_baseline_observability.py`

**Purpose:** Enforcement guards to prevent non-observable questions from entering baseline.

**Validation Checks:**
1. **Abstract Term Detection:** Flags "capabilities", "processes", "program", "governance"
2. **Policy/Procedure Detection:** Flags documentation-focused questions
3. **Role/Responsibility Detection:** Flags organizational structure questions
4. **Non-Observable Pattern Detection:** Flags questions answerable without physical inspection
5. **Framework Language Detection:** Flags compliance/governance terminology

**Usage:**
```python
from validate_baseline_observability import validate_question_for_baseline, guard_baseline_question

# Validate a question
is_valid, violations = validate_question_for_baseline(question_dict)

# Guard function (raises exception on violation)
guard_baseline_question(question_dict)
```

### Integration Points

**✅ Integrated:**
- `tools/regenerate_baseline_questions.py` - Question generation now includes observability validation

**⏳ Pending Integration:**
- LLM-generated candidate review (future)
- Manual authoring workflow (future)

### Validation in Question Generation

The `regenerate_baseline_questions.py` script now automatically validates observability:

```python
# In validate_questions() function:
if observability_validation_available:
    for question in questions:
        is_valid, violations = validate_question_for_baseline(question)
        if not is_valid:
            # Add violations to errors list
            errors.append(f"Question {question_id} observability violation: {violation}")
```

**Behavior:**
- Validation is optional (doesn't fail if module not found)
- If available, all questions are checked for observability violations
- Violations are added to error list, causing generation to fail

## Systemic Issues Identified

### Issue 1: Capability Dimensions Are Not Baseline-Appropriate

The current 4-dimension model includes 3 dimensions that are inherently non-observable:

- ✅ **SYSTEMS:** Can be observable if rephrased (remove "capabilities")
- ❌ **PLANS_PROCEDURES:** Inherently non-observable (documentation-based)
- ❌ **MAINTENANCE_ASSURANCE:** Inherently non-observable (process-based)
- ❌ **PERSONNEL_RESPONSIBILITY:** Inherently non-observable (organizational structure)

**Recommendation:** Consider reducing to SYSTEMS-only baseline, or collapsing non-observable dimensions into minimal observable indicators.

### Issue 2: Question Templates Use Abstract Language

The deterministic generation method produces questions with abstract terms:
- "capabilities" instead of "systems/components installed"
- "processes in place" instead of "observable evidence"
- "roles defined" instead of "personnel present/assigned"

**Recommendation:** Update question templates in `regenerate_baseline_questions.py` to use observable language.

### Issue 3: No Observability Validation (RESOLVED)

**Previous State:** Validation only checked for placeholders, subtype codes, response enums.

**Current State:** Observability validation integrated into generation workflow.

## Files Created/Modified

### Created Files

1. **`tools/audit_baseline_integrity.py`**
   - Phase 1 audit tool
   - Scans all questions and flags violations
   - Generates machine-readable and human-readable reports

2. **`tools/validate_baseline_observability.py`**
   - Phase 3 enforcement ruleset
   - Validation functions for observability
   - Guard functions for question generation

3. **`analytics/reports/baseline_integrity_audit.json`**
   - Machine-readable violation data
   - Structured JSON format for programmatic processing

4. **`analytics/reports/baseline_integrity_audit.md`**
   - Human-readable detailed report
   - Violations grouped by recommended handling

5. **`analytics/reports/BASELINE_INTEGRITY_SUMMARY.md`**
   - Executive summary of audit findings
   - High-level recommendations

6. **`docs/baseline/BASELINE_INTEGRITY_REVIEW.md`**
   - This document - complete documentation

### Modified Files

1. **`tools/regenerate_baseline_questions.py`**
   - Added observability validation to `validate_questions()` function
   - Integrated `validate_baseline_observability` module
   - Questions now fail generation if they violate observability criteria

## Next Steps

### Immediate (Phase 2)

1. **Review Detailed Violations**
   - Read `analytics/reports/baseline_integrity_audit.md`
   - Understand scope of violations

2. **Prioritize Corrections**
   - Start with SYSTEMS dimension (104 questions - most fixable)
   - Decide on handling of non-observable dimensions (312 questions)

3. **Rewrite SYSTEMS Questions**
   - Transform "capabilities" language to observable conditions
   - Test with audit tool to verify fixes

### Short-Term

4. **Update Question Templates**
   - Modify `regenerate_baseline_questions.py` templates
   - Remove abstract language from generation logic

5. **Decide on Non-Observable Dimensions**
   - Remove PLANS_PROCEDURES, MAINTENANCE_ASSURANCE, PERSONNEL_RESPONSIBILITY?
   - Move to sector/subsector overlays?
   - Collapse into minimal observable indicators?

### Long-Term

6. **Integrate into LLM Review**
   - Add observability validation to LLM-generated candidate review
   - Prevent non-observable questions from entering pipeline

7. **Integrate into Manual Authoring**
   - Add observability validation to manual authoring workflow
   - Provide real-time feedback to authors

## Validation Commands

```bash
# Run integrity audit
python tools/audit_baseline_integrity.py

# Validate individual question (example)
python tools/validate_baseline_observability.py

# Regenerate baseline questions (with observability validation)
python tools/regenerate_baseline_questions.py
```

## Related Documentation

- `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md` - Executive summary
- `analytics/reports/baseline_integrity_audit.md` - Detailed violation report
- `analytics/reports/baseline_integrity_audit.json` - Machine-readable data
- `tools/validate_baseline_observability.py` - Validation ruleset
- `docs/baseline/BASELINE_QUESTIONS_V1_FREEZE.md` - Baseline freeze documentation

## Conclusion

The baseline question integrity review has identified systemic issues with question formulation. All 416 questions contain violations of observability criteria. The audit tools and validation ruleset are now in place to prevent future violations. Phase 2 (correction) requires manual review and rewriting of questions to align with baseline observability requirements.

