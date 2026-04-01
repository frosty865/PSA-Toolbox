# Curve Client Analysis Report
**Date:** February 16, 2026  
**File:** apps/web/app/lib/charts/curveClient.ts  
**Analysis Type:** Logic, Math, and Consistency Review

---

## Executive Summary

Found **5 critical logic issues** and **3 minor inconsistencies** in the curve generation algorithm. Most issues relate to edge cases where time horizons overlap unexpectedly.

---

## Critical Issues

### 1. ⚠️ **Backup Expiration Before Impact Time (Logic Inconsistency)**

**Severity:** HIGH  
**Location:** `lossWithBackupAtTime()` function (lines 144-158)

**Issue:**  
When backup expires before the asset becomes critical (`T_backup_end < T_impact`), the with-backup curve exhibits illogical behavior:

```
Scenario: T_impact=20h, T_backup=10h, T_outage=72h
- t=0 to t=10: L_with loss (backup active)
- t=10 to t=20: 0 loss (100% capacity!) ← PROBLEM
- t=20 to t=72: L_no loss (outage impact)
```

**Root Cause:**  
After backup expires (`t > T_backup_end`), the function calls `lossWithoutBackupAtTime(t)`, which is gated by `T_impact`. This creates a period of 100% capacity between backup expiration and impact time, which contradicts the physical model.

**Mathematical Proof:**
```
For t ∈ (T_backup_end, T_impact) where T_backup_end < T_impact:
  lossWithBackupAtTime(t) 
    = lossWithoutBackupAtTime(t)  // backup exhausted
    = 0                            // t < T_impact gate
    ⟹ capacity = 100%              // illogical
```

**Expected Behavior:**  
After backup expires, capacity should remain at degraded state (`L_no`), not return to 100%.

**Recommendation:**  
Modify `lossWithBackupAtTime()` to NOT apply T_impact gating after backup expires:

```typescript
function lossWithBackupAtTime(t: number): number {
  if (!hasBackup || T_backup_end <= 0) {
    return lossWithoutBackupAtTime(t);
  }
  
  if (t <= T_backup_end) {
    return L_with;
  }
  
  // After backup expires: ungated outage loss
  if (t < T_outage) {
    return L_no;  // Full outage, no T_impact gating
  }
  
  // Recovery phase (same as without backup)
  if (T_recovery <= 0) return 0;
  const frac = clamp((t - T_outage) / T_recovery, 0, 1);
  return L_no * (1 - frac);
}
```

---

### 2. ⚠️ **Recovery Before Impact (Time Ordering Violation)**

**Severity:** HIGH  
**Location:** Validation check (lines 74-80), `lossWithoutBackupAtTime()` (lines 107-126)

**Issue:**  
When outage ends before impact time (`T_outage <= T_impact`), the model becomes logically inconsistent. The code warns about this but proceeds anyway.

```
Scenario: T_impact=20h, T_outage=10h, T_recovery=5h
- t=0 to t=20: 0 loss (T_impact gate prevents loss)
- t=20: Suddenly enters recovery phase calculation:
        frac = (20 - 10) / 5 = 2.0 → clamped to 1.0
        loss = L_no × (1 - 1.0) = 0
```

**Result:** The asset never shows any degradation because recovery completes before impact time.

**Mathematical Issue:**
```
If T_outage + T_recovery < T_impact:
  ∀t ∈ [0, ∞): lossWithoutBackupAtTime(t) = 0
  ⟹ Asset never degrades despite requiring service
```

**Recommendation:**  
Enforce time ordering constraint:
```typescript
// After input validation
if (T_outage < T_impact && input.requires_service) {
  console.error('[Curve] Invalid time ordering: outage ends before impact time');
  // Option 1: Adjust T_outage = max(T_outage, T_impact)
  // Option 2: Return error state
  // Option 3: Treat as instant recovery (current behavior with warning)
}
```

---

### 3. ⚠️ **Division by Zero Risk (T_recovery = 0)**

**Severity:** MEDIUM  
**Location:** Line 122-123

**Issue:**  
The guard `if (T_recovery <= 0) return 0;` prevents division by zero, but it's placed AFTER the comment block and before the calculation. This is correct but could be clearer.

**Current Code:**
```typescript
// Post-restoration recovery ramp back to 0 loss
if (T_recovery <= 0) {
  return 0;  // Guard is here ✓
}

const frac = clamp((t - T_outage) / T_recovery, 0, 1);  // Safe
```

**Issue:** Reading flow is suboptimal. The guard is semantically part of the calculation, not the comment.

**Recommendation:**  
Move guard into calculation block with explicit comment:
```typescript
// Post-restoration recovery ramp back to 0 loss
if (T_recovery <= 0) {
  return 0;  // Instant recovery (no ramp needed)
}

const frac = clamp((t - T_outage) / T_recovery, 0, 1);
return L_no * (1 - frac);
```

---

### 4. ⚠️ **Redundant Critical Time Point**

**Severity:** LOW  
**Location:** Lines 163-169

**Issue:**  
Both `T_recovery_end` and `T_max` are added to critical times, but they're identical:

```typescript
const T_recovery_end = T_recovery_start + T_recovery;
const T_max = T_recovery_end;  // Redundant

// Later:
criticalTimes.add(T_recovery_start);
if (T_recovery > 0) criticalTimes.add(T_recovery_end);  // Added
criticalTimes.add(T_max);  // Also added (duplicate)
```

**Impact:** Harmless due to `Set` deduplication, but wasteful.

**Recommendation:**  
Remove `T_max` variable and use `T_recovery_end` directly:
```typescript
const T_recovery_end = T_recovery_start + T_recovery;

// ... later in critical times:
criticalTimes.add(T_recovery_end);  // Only add once
```

---

### 5. ⚠️ **Loss Value Validation Inconsistency**

**Severity:** MEDIUM  
**Location:** Lines 71-73

**Issue:**  
The code validates loss values but only warns and continues:

```typescript
if (L_no < 0 || L_no > 100 || L_with < 0 || L_with > 100) {
  console.warn('[Curve] Out-of-range loss values detected:', { L_no, L_with });
  // ← Continues execution with invalid values!
}
```

**Mathematical Risk:**  
Invalid loss values (e.g., `L_no = 150`) are clamped later:
```typescript
const capNo = clamp(100 - lossNo, 0, 100);  // capacity = 100 - 150 = -50 → 0
```

This silently corrects the error, potentially masking input bugs.

**Recommendation:**  
Either:
1. **Clamp inputs early**: `const L_no = clamp((input.loss_fraction_no_backup ?? 0) * 100, 0, 100);`
2. **Throw error**: `throw new Error('Loss values must be in range [0, 100]');`
3. **Return error state**: Return empty curve with error flag

---

## Minor Issues

### 6. 📝 **Inconsistent Comment Terminology**

**Location:** Line 41 comment vs. line 45 variable name

**Issue:**  
Comment says "T_backup_end" but code uses `T_backup`:
```typescript
// Comment: "T_backup_end: T_backup (when backup is exhausted...)"
const T_backup = input.backup_duration_hours ?? 0;  // Variable name doesn't match
```

Later:
```typescript
const T_backup_end = hasBackup ? T_backup : 0;  // Actual T_backup_end computed here
```

**Recommendation:**  
Clarify comment:
```
T_backup: User-specified backup duration (hours) from outage start
T_backup_end: Computed backup expiration time (T_backup if has backup, else 0)
```

---

### 7. 📝 **Final Point Addition Logic**

**Location:** Lines 206-220

**Issue:**  
The code checks if `T_max > lastT` to add a final point, but `T_max` is already in `criticalTimes`, so this condition is likely never true:

```typescript
const lastT = sortedCritical[sortedCritical.length - 1];
if (!seenTimes.has(T_max) && T_max > lastT) {  // T_max == lastT always
  // This block likely never executes
}
```

**Impact:** Dead code that never runs.

**Recommendation:**  
Remove this block or document why it exists (perhaps for future extensibility).

---

### 8. 📝 **Assertion Message Clarity**

**Location:** Lines 198-203 (invariant check)

**Issue:**  
The assertion checks with-backup ≥ without-backup, but only while `t <= T_backup_end`. However, due to Issue #1, this may not catch all violations.

**Recommendation:**  
Expand assertion to cover all time periods with additional context:
```typescript
if (hasBackup && capWith < capNo - 0.01) {
  const inBackupWindow = t <= T_backup_end;
  console.warn(
    `[Curve] Invariant violated: with-backup < without-backup at t=${t}h`,
    { capWith, capNo, inBackupWindow, T_backup_end }
  );
}
```

---

## Mathematical Verification

### Loss Function Properties

**Without Backup:**
```
L(t) = {
  0           if t < T_impact
  L_no        if T_impact ≤ t < T_outage
  L_no(1-f)   if T_outage ≤ t < T_outage + T_recovery  [f ∈ [0,1]]
  0           if t ≥ T_outage + T_recovery
}

where f = (t - T_outage) / T_recovery
```

**Properties:**
✓ Continuous (except at T_impact if L_no > 0)  
✓ Monotonic decreasing in recovery phase  
✓ Bounded: L(t) ∈ [0, L_no]

**With Backup (Current Implementation):**
```
L_with(t) = {
  L_with                  if t ≤ T_backup_end (and has backup)
  lossWithoutBackupAtTime(t)  otherwise
}
```

**Issue:** This creates discontinuity when T_backup_end < T_impact (Issue #1).

**Expected Implementation:**
```
L_with(t) = {
  L_with      if t ≤ T_backup_end (and has backup)
  L_no        if T_backup_end < t < T_outage
  L_no(1-f)   if T_outage ≤ t < T_outage + T_recovery
  0           if t ≥ T_outage + T_recovery
}
```

---

## Capacity Calculation Verification

**Formula:** `capacity = clamp(100 - loss, 0, 100)`

**Test Cases:**

| Loss (%) | Expected Capacity (%) | Actual (clamped) | Status |
|----------|----------------------|------------------|--------|
| 0        | 100                  | 100              | ✓      |
| 50       | 50                   | 50               | ✓      |
| 100      | 0                    | 0                | ✓      |
| -10      | 110                  | 100              | ✓ (clamped) |
| 150      | -50                  | 0                | ✓ (clamped) |

Clamping correctly handles edge cases, but masking is an issue (see Issue #5).

---

## Edge Case Analysis

### Case 1: No Service Required
```typescript
if (!input.requires_service) {
  points.push({ t_hours: 0, capacity_without_backup: 100, capacity_with_backup: 100 });
  return points;
}
```
✓ **Correct:** Returns flat 100% capacity curve.

### Case 2: Zero Recovery Time
```typescript
if (T_recovery <= 0) {
  return 0;  // Instant recovery
}
```
✓ **Correct:** Instant recovery to full capacity at T_outage.

### Case 3: Zero Backup Duration
```typescript
const T_backup_end = hasBackup ? T_backup : 0;
if (!hasBackup || T_backup_end <= 0) {
  return lossWithoutBackupAtTime(t);
}
```
✓ **Correct:** With-backup curve identical to without-backup.

### Case 4: Zero Impact Time
```typescript
if (T_impact > 0) criticalTimes.add(T_impact);
```
✗ **Issue:** T_impact=0 is not added to critical times, but lossWithoutBackupAtTime treats it as immediate impact. This is logically correct (outage starts immediately) but could skip the t=0 point if other critical times are non-zero.

Actually, `t=0` is always added (`criticalTimes.add(0);`), so this is fine.

### Case 5: Overlapping Time Horizons
See Issues #1 and #2 above.

---

## Recommendations Summary

### Priority 1 (Critical Fixes):
1. **Fix Issue #1:** Modify `lossWithBackupAtTime()` to handle post-backup-expiration loss without T_impact gating.
2. **Fix Issue #2:** Add validation to prevent or handle T_outage < T_impact scenarios.

### Priority 2 (Quality Improvements):
3. **Fix Issue #5:** Early-clamp or reject invalid loss values.
4. **Fix Issue #4:** Remove redundant T_max variable.
5. **Fix Issue #3:** Improve division-by-zero guard placement.

### Priority 3 (Documentation):
6. Clarify comments for time horizon variables.
7. Remove or document dead code (final point addition).
8. Enhance assertion messages with more context.

---

## Testing Recommendations

### Suggested Test Cases:

```typescript
// Test 1: Normal case
{ T_impact: 2, T_backup: 48, T_outage: 72, T_recovery: 24, L_no: 80, L_with: 20 }

// Test 2: Backup expires before impact (Issue #1)
{ T_impact: 48, T_backup: 24, T_outage: 72, T_recovery: 24, L_no: 80, L_with: 20 }

// Test 3: Recovery before impact (Issue #2)
{ T_impact: 72, T_backup: 96, T_outage: 48, T_recovery: 12, L_no: 80, L_with: 20 }

// Test 4: Zero recovery
{ T_impact: 2, T_backup: 48, T_outage: 72, T_recovery: 0, L_no: 80, L_with: 20 }

// Test 5: No backup
{ T_impact: 2, T_backup: 0, T_outage: 72, T_recovery: 24, L_no: 80, has_backup: false }

// Test 6: Invalid loss values (Issue #5)
{ T_impact: 2, T_backup: 48, T_outage: 72, T_recovery: 24, L_no: 150, L_with: -20 }

// Test 7: Instant impact
{ T_impact: 0, T_backup: 48, T_outage: 72, T_recovery: 24, L_no: 80, L_with: 20 }
```

---

## Conclusion

The curve generation algorithm is fundamentally sound but has **critical edge case issues** when time horizons overlap unexpectedly (Issues #1 and #2). These issues can produce illogical curves that don't match the physical model.

Mathematical operations (clamping, interpolation, loss-to-capacity conversion) are correct. The primary issues are logical consistency in time-based conditional branches.

**Recommended Action:** Implement Priority 1 fixes immediately to prevent illogical curve generation in production scenarios.

---

## Appendix: Function Call Graph

```
buildCurveDeterministic(input)
  ├─ effectiveHasBackup(input)
  ├─ lossWithoutBackupAtTime(t)
  │   └─ clamp(value, 0, 1)
  ├─ lossWithBackupAtTime(t)
  │   └─ lossWithoutBackupAtTime(t) [recursive]
  └─ clamp(capacity, 0, 100)
```

**Complexity:** O(n) where n = number of time points generated (~100-200 typical)
