# Snapshot Model v3 – Template Builder Quick Reference

## Quick Setup

```bash
# 1. Edit Asset Dependency Assessment Report_BLANK.docx with your new structure
#    (Follow the section layout in TEMPLATE_SNAPSHOT_MODEL_v3_DESIGN.md)

# 2. Inject anchors automatically
python apps/reporter/inject_anchors_into_body.py

# 3. Verify output
# → Creates _dev_with_anchors.docx with all anchors in place
```

---

## Template Structure at a Glance

```
┌─────────────────────────────────────┐
│ COVER PAGE                          │
│ - Title, subtitle, facility, date   │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[SNAPSHOT_POSTURE]]                │
│ [[SNAPSHOT_DRIVERS]]                │
│ [[SNAPSHOT_MATRIX]]                 │
│ [[SNAPSHOT_CASCADE]]                │
│ (Full-page executive posture)       │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[EXEC_SUMMARY]]                    │
│ (Max 2 paragraphs)                  │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[INFRA_ENERGY]]                    │
│ - Profile / Drivers / Options       │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[INFRA_COMMS]]                     │
│ [[INFRA_IT]]                        │
│ [[INFRA_WATER]]                     │
│ [[INFRA_WASTEWATER]]                │
│ (Same structure, per infrastructure)│
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[SYNTHESIS]]                       │
│ (Cross-infrastructure analysis)     │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ [[APPENDIX_INDEX]]                  │
│ (Vulnerability reference table)     │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│ FOOTER                              │
│ Asset Dependency Assessment v3      │
└─────────────────────────────────────┘
```

---

## Anchor Reference

| Anchor | Location | Content | Format |
|---|---|---|---|
| `[[SNAPSHOT_POSTURE]]` | Top of Posture Snapshot | Classification + 1-sentence summary | Text (bold, centered) |
| `[[SNAPSHOT_DRIVERS]]` | Below summary | 3–6 key drivers in ranked order | Bulleted list |
| `[[SNAPSHOT_MATRIX]]` | Below drivers | Infrastructure exposure grid | Table (5 columns) |
| `[[SNAPSHOT_CASCADE]]` | Below matrix | Cascading risk (if triggered) | Single-line conditional text |
| `[[EXEC_SUMMARY]]` | Executive Summary section | 2-paragraph narrative | Body text, no bullets |
| `[[INFRA_ENERGY]]` | Energy section | Impact + Drivers + Options | Structured text |
| `[[INFRA_COMMS]]` | Communications section | Impact + Drivers + Options | Structured text |
| `[[INFRA_IT]]` | IT section | Impact + Drivers + Options | Structured text |
| `[[INFRA_WATER]]` | Water section | Impact + Drivers + Options | Structured text |
| `[[INFRA_WASTEWATER]]` | Wastewater section | Impact + Drivers + Options | Structured text |
| `[[SYNTHESIS]]` | Cross-Infrastructure section | Shared risks, cascades, compression | Narrative text |
| `[[APPENDIX_INDEX]]` | Appendix A | Infrastructure | Driver | Vuln | Option | Table (4 columns) |

---

## Template Text Guidelines

### DO ✅

- Use deterministic language ("is", "will", "has", "demonstrates")
- Keep sentences short and declarative
- Lead with risk posture, not complexity
- Use consistent terminology across sections
- Number time estimates (hours, days, minutes)
- State percentages explicitly (e.g., "45% operational degradation")

### DON'T ❌

- Use hedging language ("may", "might", "could", "potentially")
- Explain what infrastructure systems are (educational)
- Reference SAFE, FEMA, or frameworks
- Use placeholder text or field instructions
- Repeat Snapshot wording in Executive Summary
- Include vulnerability tables in body (reference only in Appendix)
- Mix narrative and tabular formats in same section
- Render questions or assessment metadata

---

## Driver Structure (Per Infrastructure)

Each infrastructure section contains:

```
OPERATIONAL IMPACT PROFILE
  Time to Impact: [X hours]
  Operational Degradation: [X%]
  Backup Capacity: [description]
  Restoration Window: [X hours/days]

[DRIVER 1 NAME]
  - Vulnerability bullet 1
  - Vulnerability bullet 2
  - Vulnerability bullet 3

[DRIVER 2 NAME]
  - Vulnerability bullet 1
  - Vulnerability bullet 2
  - Vulnerability bullet 3

(Repeat for each applicable driver)

OPTIONS FOR CONSIDERATION
  - Option 1
  - Option 2
  - Option 3
```

---

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Including question text in body | Reference only driver/vulnerability themes; remove IDs |
| Repeating Snapshot in Executive Summary | Summarize dependencies and restoration, not posture |
| Monolithic vulnerability table | Break into per-driver sections within each infrastructure |
| Hedging language ("may impact") | Use definitive language ("impacts") |
| Educational explanations | Remove definitions; assume board-level knowledge |
| Blank sections | Always render at minimum: "No vulnerabilities identified" |
| Missing cascading context | In Synthesis, explicitly state failure pathways |
| Generic options | Tailor options to infrastructure and drivers identified |

---

## Testing Checklist

Before deployment:

- [ ] All 12 anchors present and positioned correctly
- [ ] No legacy anchors remain (`[[TABLE_VOFC]]`, `[[CHART_*]]`, etc.)
- [ ] Snapshot page is self-contained and visually distinct
- [ ] Executive summary is 2–3 paragraphs maximum
- [ ] Each infrastructure section follows same structure
- [ ] No raw question IDs or metadata in body
- [ ] No SAFE/FEMA/framework references
- [ ] Appendix table matches per-infrastructure counts (no blanks)
- [ ] Font sizes and styling are consistent
- [ ] Footer appears on every page
- [ ] No placeholder text remains
- [ ] Tone is executive and deterministic throughout

---

## Debug Commands

```bash
# Verify anchors in template
python -c "
from docx import Document
doc = Document('Asset Dependency Assessment Report_BLANK.docx')
anchors = [p.text for p in doc.paragraphs if '[[' in p.text and ']]' in p.text]
for a in sorted(set(anchors)):
    print(a)
"

# List all section headers
python -c "
from docx import Document
doc = Document('Asset Dependency Assessment Report_BLANK.docx')
for i, p in enumerate(doc.paragraphs):
    if p.style.name.startswith('Heading'):
        print(f'{i}: [{p.style.name}] {p.text}')
"

# Run anchor injection with verbose output
python apps/reporter/inject_anchors_into_body.py -v
```

---

## Support

For issues or clarifications:

1. Consult [`TEMPLATE_SNAPSHOT_MODEL_v3_DESIGN.md`](./TEMPLATE_SNAPSHOT_MODEL_v3_DESIGN.md) (specification)
2. Review test artifacts in `archive/2026-02/test_artifacts/`
3. Check Python script logs from anchor injection
4. Validate against validation checklist above

---

## Version

**Snapshot Model v3**  
February 15, 2026

