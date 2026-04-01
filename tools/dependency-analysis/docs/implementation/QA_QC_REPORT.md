# QA/QC Report: Asset Dependency Tool

**Date:** 2025-02-11  
**Scope:** Form, function, and uniformity across the assessment flow

---

## Executive Summary

A top-to-bottom QA/QC review was conducted. Several issues were identified and fixed. Remaining recommendations are documented for future work.

---

## Form (Layout, Styling, Structure)

### Fixes Applied

1. **Impact Curve Configuration** — All five dependency tabs (Electric Power, Communications, IT, Water, Wastewater) now use the shared `ImpactCurveConfigCard` component with consistent styling.
2. **Wastewater embedded heading** — When embedded on the categories page, Wastewater now uses h3 with the same pattern as Water/IT/Energy (`Wastewater — Infrastructure (WW-1–WW-10)`).
3. **DependencyGapsSection uniformity** — Supply Chain & Maintenance section added to Electric Power, Water, and Wastewater tabs (previously only on IT and Communications).

### Structure Overview

| Tab | Impact Curve Config | Main Questionnaire | DependencyGapsSection | Chart |
|-----|---------------------|--------------------|-----------------------|-------|
| Electric Power | ✓ (in form) | Energy E-1–E-11 | ✓ (added) | ✓ |
| Communications | ✓ (text only) | CO-1–CO-11 | ✓ | ✓ |
| IT | ✓ | IT-1–IT-11 + Cyber/Continuity | ✓ | ✓ |
| Water | ✓ | WA-1–WA-10 | ✓ (added) | ✓ |
| Wastewater | ✓ | WW-1–WW-10 | ✓ (added) | ✓ |

---

## Function (Data Flow, Validation, Save/Load)

### Fixes Applied

1. **Comms CO-1 through CO-11 questions** — Replaced placeholder card with actual question blocks. Users can now answer all main CO questions; curve is derived from answers.
2. **Comms useEffect payload guard** — Added `lastCurvePayloadRef` to avoid update loops when `onCurveDataChange` is called (same pattern as Water, Wastewater, IT).
3. **onPriorityRestorationChange stale closure** — Switched from `setAssessment({ ...assessment, ... })` to `setAssessment((prev) => ({ ...prev, ... }))` to avoid stale `assessment` in callbacks.

### Existing Behavior (Verified)

- **Save Progress** — Exports assessment + energy + comms to JSON.
- **Load Progress** — Imports and merges assessment, restores energy/comms from storage.
- **Clear Session / Wipe local data** — Clears in-memory and local storage.
- **Chart data** — Built from category input; `onCurveDataChange` syncs questionnaire-derived data to assessment.

### Remaining Functional Notes

1. **Comms repeatable tables** — CO-1 (providers), CO-2 (assets), CO-4 (connections), CO-6 (protections), CO-8 (backup capabilities) have `answerType: 'repeatable'` but currently show only Yes/No/Unknown. Full table UIs (like Energy) are not yet implemented.
2. **Comms CO-backup_adequacy, CO-backup_tested, CO-restoration_coordination** — Use enum schemas; not yet rendered (specialized UI required).
3. **Energy/Comms persistence** — Use `getCommsAnswersForUI` / `loadEnergyFromLocal` for session restore; assessment categories are separate. Sync between them is handled by `onCurveDataChange`.

---

## Uniformity (Patterns, Components)

### Patterns

- **QuestionBlock** — Each questionnaire defines its own; signatures vary (questionId vs number, etc.). Consider extracting a shared component.
- **YesNoRow / YesNoUnknownRow** — Defined per file; could be unified.
- **Embedded heading** — Electric Power, Water, IT, Comms use `h3` when embedded; Wastewater aligned.

### Toggle Components

- **PRA/SLA** and **Cross-Dependency** — Use shared slider styling (`.pra-sla-toggle`), same layout.

### Chart Legend

- Legend (Without Backup, With Backup, SLA Target) is below the graph via Recharts `Legend` with `verticalAlign="bottom"`.

---

## Recommendations for Future Work

1. **Comms repeatable tables** — Add table UIs for CO-1 (providers), CO-2 (assets), CO-4, CO-6, CO-8 when the user selects Yes.
2. **Comms backup/restoration questions** — Add UI for CO-backup_adequacy, CO-backup_tested, CO-restoration_coordination (enums).
3. **Maximum update depth** — If it recurs on IT tab, review `existingItCategory` in useEffect deps and sync logic.
4. **Shared QuestionBlock** — Create a common component to reduce duplication across questionnaires.
5. **DependencySection for Critical Products** — Uses UI_CONFIG + FieldInput; different from questionnaire sections. No change needed unless workbook alignment requires it.

---

## Files Modified in This QA Pass

- `apps/web/app/assessment/categories/page.tsx` — DependencyGapsSection, onPriorityRestorationChange
- `apps/web/app/assessment/dependencies/communications/CommsQuestionnaireSection.tsx` — CO questions, useEffect guard
- `apps/web/app/assessment/dependencies/wastewater/WastewaterQuestionnaireSection.tsx` — Embedded heading
