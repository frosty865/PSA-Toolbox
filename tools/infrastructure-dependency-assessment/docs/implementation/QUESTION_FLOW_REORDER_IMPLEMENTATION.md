# Question Flow Reorder – Implementation Guide
## Restore Dependency Methodology

**Objective:** Reorder question rendering so structural gateway questions precede operational impact curve on all 5 infrastructure tabs.

**Date:** February 15, 2026  
**Scope:** UI rendering order ONLY (no spec changes, no engine logic changes)

---

## Dependency Methodology Order

All infrastructure questionnaires must follow:

```
SECTION 1 – STRUCTURAL DEPENDENCY IDENTIFICATION
  Gateway questions establishing provider/connection exposure
  
SECTION 2 – PHYSICAL EXPOSURE CONDITIONS  
  Physical vulnerability of service components
  
SECTION 3 – COORDINATION & RESTORATION
  Restoration planning and continuity coordination
  
SECTION 4 – OPERATIONAL IMPACT PROFILE
  Curve mechanics (time-to-impact, degradation %, recovery)
```

---

## Current vs. New Order

### ELECTRIC POWER (Energy)

**Current Rendering Order:**
```
1. Curve questions (curve_requires_service through curve_recovery_time)
2. E-1 through E-11 (sequential)
```

**New Rendering Order:**
```
SECTION 1 – STRUCTURAL DEPENDENCY
  E-1: Can identify utility providers?
  E-2: Can identify upstream substations?
  E-3: More than one service connection?
  E-4: Physically separated connections?
  E-5: Single connection supports core ops?

SECTION 2 – PHYSICAL EXPOSURE
  E-6: Exterior electrical components protected?
  E-7: Exterior components exposed to vehicle impact?
  E-7a: Protective measures in place? (gated on E-7=yes)

SECTION 3 – COORDINATION & RESTORATION
  E-8: Backup power available?
  E-9: Refueling procedures established? (gated on E-8=yes)
  E-10: Backup tested under load? (gated on E-8=yes)
  E-11: Coordination with utility for restoration?

SECTION 4 – OPERATIONAL IMPACT PROFILE
  curve_requires_service
  curve_time_to_impact
  curve_loss_no_backup
  curve_backup_available
  curve_backup_duration (gated on backup_available=yes)
  curve_loss_with_backup (gated on backup_available=yes)
  curve_recovery_time
```

---

### COMMUNICATIONS (Comms)

**Current Rendering Order:**
```
1. Curve questions first
2. C-1 through C-10
```

**New Rendering Order (same pattern):**
```
STRUCTURAL (C-1 to C-5)
PHYSICAL EXPOSURE (C-6 to C-7a)
COORDINATION (C-8 to C-10 or equivalent)
OPERATIONAL CURVE (last)
```

---

### INFORMATION TECHNOLOGY (IT)

**Current Rendering Order:**
```
1. Curve questions
2. IT-1 through IT-8
```

**New Rendering Order:**
```
STRUCTURAL (IT-1 to IT-5)
PHYSICAL EXPOSURE (IT-6 to IT-7a or equivalent)
COORDINATION (IT-8+ or equivalent)
OPERATIONAL CURVE (last)
```

---

### WATER

**Current Rendering Order:**
```
1. Curve questions
2. W-1 through W-18
```

**New Rendering Order:**
```
STRUCTURAL (W-1 to W-7)
PHYSICAL EXPOSURE (W-8 to W-10 or equivalent)
COORDINATION (W-11+)
OPERATIONAL CURVE (last)
```

---

### WASTEWATER

**Current Rendering Order:**
```
1. Curve questions
2. WW-1 through WW-14
```

**New Rendering Order:**
```
STRUCTURAL (WW-1 to WW-7)
PHYSICAL EXPOSURE (WW-8 to WW-10)
COORDINATION (WW-11+)
OPERATIONAL CURVE (last)
```

---

##Implementation Rules

### 1. Rendering Reorganization  
- Move curve question rendering to **LAST** section
- Reorder E-1–E-11 into sections per above
- Add section header divs before each section
- Maintain internal question IDs (unchanged)

### 2. Section Headers
Add visible section headers in each tab:

``` tsx
<div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
  Structural Dependency Identification
</div>

<div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
  Physical Exposure Conditions
</div>

<div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
  Coordination & Restoration Planning
</div>

<div className="section-heading" style={{ fontSize: '1.1em', fontWeight: 600, marginTop: '1.5em', marginBottom: '0.75em' }}>
  Operational Impact Profile
</div>
```

### 3. Conditional Logic  
- **NO changes** to gating logic
- **NO changes** to visibility rules
- **NO changes** to trigger conditions
- Only change rendering sequence

### 4. Question Numbering
- visibleShots() remains unchanged
- "Question N of M" still numbered correctly
- Reordering is purely visual/UI

---

## Files to Modify

| File | Type | Questions | Status |
|---|---|---|---|
| `EnergyQuestionnaireSection.tsx` | Component | Curve + E-1 to E-11 | TO DO |
| `CommsQuestionnaireSection.tsx` | Component | Curve + C-1 to C-10 | TO DO |
| `ItQuestionnaireSection.tsx` | Component | Curve + IT-1 to IT-8 | TO DO |
| `WaterQuestionnaireSection.tsx` | Component | Curve + W-1 to W-18 | TO DO |
| `WastewaterQuestionnaireSection.tsx` | Component | Curve + WW-1 to WW-14 | TO DO |

**Spec files:** NO CHANGES (reordering is UI-only)

---

## Validation Checklist

After reordering, confirm for each infrastructure:

- [ ] Structural questions appear first (E-1 to E-5 for Energy)
- [ ] Physical exposure questions appear second
- [ ] Coordination questions appear third
- [ ] Curve questions appear last (all)
- [ ] Section headers are visible and correctly labeled
- [ ] Conditional logic still works (E-4 hidden if E-3=no, etc.)
- [ ] Question numbering "N of M" is correct
- [ ] No validation errors
- [ ] Trigger density output unchanged
- [ ] Snapshot output unchanged

---

## Rationale

Dependency methodology requires understanding **structure before consequence**:

1. **Structure First** – What are the dependency connections?
2. **Then Exposure** – How physically protected is the dependency?
3. **Then Coordination** – Is restoration planned for?
4. **Finally Consequence** – What's the operational impact if it fails?

Current flow (consequence first) is pedagogically backwards.

---

## Example: Energy After Reordering

```
─── STRUCTURAL DEPENDENCY IDENTIFICATION ───
Q1 of 24: Can the facility identify electric utility provider(s)?
Q2 of 24: Can the facility identify key upstream substation(s)?
Q3 of 24: Does the facility have more than one electric service connection?
Q4 of 24: Are service connections physically separated...?
Q5 of 24: Is at least one connection capable of supporting core ops independently?

─── PHYSICAL EXPOSURE CONDITIONS ───
Q6 of 24: Are exterior electrical components protected...?
Q7 of 24: Are exterior electrical components exposed to vehicle impact?
Q8 of 24: Are protective measures in place...? (if Q7=yes)

─── COORDINATION & RESTORATION PLANNING ───
Q9 of 24: Does the facility have backup power available?
Q10 of 24: Are refueling procedures established? (if Q9=yes)
Q11 of 24: Are backup power systems tested under load? (if Q9=yes)
Q12 of 24: Does the facility have coordination with utility for restoration?

─── OPERATIONAL IMPACT PROFILE ───
Q13 of 24: Does the facility require electric power for core operations?
Q14 of 24: Time-to-impact (without backup)?
Q15 of 24: Operational degradation percentage?
Q16 of 24: Is backup power available?
...
Q24 of 24: Post-restoration recovery duration?
```

---

## Questions Requiring Clarification

None. Specification is deterministic.

---

## Version

**v1.0** – February 15, 2026

