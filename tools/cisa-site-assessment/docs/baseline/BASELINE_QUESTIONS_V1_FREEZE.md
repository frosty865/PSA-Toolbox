# Baseline Questions v1 — FROZEN

## Status: FROZEN

**Baseline Questions v1 is complete and frozen as of 2025-01-27.**

This document formally establishes that Baseline Questions v1 (`Baseline_Questions_v1`) is frozen and cannot be modified, regenerated, or overwritten without an explicit version increment.

## Freeze Declaration

- **Version**: Baseline_Questions_v1
- **Status**: frozen
- **Scope**: baseline
- **Change Policy**: versioned_only
- **Frozen At**: 2025-01-27T00:00:00.000Z

## Protection Rules

### Disallowed Actions

Baseline Questions v1 **cannot** be:
- Edited
- Deleted
- Overwritten
- Regenerated
- Auto-normalized
- Auto-updated
- Silently modified
- Implicitly promoted

### Allowed Actions

Baseline Questions v1 **can** be:
- Read
- Referenced
- Copied into future versions (Baseline Questions v2, etc.)

## Implementation

### Metadata

The baseline questions fixture file (`app/lib/fixtures/required_elements_baseline.json`) contains metadata declaring the freeze:

```json
{
  "metadata": {
    "baseline_version": "Baseline_Questions_v1",
    "status": "frozen",
    "scope": "baseline",
    "change_policy": "versioned_only",
    "frozen_at": "2025-01-27T00:00:00.000Z"
  },
  "required_elements": [...]
}
```

### Guard Implementation

A freeze guard utility (`lib/baselineFreezeGuard.ts`) enforces the freeze:

- `isBaselineFrozen()` - Checks if baseline is frozen
- `guardBaselineFreeze()` - Throws error if attempting to modify frozen baseline
- `validateBaselineNotFrozen()` - Validates baseline is not frozen before writes

### API Protection

The required elements API route (`app/api/required-elements/route.ts`) enforces the freeze:

- **GET**: Reads baseline questions (allowed)
- **POST/PUT/PATCH/DELETE**: Rejects attempts to modify frozen baseline questions with error:
  > "Baseline Questions v1 is frozen. Create a new version to modify."

## Impact

### Assessment References

All baseline assessments reference Baseline Questions v1. This freeze ensures:
- Consistency across assessments
- No retroactive changes to baseline questions
- Predictable assessment results

### Sector Overlays

Sector and subsector overlays do **not** modify baseline questions. They add additional questions on top of the baseline. The freeze does not affect sector logic.

## Version Increment

To make changes to baseline questions:

1. Create a new version: `Baseline_Questions_v2`
2. Copy baseline questions from v1
3. Make desired modifications
4. Update metadata to reflect new version and status
5. Update all references to use the new version

**Do not** modify Baseline Questions v1.

## Enforcement

The freeze is enforced at multiple levels:

1. **File-level**: Metadata declares freeze status
2. **Code-level**: Guard functions prevent modifications
3. **API-level**: Write operations are rejected for frozen baseline
4. **Documentation-level**: This document establishes the policy

## No Overrides

There are **no override mechanisms**. There are **no force flags**. The freeze is absolute.

## Rationale

This freeze prevents:
- Drift in baseline questions
- Retroactive changes affecting existing assessments
- Unintended modifications during system updates
- Loss of assessment consistency

Baseline Questions v1 is the foundation for all assessments and must remain stable.

---

**Baseline Questions v1 — FROZEN**

