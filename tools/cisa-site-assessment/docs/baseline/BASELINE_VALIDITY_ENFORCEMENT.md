# Baseline Validity Rules Enforcement - Complete Documentation

**Date:** 2025-12-27  
**Status:** COMPLETE  
**Ruleset Version:** 1.0

## Overview

This document provides complete documentation for the baseline validity rules enforcement system. Formal rules have been defined, implemented, and integrated into question generation workflows.

## Phase 1: Rule Implementation - COMPLETE ✅

### Formal Ruleset

**Document:** `docs/baseline/BASELINE_VALIDITY_RULES.md` (AUTHORITATIVE)

**MUST Rules (All Required):**
- **RULE-001:** Observable Condition
- **RULE-002:** Physical or Functional Condition
- **RULE-003:** Meaningful NO Response
- **RULE-004:** Truthful YES Response

**MUST NOT Rules (All Prohibited):**
- **RULE-101:** Policy/Procedure Satisfaction (BLOCKER)
- **RULE-102:** Abstract Terms (BLOCKER)
- **RULE-103:** Assurance Language (BLOCKER)
- **RULE-104:** Roles and Responsibilities (BLOCKER)
- **RULE-105:** Interpretation Required (REVIEW)

### Implementation

**File:** `tools/validate_baseline_observability.py`

**Features:**
- Rule-based validation with explicit severity levels
- Pattern matching for each rule
- Context-aware validation (capability dimension checks)
- Guard functions for generation workflows
- Detailed violation reporting

**Key Functions:**
- `check_rule_violations()` - Check question against all rules
- `validate_question_with_rules()` - Comprehensive validation with detailed violations
- `guard_baseline_question()` - Guard function that raises exception on BLOCKER violations

## Phase 2: Apply to Existing Baseline - COMPLETE ✅

### Violations Report

**Tool:** `tools/apply_baseline_validity_rules.py`

**Results:**
- **Total Questions:** 416
- **Questions with BLOCKER Violations:** 416 (100%)
- **Questions with REVIEW Violations:** 4
- **Questions with No Violations:** 0

**Violations by Rule:**
- RULE-102 (Abstract Terms): 210 violations
- RULE-101 (Policy/Procedure): 104 violations
- RULE-103 (Assurance Language): 104 violations
- RULE-104 (Roles/Responsibilities): 104 violations
- RULE-105 (Interpretation Required): 4 violations

### Reports Generated

1. **Machine-readable:** `analytics/reports/baseline_validity_violations.json`
   - Structured JSON format
   - Detailed violation data
   - Summary statistics

2. **Human-readable:** `analytics/reports/baseline_validity_violations.md`
   - Detailed violation report
   - Grouped by severity
   - Cross-reference with integrity audit

## Phase 3: Enforcement - COMPLETE ✅

### Integration Points

#### 1. Question Generation Workflow

**File:** `tools/regenerate_baseline_questions.py`

**Status:** ✅ Integrated

**Behavior:**
- Validates all generated questions against rules
- Uses `validate_question_with_rules()` for detailed validation
- Fails generation if BLOCKER violations found
- Warns on REVIEW violations (allows with override)

**Code Location:** `validate_questions()` function

**Example Error:**
```
Question BASE-000 BLOCKER violation (RULE-102): Question asks about 'capabilities', 'processes', 'programs', or 'governance'
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
- Provides detailed violation information with rule IDs

#### 3. LLM Candidate Review

**Status:** ⏳ Pending Integration

**Recommendation:**
```python
from validate_baseline_observability import validate_question_with_rules

is_valid, blocker_violations, review_violations = validate_question_with_rules(llm_candidate)

if not is_valid:
    # Reject candidate
    reject_candidate(blocker_violations)
elif review_violations:
    # Require human review
    flag_for_review(review_violations)
```

#### 4. Manual Authoring Workflow

**Status:** ⏳ Pending Integration

**Recommendation:**
- Provide real-time rule validation feedback
- Block submission if BLOCKER violations found
- Require justification for REVIEW violations
- Display rule violations with severity and descriptions

## Systemic Failure Patterns

### Pattern 1: Abstract "Capabilities" Language

**Rule:** RULE-102 (Abstract Terms)  
**Count:** 210 violations  
**Severity:** BLOCKER

**Root Cause:** Question generation templates use abstract "capabilities" language.

**Examples:**
- "Does the facility have biometric access capabilities?"
- "Does the facility have credential / badge capabilities?"

**Fix:** Replace "capabilities" with specific physical systems/components.

**Example Transformation:**
- **Before:** "Does the facility have biometric access capabilities?"
- **After:** "Are biometric access readers installed at controlled entry points?"

### Pattern 2: Policy/Procedure Focus

**Rule:** RULE-101 (Policy/Procedure Satisfaction)  
**Count:** 104 violations  
**Severity:** BLOCKER

**Root Cause:** PLANS_PROCEDURES dimension is inherently non-observable.

**Examples:**
- "Are documented procedures in place for biometric access?"
- "Are policies in place for access control?"

**Fix:** Remove from baseline or move to sector/subsector overlays.

### Pattern 3: Assurance Language

**Rule:** RULE-103 (Assurance Language)  
**Count:** 104 violations  
**Severity:** BLOCKER

**Root Cause:** MAINTENANCE_ASSURANCE dimension is inherently non-observable.

**Examples:**
- "Are processes in place to ensure biometric access capabilities are maintained?"
- "Are mechanisms in place to ensure access control?"

**Fix:** Collapse into minimal observable indicators or remove from baseline.

### Pattern 4: Roles and Responsibilities

**Rule:** RULE-104 (Roles and Responsibilities)  
**Count:** 104 violations  
**Severity:** BLOCKER

**Root Cause:** PERSONNEL_RESPONSIBILITY dimension is inherently non-observable.

**Examples:**
- "Are roles and responsibilities defined for biometric access?"
- "Are personnel assigned to access control?"

**Fix:** Remove from baseline or move to sector/subsector overlays.

### Pattern 5: Interpretation Required

**Rule:** RULE-105 (Interpretation Required)  
**Count:** 4 violations  
**Severity:** REVIEW

**Root Cause:** Subjective language in question text.

**Examples:**
- Questions using "effective", "adequate", "appropriate"

**Fix:** Replace with objective, observable language.

## Cross-Reference with Integrity Audit

### Comparison

| Metric | Integrity Audit | Validity Rules |
|--------|----------------|----------------|
| Total Questions | 416 | 416 |
| Violations Found | 416 (100%) | 416 (100%) |
| Categorization | REWRITE/COLLAPSE/DEMOTE | BLOCKER/REVIEW |
| Rule-Based | No | Yes |
| Enforceable | No | Yes |

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

## Files Created/Modified

### Created Files

1. **`docs/baseline/BASELINE_VALIDITY_RULES.md`** (AUTHORITATIVE)
   - Formal ruleset definition
   - Rule descriptions and examples
   - Severity levels

2. **`tools/apply_baseline_validity_rules.py`**
   - Rule application tool
   - Generates violations reports

3. **`analytics/reports/baseline_validity_violations.json`**
   - Machine-readable violation data
   - Structured JSON format

4. **`analytics/reports/baseline_validity_violations.md`**
   - Human-readable detailed report
   - Violations grouped by severity

5. **`analytics/reports/BASELINE_VALIDITY_ENFORCEMENT_SUMMARY.md`**
   - Executive summary
   - Enforcement status

6. **`docs/baseline/BASELINE_VALIDITY_ENFORCEMENT.md`**
   - This document - complete documentation

### Modified Files

1. **`tools/validate_baseline_observability.py`**
   - Enhanced with rule-based validation
   - Added `check_rule_violations()` function
   - Added `validate_question_with_rules()` function
   - Updated `guard_baseline_question()` function

2. **`tools/regenerate_baseline_questions.py`**
   - Enhanced validation to use rule-based checks
   - Improved error messages with rule IDs

## Usage Examples

### Validate a Question

```python
from validate_baseline_observability import validate_question_with_rules

question = {
    'element_id': 'BASE-000',
    'question_text': 'Does the facility have biometric access capabilities?',
    'capability_dimension': 'SYSTEMS'
}

is_valid, blocker_violations, review_violations = validate_question_with_rules(question)

if not is_valid:
    print("BLOCKER violations:")
    for v in blocker_violations:
        print(f"  {v['rule_id']}: {v['description']}")
```

### Guard Function

```python
from validate_baseline_observability import guard_baseline_question

try:
    guard_baseline_question(question)
    print("Question is valid")
except ValueError as e:
    print(f"Question rejected: {e}")
```

### Apply Rules to Baseline

```bash
python tools/apply_baseline_validity_rules.py
```

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

## Related Documentation

- `docs/baseline/BASELINE_VALIDITY_RULES.md` - Formal ruleset (AUTHORITATIVE)
- `analytics/reports/BASELINE_VALIDITY_ENFORCEMENT_SUMMARY.md` - Executive summary
- `analytics/reports/baseline_validity_violations.md` - Detailed violation report
- `docs/baseline/BASELINE_INTEGRITY_REVIEW.md` - Integrity review documentation

## Conclusion

Formal baseline validity rules have been defined, implemented, and applied to all existing baseline questions. The enforcement system is integrated into question generation workflows and ready for LLM review and manual authoring integration. All 416 questions contain BLOCKER violations, indicating systemic issues that require correction.

The ruleset provides a formal, enforceable foundation for maintaining baseline question integrity going forward.

