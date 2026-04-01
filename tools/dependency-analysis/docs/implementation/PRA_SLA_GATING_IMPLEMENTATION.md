# PRA/SLA Toggle Gating Implementation Summary

## Problem
PRA/SLA-only questions (e.g., W_Q6 "Does the facility participate in a priority restoration or coordinated restoration plan?") were rendering even when the PRA/SLA toggle was OFF. This gating failure prevented users from hiding these questions and caused unwanted findings to be generated.

## Solution
Implemented centralized PRA/SLA-based question visibility gating by:

1. **Adding scope metadata to questions** 
2. **Creating a centralized visibility filtering utility**
3. **Wiring the PRA/SLA toggle state through UI and backend pipelines**
4. **Filtering findings generation based on scope**
5. **Adding comprehensive regression tests**

---

## Changes Made

### 1. Question Metadata: Added `scope` Property

**Files Modified:**
- `apps/web/app/lib/dependencies/infrastructure/water_spec.ts`
- `apps/web/app/lib/dependencies/infrastructure/wastewater_spec.ts`

**What Changed:**
- Added optional `scope?: 'BASELINE' | 'PRA_SLA'` property to `WaterQuestionDef` and `WastewaterQuestionDef` types
- Marked PRA/SLA-only questions with `scope: 'PRA_SLA'`:
  - **Water:** W_Q6, W_Q7 (priority restoration & contingency plan)
  - **Wastewater:** WW_Q6, WW_Q7 (priority restoration & contingency plan)

**Example:**
```typescript
{
  id: 'W_Q6',
  prompt: 'Does the facility participate in a priority restoration or coordinated restoration plan...',
  answerType: 'enum',
  scope: 'PRA_SLA'  // NEW: marks this question as PRA/SLA-only
}
```

### 2. Centralized Visibility Filtering Utility

**File Created:**
- `apps/web/lib/dependencies/question-visibility.ts`

**Key Functions:**
- `shouldShowQuestion(questionId, scope, praSlaEnabled)`: Returns true if question should be visible
- `filterQuestionsByScope(questions, praSlaEnabled)`: Filters array of questions based on toggle state
- `isPraSlaQuestion(questionId)`: Identifies PRA/SLA-only questions
- **Safe Default:** When `praSlaEnabled=false` or `undefined`, all `scope='PRA_SLA'` questions are hidden

**Logic:**
```
if praSlaEnabled === true:
  → all questions visible (BASELINE+ PRA_SLA)

if praSlaEnabled === false or undefined:
  → only BASELINE questions visible (PRA_SLA hidden)
```

### 3. UI Integration: WaterQuestionnaireSection & WastewaterQuestionnaireSection

**Files Modified:**
- `apps/web/app/assessment/dependencies/water/WaterQuestionnaireSection.tsx`
- `apps/web/app/assessment/dependencies/wastewater/WastewaterQuestionnaireSection.tsx`

**What Changed:**
1. Added imports:
   - `useAssessment()` hook
   - `isPraSlaEnabled()` utility
   - `shouldShowQuestion()` from question-visibility

2. Added PRA/SLA state:
   ```typescript
   const { assessment } = useAssessment();
   const praSlaEnabled = isPraSlaEnabled(assessment);
   ```

3. Updated question filter logic to check scope:
   ```typescript
   {WATER_QUESTIONS.filter((q) => {
     // NEW: Check PRA/SLA gating FIRST
     if (!shouldShowQuestion(q.id, q.scope, praSlaEnabled)) return false;
     
     // Then apply progressive disclosure logic
     if (q.id === 'W_Q2' && answers.W_Q1_municipal_supply === 'no') return false;
     // ...
     return true;
   })}
   ```

**Result:** When PRA/SLA toggle is OFF, W_Q6 and WW_Q6 are never rendered in the DOM.

### 4. Vulnerability Generation Filtering

**Files Modified:**
- `apps/web/app/lib/dependencies/vulnerabilities/themeTypes.ts`
- `apps/web/app/lib/dependencies/vulnerabilities/theme_combiners/water.ts`
- `apps/web/app/lib/dependencies/vulnerabilities/theme_combiners/wastewater.ts`
- `apps/web/components/FindingsSummaryPanel.tsx`

**What Changed:**

1. **Type Update:** Added `praSlaEnabled?: boolean` to `ThemeResolverInput`
   ```typescript
   export type ThemeResolverInput = {
     category: '...';
     answers: Record<string, unknown>;
     praSlaEnabled?: boolean; // NEW: defaults to false (safe)
   };
   ```

2. **Theme Combiner Logic:** Conditional finding generation
   ```typescript
   export function resolveWaterThemes(input: ThemeResolverInput): ThemedFinding[] {
     const { answers, praSlaEnabled } = input;
     
     // Only evaluate W_Q6 if PRA/SLA is enabled
     const shouldCheckWq6 = praSlaEnabled === true;
     
     if (wq5 === 'no' || (shouldCheckWq6 && wq6 === 'no')) {
       // Generate finding only if relevant questions should be checked
     }
   }
   ```

3. **Component Integration:** FindingsSummaryPanel now passes toggle state
   ```typescript
   const { assessment } = useAssessment();
   const praSlaEnabled = isPraSlaEnabled(assessment);
   const themeInput: ThemeResolverInput = { 
     category: themeCategory, 
     answers,
     praSlaEnabled  // NEW: pass toggle state
   };
   ```

**Result:** 
- When PRA/SLA toggle is OFF: No W_NO_PRIORITY_RESTORATION or WW_NO_PRIORITY_RESTORATION findings are generated
- When PRA/SLA toggle is ON: All findings generated as normal

### 5. Regression Tests

**File Created:**
- `apps/web/app/lib/dependencies/vulnerabilities/__tests__/pra-sla-gating.test.ts`

**Test Coverage:**
- ✅ Question visibility filtering when toggle is OFF/ON
- ✅ PRA/SLA question identification
- ✅ Water themes: W_Q6 finding excluded when toggle OFF
- ✅ Wastewater themes: WW_Q6 finding excluded when toggle OFF
- ✅ BASELINE findings still generated (e.g., W_UPSTREAM_UNKNOWN)
- ✅ Safe defaults: `undefined` treated as `false`

**Example Test:**
```typescript
it('excludes W_NO_PRIORITY_RESTORATION finding when PRA/SLA is OFF', () => {
  const findings = resolveWaterThemes({
    category: 'WATER',
    answers: { W_Q6_priority_restoration: 'no' },
    praSlaEnabled: false
  });
  const hasW6Finding = findings.some((f) => f.id === 'W_NO_PRIORITY_RESTORATION');
  expect(hasW6Finding).toBe(false);
});
```

---

## Verification Checklist

- ✅ PRA/SLA OFF: W_Q6 and WW_Q6 not rendered in questionnaires
- ✅ PRA/SLA OFF: Related findings (W_NO_PRIORITY_RESTORATION, WW_NO_PRIORITY_RESTORATION) not generated
- ✅ PRA/SLA ON: Questions render normally
- ✅ PRA/SLA ON: All findings generated as before
- ✅ Toggling PRA/SLA immediately updates visibility (no reload required)
- ✅ Saved progress does not re-introduce gated questions
- ✅ BASELINE findings still generated when PRA/SLA OFF (e.g., provider identification)
- ✅ Comprehensive test coverage for gating scenarios

---

## Files Modified

### Core Logic
1. `apps/web/lib/dependencies/question-visibility.ts` (NEW)
2. `apps/web/app/lib/dependencies/infrastructure/water_spec.ts`
3. `apps/web/app/lib/dependencies/infrastructure/wastewater_spec.ts`
4. `apps/web/app/assessment/dependencies/water/WaterQuestionnaireSection.tsx`
5. `apps/web/app/assessment/dependencies/wastewater/WastewaterQuestionnaireSection.tsx`

### Findings/Vulnerabilities
6. `apps/web/app/lib/dependencies/vulnerabilities/themeTypes.ts`
7. `apps/web/app/lib/dependencies/vulnerabilities/theme_combiners/water.ts`
8. `apps/web/app/lib/dependencies/vulnerabilities/theme_combiners/wastewater.ts`

### UI Integration
9. `apps/web/components/FindingsSummaryPanel.tsx`

### Tests
10. `apps/web/app/lib/dependencies/vulnerabilities/__tests__/pra-sla-gating.test.ts` (NEW)

---

## PRA/SLA-Only Questions Identified

The following questions are marked as `scope: 'PRA_SLA'`:

| Category | Question ID | Prompt |
|----------|-----------|--------|
| Water | W_Q6 | Does the facility participate in a priority restoration or coordinated restoration plan with the water utility/provider? |
| Water | W_Q7 | Does the facility have a documented contingency/coordination plan with the water utility/provider for extended service disruption? |
| Wastewater | WW_Q6 | Does the facility participate in a priority restoration plan with the wastewater provider? |
| Wastewater | WW_Q7 | Does the facility have a documented contingency/coordination plan with the wastewater provider? |

---

## How It Works: Flow Diagram

```
User toggles PRA/SLA OFF
         ↓
Assessment.settings.pra_sla_enabled = false
         ↓
Components re-render (useAssessment hook triggers re-render)
         ↓
isPraSlaEnabled(assessment) returns false
         ↓
WaterQuestionnaireSection filter logic:
  for each question q:
    shouldShowQuestion(q.id, q.scope, false)
    → if q.scope === 'PRA_SLA': return false (hidden)
    → if q.scope === 'BASELINE' || undefined: return true (visible)
         ↓
W_Q6, W_Q7 not rendered in DOM
         ↓
FindingsSummaryPanel calls resolveWaterThemes({ ..., praSlaEnabled: false })
         ↓
Theme combiner skips W_Q6 evaluation:
  shouldCheckWq6 = false
  → W_NO_PRIORITY_RESTORATION finding not generated
         ↓
Review & Export shows no PRA/SLA findings
```

---

## Backward Compatibility

- Questions remain in the spec (no data deletion)
- Saved progress is preserved but hidden when scope is gated off
- When PRA/SLA is turned back ON, questions and findings reappear immediately
- Existing BASELINE questions unaffected by changes

---

## Future Enhancements

Potential scope expansions for centralized gating:
- Energy (E-11), Communications (CO-7), IT (IT-11) if moved to inline questions
- Cross-dependency questions (marked as CROSS_DEPENDENCY scope)
- Optional seasonal questions (SEASONAL scope)
