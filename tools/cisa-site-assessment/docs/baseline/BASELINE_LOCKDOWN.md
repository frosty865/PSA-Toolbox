# Baseline Lockdown and Drift Prevention

**Status:** AUTHORITATIVE  
**Version:** 1.0  
**Effective Date:** 2025-12-28

## Purpose

This document defines the lockdown and drift prevention mechanisms for Baseline v2. These mechanisms ensure that baseline questions remain gate-pure, observable, and free from unauthorized changes.

## Baseline v2 Status

- **Version:** Baseline_Questions_v2
- **Status:** FROZEN
- **Immutable:** All questions marked as `immutable = true`
- **Source:** All questions marked as `source = BASELINE_V2`

## Lockdown Mechanisms

### 1. Baseline Write Protection

All Baseline v2 questions are marked as:
- `immutable = true`
- `source = BASELINE_V2`
- `frozen_version = Baseline_Questions_v2`

**Update Rules:**
- Updates to baseline question text are **BLOCKED** unless:
  - `override_flag = true`
  - `override_reason` is provided
  - `override_actor` is recorded
- All override attempts are logged

### 2. Authoring Guards

Baseline validity validation is enforced at all entry points:

#### Generation Scripts
- `tools/regenerate_baseline_questions.py` - Integrated authoring guard
- Any script that generates baseline questions must use `validate_on_generate()`

#### LLM-Assisted Workflows
- Any LLM-generated baseline proposals must pass `validate_on_submit()`
- REVIEW warnings require justification

#### Manual Authoring / Admin UI
- All manual authoring paths must use `validate_on_submit()`
- Override requires explicit flag, reason, and actor

**Validation Behavior:**
- **BLOCKER violations:** Block submission (unless override)
- **REVIEW warnings:** Require justification (unless override)
- **All attempts:** Logged (pass or fail)

### 3. Dimension Ban Enforcement

The following dimensions are **explicitly banned** from baseline authoring:
- `PLANS_PROCEDURES`
- `PERSONNEL_RESPONSIBILITY`
- `MAINTENANCE_ASSURANCE` (as a dimension, not as a gate)

**Enforcement:**
- Any baseline candidate referencing these dimensions is **rejected**
- Validation occurs at generation and submission

### 4. Gate Enforcement

Baseline questions may reference **ONLY** the following gates:
- `CONTROL_EXISTS`
- `CONTROL_OPERABLE`
- `CONTROL_RESILIENCE`

**Constraints:**
- One gate per question
- Gate ordering constraints enforced
- Any reference to other gates is **rejected**

### 5. Language Ban Enforcement

The following language is **forbidden** in baseline questions:
- `governance` (in abstract context)
- `program` (in abstract context)
- `framework`
- `capabilities` (in abstract context)
- `processes` (in abstract context)

**Context Awareness:**
- Terms in system names (e.g., "evacuation procedures systems") are warnings, not errors
- Terms in abstract contexts are errors

## Drift Detection

### Automated Checks

The drift guard (`tools/baseline_drift_guard.py`) performs:
1. **Version Check:** Verifies baseline version matches `Baseline_Questions_v2`
2. **Hash Check:** Compares current baseline registry hash against frozen v2 hash
3. **Immutable Flag Check:** Verifies all questions are marked as immutable
4. **Source Check:** Verifies all questions have `source = BASELINE_V2`

### Drift Report Format

Drift reports include:
- `question_id`: Question identifier
- `field`: Field that changed
- `before`: Expected value
- `after`: Actual value
- `severity`: ERROR or WARNING

### CI Integration

Drift detection should be integrated into:
- CI/CD pipelines
- Seed/regeneration scripts
- Any automated baseline processing

**Behavior:**
- Fail CI/seed runs if drift detected
- Emit clear drift reports
- Block deployment if baseline integrity compromised

## Authoring Guard API

### `validate_on_generate(question, mapped_gate)`

Validation hook for baseline question generation.

**Usage:**
```python
from baseline_authoring_guard import validate_on_generate

is_allowed, result = validate_on_generate(question, 'CONTROL_EXISTS')
if not is_allowed:
    # Handle blockers
    for violation in result['blocker_violations']:
        print(f"BLOCKER: {violation['message']}")
```

### `validate_on_submit(question, mapped_gate, override_flag, override_reason, override_actor)`

Validation hook for baseline question submission (manual or admin UI).

**Usage:**
```python
from baseline_authoring_guard import validate_on_submit

is_allowed, result = validate_on_submit(
    question=question,
    mapped_gate='CONTROL_EXISTS',
    override_flag=False,
    override_reason=None,
    override_actor=None
)
if not is_allowed:
    # Handle blockers or require justification
    if result['review_warnings']:
        # Require justification for warnings
        pass
```

## Override Process

Overrides are **only** allowed with:
1. **Explicit Flag:** `override_flag = true`
2. **Reason:** `override_reason` must be provided
3. **Actor:** `override_actor` must be recorded
4. **Logging:** All overrides are logged

**Override Use Cases:**
- Emergency fixes
- Authorized corrections
- Planned baseline updates (v3, etc.)

## Integration Points

### Existing Scripts

1. **`tools/regenerate_baseline_questions.py`**
   - Integrated: `validate_on_generate()` for all generated questions
   - Blocks generation on BLOCKER violations

2. **`tools/rewrite_baseline_questions.py`**
   - Integrated: Validation after rewrite
   - Blocks rewrite on BLOCKER violations

### Future Integration

1. **LLM-Assisted Authoring**
   - Integrate `validate_on_submit()` in LLM proposal workflow
   - Require justification for REVIEW warnings

2. **Admin UI**
   - Integrate `validate_on_submit()` in baseline question editor
   - Show validation errors/warnings before submission
   - Require override flag for blockers

3. **CI/CD**
   - Run `baseline_drift_guard.py` in CI pipeline
   - Fail builds on drift detection

## Drift Report Specification

Drift reports are generated in Markdown format:

```markdown
# Baseline Drift Report

**Generated:** 2025-12-28T20:00:00
**Baseline Version:** Baseline_Questions_v2

**Total Drift Items:** N

## Drift Items

### BASE-XXX
- **Field:** metadata.immutable
- **Before:** true (expected)
- **After:** false
- **Severity:** ERROR
```

## Enforcement Summary

| Mechanism | Entry Point | Behavior |
|-----------|-------------|----------|
| Write Protection | All baseline writes | Block unless override |
| Authoring Guard | Generation scripts | Block on BLOCKER |
| Authoring Guard | LLM workflows | Block on BLOCKER, require justification on REVIEW |
| Authoring Guard | Manual authoring | Block on BLOCKER, require justification on REVIEW |
| Dimension Ban | All authoring | Reject forbidden dimensions |
| Gate Enforcement | All authoring | Reject forbidden gates |
| Language Ban | All authoring | Reject forbidden language |
| Drift Detection | CI/CD, scripts | Fail on drift |

## Related Documentation

- `docs/baseline/BASELINE_VALIDITY_RULES.md` - Baseline validity rules
- `analytics/reports/baseline_v2_manifest.json` - Baseline v2 manifest
- `tools/baseline_drift_guard.py` - Drift detection implementation
- `tools/baseline_authoring_guard.py` - Authoring guard implementation




