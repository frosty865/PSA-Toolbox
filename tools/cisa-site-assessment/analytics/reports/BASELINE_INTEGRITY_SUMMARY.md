# Baseline Question Integrity Review - Executive Summary

**Date:** 2025-12-27  
**Baseline Version:** Baseline_Questions_v1  
**Status:** FROZEN (versioned_only)

## Overview

A comprehensive integrity audit of all 416 baseline questions has been completed. The audit identifies systemic issues with question formulation that violate baseline observability criteria.

## Key Findings

### Violation Rate: 100%

**All 416 baseline questions contain violations** of baseline observability criteria. This indicates a systemic issue with the current question generation methodology.

### Root Causes

1. **Abstract Language in SYSTEMS Dimension (104 questions)**
   - Questions ask about "capabilities" rather than physical systems/components
   - Example: "Does the facility have biometric access capabilities?"
   - Should be: "Are biometric access readers installed at entry points?"

2. **Inherently Non-Observable Dimensions (312 questions)**
   - **PLANS_PROCEDURES (104 questions)**: Focus on documentation, not observable conditions
   - **MAINTENANCE_ASSURANCE (104 questions)**: Focus on processes/assurance, not physical state
   - **PERSONNEL_RESPONSIBILITY (104 questions)**: Focus on roles/organizational structure, not physical systems

3. **Framework/Governance Language**
   - Questions use terms like "processes", "assurance", "maintained" that are not field-verifiable

## Recommended Handling

### REWRITE (104 questions - SYSTEMS dimension)
- Replace abstract "capabilities" language with specific physical system questions
- Focus on observable components: "Are [specific systems] installed/operational?"
- Example transformation:
  - **Before:** "Does the facility have biometric access capabilities?"
  - **After:** "Are biometric access readers installed at controlled entry points?"

### DEMOTE (208 questions - PLANS_PROCEDURES + PERSONNEL_RESPONSIBILITY)
- These dimensions are inherently non-observable
- **Recommendation:** Remove from baseline or move to sector/subsector overlays
- Baseline must be field-verifiable through physical inspection only

### COLLAPSE (104 questions - MAINTENANCE_ASSURANCE)
- Maintenance questions cannot be answered through on-site observation alone
- **Recommendation:** Collapse into reduced set of observable maintenance indicators
- Focus on physical evidence: "Are maintenance logs visible?", "Are systems operational?"

## Systemic Issues Identified

### Issue 1: Capability Dimensions Are Not Baseline-Appropriate

The current 4-dimension model (SYSTEMS, PLANS_PROCEDURES, MAINTENANCE_ASSURANCE, PERSONNEL_RESPONSIBILITY) includes 3 dimensions that are inherently non-observable:

- ✅ **SYSTEMS**: Can be observable if rephrased (remove "capabilities")
- ❌ **PLANS_PROCEDURES**: Inherently non-observable (documentation-based)
- ❌ **MAINTENANCE_ASSURANCE**: Inherently non-observable (process-based)
- ❌ **PERSONNEL_RESPONSIBILITY**: Inherently non-observable (organizational structure)

### Issue 2: Question Templates Use Abstract Language

The deterministic generation method produces questions with abstract terms:
- "capabilities" instead of "systems/components installed"
- "processes in place" instead of "observable evidence"
- "roles defined" instead of "personnel present/assigned"

### Issue 3: No Observability Validation

The current validation (`validate_baseline_publish_ready.py`) checks for:
- Placeholders
- Subtype codes
- Response enums

**Missing:** Observability/field-verifiability checks

## Phase 2 Recommendations

### 1. Rewrite SYSTEMS Dimension Questions
- Remove "capabilities" language
- Ask about specific physical components
- Use observable verbs: "installed", "operational", "present", "configured"

### 2. Remove or Demote Non-Observable Dimensions
- **Option A:** Remove PLANS_PROCEDURES, MAINTENANCE_ASSURANCE, PERSONNEL_RESPONSIBILITY from baseline
- **Option B:** Move to sector/subsector overlays (not universal baseline)
- **Option C:** Collapse into minimal observable indicators

### 3. Revise Question Generation Templates
- Update `regenerate_baseline_questions.py` to use observable language
- Remove abstract terms from templates
- Focus on physical system state, not organizational capability

## Phase 3 Enforcement

### New Validation Rules

Created `tools/validate_baseline_observability.py` with enforcement guards:

1. **Abstract Term Detection**: Flags "capabilities", "processes", "program", "governance"
2. **Policy/Procedure Detection**: Flags documentation-focused questions
3. **Role/Responsibility Detection**: Flags organizational structure questions
4. **Non-Observable Pattern Detection**: Flags questions answerable without physical inspection
5. **Framework Language Detection**: Flags compliance/governance terminology

### Integration Points

Validation should be integrated into:
- ✅ `tools/regenerate_baseline_questions.py` (question generation)
- ⏳ LLM-generated candidate review (future)
- ⏳ Manual authoring workflow (future)

## Next Steps

1. **Immediate:** Review detailed violation report (`baseline_integrity_audit.md`)
2. **Short-term:** Rewrite SYSTEMS dimension questions (104 questions)
3. **Medium-term:** Decide on handling of non-observable dimensions (312 questions)
4. **Long-term:** Integrate observability validation into generation workflow

## Files Generated

- `analytics/reports/baseline_integrity_audit.json` - Machine-readable violation data
- `analytics/reports/baseline_integrity_audit.md` - Human-readable detailed report
- `tools/validate_baseline_observability.py` - Enforcement validation rules

## Validation Commands

```bash
# Run audit
python tools/audit_baseline_integrity.py

# Validate individual question
python tools/validate_baseline_observability.py
```

