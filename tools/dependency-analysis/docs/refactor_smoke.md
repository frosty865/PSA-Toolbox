# Review & Export Refactoring — Smoke Test Checklist

**Date**: 2026-02-13  
**Branch**: `refactor/ui-archive`  
**Objective**: Verify that legacy Review & Export removal and consolidation maintains deterministic behavior.

---

## Pre-Refactor Baseline

Record observations BEFORE starting refactor:

- [ ] **Navigation**: Can navigate to Category Data → Review & Export tab without errors
- [ ] **Empty state**: Verify empty state styling (no table headers visible when no findings)
- [ ] **Sample data**: Load a test assessment with findings, observe card-based layout
- [ ] **Export JSON**: Export JSON (canonical) produces valid output
- [ ] **Export DOCX**: Export report (DOCX) generates without errors
- [ ] **PRA/SLA toggle**: Toggle ON/OFF, observe findings list updates deterministically
- [ ] **Cross-Dependency toggle**: Toggle ON/OFF, cascade box appears/disappears correctly
- [ ] **Determinism**: Same inputs produce same outputs (run twice, compare exports)

---

## Post-Refactor Verification

Run IMMEDIATELY after archive + consolidation:

### Core Navigation & Rendering
- [ ] **Category Data tab**: Renders without console errors
  - [ ] Empty assessment: shows appropriate empty state (no legacy table)
  - [ ] With findings: shows modern card layout (not table)
- [ ] **Review page** (`/assessment/review`): Renders without errors
  - [ ] Status strip displays (badges, completion %)
  - [ ] Executive summary section collapsible
  - [ ] Infrastructure sections expand/collapse (5 cards: Power, Comms, IT, Water, Wastewater)
  - [ ] Cross-dependency section visible (when enabled)
  - [ ] Synthesis section visible
  - [ ] Export panel sticky at bottom

### Export Functions
- [ ] **Export JSON**: Produces canonical output
  - [ ] File size > 0
  - [ ] Valid JSON structure (parseability test)
  - [ ] No SAFE references in JSON
- [ ] **Export DOCX**: Report generation succeeds
  - [ ] File downloads
  - [ ] File size > 50KB (sanity check)
  - [ ] Word document opens without corruption
  - [ ] Narrative sections present (Executive Summary, Infrastructure, etc.)

### Toggle Behavior
- [ ] **PRA/SLA OFF** (default): Findings list same as pre-refactor
- [ ] **PRA/SLA ON**: Priority Restoration findings appear in export
  - [ ] Source labeled correctly ("Priority restoration" not a legacy table tag)
- [ ] **Cross-Dependency OFF** (default): Cascade box hidden
- [ ] **Cross-Dependency ON**: Cascade findings render

### String Verification
- [ ] **No legacy strings in UI**:
  - [x] "Ensure the VOFC library is configured" — MUST NOT appear
  - [x] "Choose an item." — MUST NOT appear
  - [x] "Option for Consideration" (as table header) — MUST NOT appear
  - [x] "Source" (as legacy table column) — MUST NOT appear
- [ ] **No SAFE references** displayed to user
- [ ] **No internal IDs** in UI (uuid, source_id, etc. hidden)

### Determinism
- [ ] **Same assessment, two exports**:
  1. Export JSON snapshot 1
  2. Export JSON snapshot 2
  3. SHA256 hashes must match (indicates deterministic engine)
- [ ] **Toggle combinations**: PRA + CD both ON/OFF, verify consistent results

---

## Browser Console Check

After each major action:
- [ ] **No console errors** (excluding known warnings)
- [ ] **No "undefined" references**
- [ ] **No failed imports**

---

## Rollback Procedure (if needed)

```bash
git checkout main
git branch -D refactor/ui-archive
# Restore original state
```

---

## Sign-Off

- **Tester**: ___________________
- **Date**: ___________________
- **Status**: ☐ PASS ☐ FAIL (if fail, document issues below)

### Issues Found:
```
(Document any failures here with line numbers, component names, and reproduction steps)
```

