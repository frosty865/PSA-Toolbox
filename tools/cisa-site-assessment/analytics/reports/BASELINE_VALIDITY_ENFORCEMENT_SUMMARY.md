# Baseline Validity Rules Enforcement - Summary

**Date:** 2025-12-27  
**Baseline Version:** Baseline_Questions_v1  
**Ruleset Version:** 1.0

## Overview

Formal baseline validity rules have been defined and applied to all existing baseline questions. This document summarizes the enforcement system and systemic failure patterns identified.

## Phase 1: Rule Implementation - COMPLETE ✅

### Formal Ruleset

**Document:** `docs/baseline/BASELINE_VALIDITY_RULES.md`

**Rules Defined:**
- **RULE-001** (MUST): Observable Condition
- **RULE-002** (MUST): Physical or Functional Condition
- **RULE-003** (MUST): Meaningful NO Response
- **RULE-004** (MUST): Truthful YES Response
- **RULE-101** (MUST NOT): Policy/Procedure Satisfaction (BLOCKER)
- **RULE-102** (MUST NOT): Abstract Terms (BLOCKER)
- **RULE-103** (MUST NOT): Assurance Language (BLOCKER)
- **RULE-104** (MUST NOT): Roles and Responsibilities (BLOCKER)
- **RULE-105** (MUST NOT): Interpretation Required (REVIEW)

### Implementation

**File:** `tools/validate_baseline_observability.py`

- Rule-based validation with explicit severity levels
- Pattern matching for each rule
- Context-aware validation (capability dimension checks)
- Guard functions for generation workflows

## Phase 2: Apply to Existing Baseline - COMPLETE ✅

### Violations Report

**Total Questions:** 416  
**Questions with BLOCKER Violations:** 416 (100%)  
**Questions with REVIEW Violations:** 4  
**Questions with No Violations:** 0

### Violations by Rule

| Rule ID | Rule Name | Severity | Count |
|---------|-----------|----------|-------|
| RULE-102 | Abstract Terms | BLOCKER | 210 |
| RULE-101 | Policy/Procedure Satisfaction | BLOCKER | 104 |
| RULE-103 | Assurance Language | BLOCKER | 104 |
| RULE-104 | Roles and Responsibilities | BLOCKER | 104 |
| RULE-105 | Interpretation Required | REVIEW | 4 |

### Detailed Reports

- **Machine-readable:** `analytics/reports/baseline_validity_violations.json`
- **Human-readable:** `analytics/reports/baseline_validity_violations.md`

## Phase 3: Enforcement - COMPLETE ✅

### Integration Points

#### 1. Question Generation Workflow

**File:** `tools/regenerate_baseline_questions.py`

**Status:** ✅ Integrated

**Behavior:**
- Validates all generated questions against rules
- Fails generation if BLOCKER violations found
- Warns on REVIEW violations (allows with override)

**Code:**
```python
# In validate_questions() function
if observability_validation_available:
    for question in questions:
        is_valid, violations = validate_question_for_baseline(question)
        if not is_valid:
            errors.append(f"Question {question_id} observability violation: {violation}")
```

#### 2. Guard Function

**Function:** `guard_baseline_question()` in `tools/validate_baseline_observability.py`

**Usage:**
```python
from validate_baseline_observability import guard_baseline_question

try:
    guard_baseline_question(question_dict)
except ValueError as e:
    # Handle BLOCKER violation
    print(f"Question rejected: {e}")
```

**Behavior:**
- Raises `ValueError` on BLOCKER violations
- Warns (but doesn't block) on REVIEW violations
- Provides detailed violation information

#### 3. LLM Candidate Review

**Status:** ⏳ Pending Integration

**Recommendation:**
- Validate LLM-generated candidates before acceptance
- Reject candidates with BLOCKER violations
- Require human review for REVIEW violations

#### 4. Manual Authoring Workflow

**Status:** ⏳ Pending Integration

**Recommendation:**
- Provide real-time rule validation feedback
- Block submission if BLOCKER violations found
- Require justification for REVIEW violations

## Systemic Failure Patterns

### Pattern 1: Abstract "Capabilities" Language (210 violations)

**Rule:** RULE-102 (Abstract Terms)

**Examples:**
- "Does the facility have biometric access capabilities?"
- "Does the facility have credential / badge capabilities?"

**Root Cause:** Question generation templates use abstract language.

**Fix:** Replace "capabilities" with specific physical systems/components.

**Example Transformation:**
- **Before:** "Does the facility have biometric access capabilities?"
- **After:** "Are biometric access readers installed at controlled entry points?"

### Pattern 2: Policy/Procedure Focus (104 violations)

**Rule:** RULE-101 (Policy/Procedure Satisfaction)

**Examples:**
- "Are documented procedures in place for biometric access?"
- "Are policies in place for access control?"

**Root Cause:** PLANS_PROCEDURES dimension is inherently non-observable.

**Fix:** Remove from baseline or move to sector/subsector overlays.

### Pattern 3: Assurance Language (104 violations)

**Rule:** RULE-103 (Assurance Language)

**Examples:**
- "Are processes in place to ensure biometric access capabilities are maintained?"
- "Are mechanisms in place to ensure access control?"

**Root Cause:** MAINTENANCE_ASSURANCE dimension is inherently non-observable.

**Fix:** Collapse into minimal observable indicators or remove from baseline.

### Pattern 4: Roles and Responsibilities (104 violations)

**Rule:** RULE-104 (Roles and Responsibilities)

**Examples:**
- "Are roles and responsibilities defined for biometric access?"
- "Are personnel assigned to access control?"

**Root Cause:** PERSONNEL_RESPONSIBILITY dimension is inherently non-observable.

**Fix:** Remove from baseline or move to sector/subsector overlays.

### Pattern 5: Interpretation Required (4 violations)

**Rule:** RULE-105 (Interpretation Required)

**Examples:**
- Questions using "effective", "adequate", "appropriate"

**Root Cause:** Subjective language in question text.

**Fix:** Replace with objective, observable language.

## Cross-Reference with Integrity Audit

### Comparison

| Metric | Integrity Audit | Validity Rules |
|--------|----------------|----------------|
| Total Questions | 416 | 416 |
| Violations Found | 416 (100%) | 416 (100%) |
| Categorization | REWRITE/COLLAPSE/DEMOTE | BLOCKER/REVIEW |
| Rule-Based | No | Yes |

### Key Differences

1. **Integrity Audit:**
   - Flags abstract language and non-observable patterns
   - Categorizes by recommended handling (rewrite/collapse/demote)
   - Focuses on observability principles

2. **Validity Rules:**
   - Formal rules with explicit severity (BLOCKER | REVIEW)
   - Rule-based pattern matching
   - Enforceable in generation workflows

### Alignment

Both approaches identify the same systemic issues:
- Abstract "capabilities" language
- Policy/procedure focus
- Assurance/maintenance language
- Roles/responsibilities focus

The validity rules provide formal, enforceable criteria that can be integrated into automated workflows.

## Enforcement Summary

### Current State

✅ **Rule Definition:** Complete  
✅ **Rule Implementation:** Complete  
✅ **Violations Report:** Complete  
✅ **Generation Integration:** Complete  
⏳ **LLM Review Integration:** Pending  
⏳ **Manual Authoring Integration:** Pending

### Enforcement Behavior

1. **Question Generation:**
   - Validates all questions against rules
   - Fails on BLOCKER violations
   - Warns on REVIEW violations

2. **Guard Function:**
   - Raises exception on BLOCKER violations
   - Warns (but doesn't block) on REVIEW violations

3. **Future Integration:**
   - LLM candidates: Reject BLOCKER violations, review REVIEW violations
   - Manual authoring: Real-time feedback, block BLOCKER violations

## Next Steps

### Immediate

1. **Review Violations Report:**
   - `analytics/reports/baseline_validity_violations.md`
   - Understand scope of violations

2. **Prioritize Corrections:**
   - Start with RULE-102 violations (210 questions - abstract "capabilities")
   - Decide on handling of non-observable dimensions (312 questions)

### Short-Term

3. **Integrate into LLM Review:**
   - Add validation to LLM candidate review workflow
   - Reject candidates with BLOCKER violations

4. **Integrate into Manual Authoring:**
   - Add real-time validation feedback
   - Block submission on BLOCKER violations

### Long-Term

5. **Rewrite Questions:**
   - Transform abstract language to observable conditions
   - Remove or demote non-observable dimensions

6. **Update Generation Templates:**
   - Modify question templates to use observable language
   - Remove abstract terms from generation logic

## Files Created/Modified

### Created

1. `docs/baseline/BASELINE_VALIDITY_RULES.md` - Formal ruleset (AUTHORITATIVE)
2. `tools/apply_baseline_validity_rules.py` - Rule application tool
3. `analytics/reports/baseline_validity_violations.json` - Machine-readable report
4. `analytics/reports/baseline_validity_violations.md` - Human-readable report
5. `analytics/reports/BASELINE_VALIDITY_ENFORCEMENT_SUMMARY.md` - This document

### Modified

1. `tools/validate_baseline_observability.py` - Enhanced with rule-based validation
2. `tools/regenerate_baseline_questions.py` - Already integrated (no changes needed)

## Related Documentation

- `docs/baseline/BASELINE_VALIDITY_RULES.md` - Formal ruleset
- `docs/baseline/BASELINE_INTEGRITY_REVIEW.md` - Integrity review documentation
- `analytics/reports/baseline_integrity_audit.md` - Integrity audit report
- `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md` - Integrity audit summary

## Conclusion

Formal baseline validity rules have been defined, implemented, and applied to all existing baseline questions. The enforcement system is integrated into question generation workflows and ready for LLM review and manual authoring integration. All 416 questions contain BLOCKER violations, indicating systemic issues that require correction.

