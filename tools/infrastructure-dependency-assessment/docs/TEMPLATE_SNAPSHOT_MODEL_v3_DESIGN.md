# DOCX Template Redesign: Snapshot Model v3

## Executive Overview

The Asset Dependency Assessment report template has been redesigned to replace the legacy SAFE-style narrative structure with a **Snapshot-driven executive architecture** that directly mirrors the deterministic engine output.

**Date:** February 15, 2026  
**Version:** Snapshot Model v3  
**Status:** Template specification (engine logic unchanged)

---

## Core Design Principles

### What This Report IS:
- **Posture-driven**: Entire narrative shaped by overall risk posture classification
- **Driver-centered**: Vulnerabilities organized by deterministic risk drivers, not infrastructure silos
- **Deterministic**: Output matches engine calculations exactly; no subjective interpretation
- **Executive-facing**: Board-level brevity; designed for decision-makers in 10–15 min read

### What This Report Is NOT:
- A vulnerability table export
- A SAFE narrative extension
- An educational document
- A compliance checklist artifact
- A detailed technical assessment

---

## Report Structure

### SECTION 1 – COVER PAGE

**Content:**
- Title: "Asset Dependency Assessment"
- Subtitle: "Executive Infrastructure Risk Brief"
- Facility Name
- Assessment Date
- Classification banner (if required)

**Tone:** No descriptive paragraphs. No SAFE references.

---

### SECTION 2 – EXECUTIVE RISK POSTURE SNAPSHOT (FULL PAGE)

**Anchor:** `[[SNAPSHOT_POSTURE]]`, `[[SNAPSHOT_DRIVERS]]`, `[[SNAPSHOT_MATRIX]]`, `[[SNAPSHOT_CASCADE]]`

This is the anchor of the entire report. It is consumed at face value and drives all downstream section framing.

#### A. Overall Posture Classification
- **Visual:** Large, bold, centered
- **Format:** Single classification label (e.g., "ACCEPTABLE", "CONDITIONAL", "UNACCEPTABLE")
- **Engine Output:** Directly from posture classification engine

#### B. One-Sentence Posture Summary
- **Format:** Single declarative sentence
- **Example:** "This facility maintains adequate operational resilience under normal regional scenarios but faces compressed restoration timelines if correlated supply chain failures occur."

#### C. Key Risk Drivers (Horizontal or Stacked List)
- **Count:** 3–6 maximum
- **Order:** Deterministic (by engine-calculated magnitude)
- **Format:** Driver name only; no explanation
- **Anchor:** `[[SNAPSHOT_DRIVERS]]`

#### D. Infrastructure Exposure Matrix
- **Visual:** Table or grid
- **Columns:** Energy | Communications | IT | Water | Wastewater
- **Rows:** Exposure level (e.g., "HIGH", "MEDIUM", "LOW")
- **Anchor:** `[[SNAPSHOT_MATRIX]]`

#### E. Cascading Risk Indicator (Conditional)
- **Render Only If:** Cross-dependency failure scenario triggered
- **Format:** Single-line statement with time-to-cascade estimate
- **Anchor:** `[[SNAPSHOT_CASCADE]]`

**Critical Rule:** No narrative explanation. No doctrine. No system language.

---

### SECTION 3 – EXECUTIVE SUMMARY (MAX 2 PARAGRAPHS)

**Anchor:** `[[EXEC_SUMMARY]]`

#### Paragraph 1: Operational Dependency & Resilience Posture
- Operational dependency condition
- Backup capacity assessment
- Overall resilience posture relative to dependencies

#### Paragraph 2: Restoration Sensitivity & Correlated Risk
- Restoration sensitivity profile
- Correlated disruption implications
- Business continuity pressure under regional events

**Constraints:**
- No infrastructure definitions
- No FEMA preparedness explanation
- No SAFE explanation
- No educational filler
- No repetition of Snapshot wording

**Tone:** Board-level briefing. Direct. No filler.

---

### SECTION 4 – INFRASTRUCTURE ANALYSIS

Five separate sections, one per infrastructure:

**Anchors:**
- `[[INFRA_ENERGY]]`
- `[[INFRA_COMMS]]`
- `[[INFRA_IT]]`
- `[[INFRA_WATER]]`
- `[[INFRA_WASTEWATER]]`

#### Repeat for Each Infrastructure:

##### A. Operational Impact Profile
- Time-to-impact (hours, days)
- Operational degradation percentage
- Backup capacity condition
- Restoration window estimate

##### B. Driver-Based Vulnerability Themes
Each driver is rendered **once per infrastructure**. Drivers are:
1. External Supply Redundancy Deficiency
2. Physical Protection Deficiency
3. Continuity & Coordination Gaps
4. Data/Control System Resilience Deficiency
5. Regulatory Alignment & Coordination Deficiency

**Format per Driver:**

```
[Driver Name]
  - Vulnerability statement 1
  - Vulnerability statement 2
  - Vulnerability statement 3
```

**Rules:**
- Do NOT render raw question text
- Do NOT render system diagnostics
- Do NOT repeat identical driver descriptions across sectors (use infrastructure-specific language)

##### C. Options for Consideration
- Clean bullet format
- No duplication
- No placeholders
- No long explanatory paragraphs
- No generic remediation lists

---

### SECTION 5 – CROSS-INFRASTRUCTURE SYNTHESIS

**Anchor:** `[[SYNTHESIS]]`

**Purpose:** Elevate beyond sector silos. Surface interdependencies.

**Content:**
- Shared entry concentration (supply chain concentrations affecting multiple sectors)
- Correlated failure pathways (how failure in one infrastructure cascades to others)
- Restoration compression effects (why simultaneous restoration across sectors is difficult)
- Business continuity pressure under regional events (stress scenarios)

**Rules:**
- Do not restate Snapshot wording
- Do not restate driver strip verbatim
- Do not repeat Executive Summary
- Build analytically upward from section analysis

---

### SECTION 6 – APPENDIX A: STRUCTURED VULNERABILITY INDEX

**Anchor:** `[[APPENDIX_INDEX]]`

**Format:** Condensed reference table

| Infrastructure | Driver Theme | Vulnerability | Recommended Option |
|---|---|---|---|
| Energy | External Supply | … | … |
| (repeat as needed) | | | |

**Rules:**
- No narrative
- No duplication
- No blank rows
- No system commentary
- Reference only; does not repeat body analysis

---

### SECTION 7 – FOOTER

**Content:**
```
Asset Dependency Assessment Engine v3
Deterministic Snapshot Build
[Assessment Date]
[Facility Name]
```

**Style:** Small, subtle, footer position

---

## Anchor Mapping

### Old Anchors (LEGACY – DO NOT USE)
- `[[EXECUTIVE_SUMMARY_START]]`
- `[[TABLE_SUMMARY]]`
- `[[VISUALIZATION_START]]`
- `[[DEP_SUMMARY_TABLE]]`
- `[[TABLE_VOFC]]`
- `[[CHART_ELECTRIC_POWER]]`
- `[[CHART_COMMUNICATIONS]]`
- `[[CHART_INFORMATION_TECHNOLOGY]]`
- `[[CHART_WATER]]`
- `[[CHART_WASTEWATER]]`
- `[[SLA_PRA_SUMMARY]]`
- `[[CROSS_DEPENDENCY_SUMMARY]]`

### New Anchors (SNAPSHOT MODEL V3)

| Anchor | Purpose | Engine Output |
|---|---|---|
| `[[SNAPSHOT_POSTURE]]` | Overall posture classification | Posture classifier |
| `[[SNAPSHOT_DRIVERS]]` | Key risk drivers list | Driver ranking engine |
| `[[SNAPSHOT_MATRIX]]` | Infrastructure exposure matrix | Multi-infrastructure assessment |
| `[[SNAPSHOT_CASCADE]]` | Cascading risk indicator | Cross-dependency classifier |
| `[[EXEC_SUMMARY]]` | Executive summary narrative | Narrative builder |
| `[[INFRA_ENERGY]]` | Energy section | Energy-specific vulnerability builder |
| `[[INFRA_COMMS]]` | Communications section | Comms-specific vulnerability builder |
| `[[INFRA_IT]]` | IT section | IT-specific vulnerability builder |
| `[[INFRA_WATER]]` | Water section | Water-specific vulnerability builder |
| `[[INFRA_WASTEWATER]]` | Wastewater section | Wastewater-specific vulnerability builder |
| `[[SYNTHESIS]]` | Cross-infrastructure synthesis | Cross-dependency analysis engine |
| `[[APPENDIX_INDEX]]` | Vulnerability index table | Index generator |

---

## Content Removal

### DELETE ENTIRELY FROM TEMPLATE:

- "Infrastructure systems are the backbone…" (introductory paragraph)
- All SAFE references and framework language
- FEMA preparedness explanations
- Educational infrastructure definitions
- Master vulnerability tables in main body
- Legacy VOFC master table (replace with per-infrastructure sections)
- Legacy VOFC chart captions
- Any placeholder instructional text
- "Asset Dependency Visualization" section as separate entity
- "Vulnerabilities and Options for Consideration" as monolithic table

---

## Validation Checklist

After template rewrite, confirm:

- [ ] Snapshot appears on its own page before any narrative
- [ ] Report reads as executive brief (10–15 min estimated reading time)
- [ ] No SAFE-era language remains in any section
- [ ] No vulnerability tables dominate narrative sections
- [ ] Tone is deterministic and confident
- [ ] Structure mirrors UI hierarchy (Posture → Drivers → Exposure → Summary → Analysis)
- [ ] All infrastructure sections use consistent structure (Profile → Drivers → Options)
- [ ] Cross-infrastructure synthesis is truly analytical (not just a recount)
- [ ] Appendix contains only reference data (no narrative)
- [ ] All new anchors are present and positioned correctly
- [ ] All legacy anchors are removed
- [ ] Footer reflects v3 branding

---

## Implementation Notes

### Python Anchor Injection

The `inject_anchors_into_body.py` script automates anchor placement:

```bash
python apps/reporter/inject_anchors_into_body.py
```

**Updated Script Logic:**
1. Removes legacy markers and SAFE-era content blocks
2. Maps section headers to Snapshot Model v3 anchors
3. Inserts anchors in deterministic order following section headers
4. Validates all required anchors are present
5. Creates backup of original template before modification

### Engine Integration

The report generation engine must:
1. Populate `[[SNAPSHOT_POSTURE]]` with posture classification
2. Populate `[[SNAPSHOT_DRIVERS]]` with ranked driver list
3. Populate `[[SNAPSHOT_MATRIX]]` with infrastructure exposure grid
4. Populate `[[SNAPSHOT_CASCADE]]` only if cascading risk is triggered
5. Populate each `[[INFRA_*]]` anchor with infrastructure-specific content
6. Populate `[[SYNTHESIS]]` with cross-dependency analysis
7. Populate `[[APPENDIX_INDEX]]` with non-duplicated vulnerability reference

**No other anchors should be injected.**

---

## Migration Plan

### Phase 1: Template Rewrite (Current)
- [ ] Redesign DOCX template structure per v3 specification
- [ ] Test anchor placement with inject_anchors_into_body.py
- [ ] Validate all section headers and layouts
- [ ] Create annotated template with placeholder text

### Phase 2: Engine Adaptation (Next Phase)
- [ ] Update narrative builders to output to new anchors
- [ ] Implement Snapshot Posture builder
- [ ] Implement driver ranking and exposure matrix builder
- [ ] Update cross-dependency synthesis builder
- [ ] Test full report generation pipeline

### Phase 3: Validation (Final Phase)
- [ ] Generate test reports with various asset profiles
- [ ] Verify all anchors populate correctly
- [ ] Confirm tone and brevity meet specifications
- [ ] Test cross-infrastructure cascading scenarios

---

## Success Criteria

**Template Redesign Complete – Snapshot Model Aligned** when:

1. ✅ Snapshot appears before any narrative
2. ✅ Report reads as executive brief
3. ✅ No SAFE-era language remains
4. ✅ No vulnerability tables dominate narrative
5. ✅ Tone is deterministic and confident
6. ✅ Structure mirrors deterministic engine output
7. ✅ All new anchors functional
8. ✅ All legacy anchors removed
9. ✅ Validation suite passes

---

## Questions & Clarifications

**Q: Why no charts in the new template?**  
A: Charts were a SAFE-era visualization pattern. The Snapshot Model is text-driven, deterministic, and executive-facing. Exposure matrix provides sufficient visualization.

**Q: How do I handle infrastructure with no vulnerabilities?**  
A: Still render the section. State: "[Infrastructure] has no identified vulnerabilities under current assessment criteria." Then render Options as "No immediate action required."

**Q: What about PRA/SLA toggles?**  
A: Handled during assessment. Final report reflects user's gating choices. No conditional rendering in template; engine delivers final state.

**Q: Can I add my own narrative?**  
A: No. This is a deterministic snapshot of engine output. Modifications outside engine logic are out of scope.

---

## Document History

| Date | Version | Change |
|---|---|---|
| 2026-02-15 | v3 | Initial Snapshot Model specification |

