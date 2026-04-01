# Template: Section C → Operational Capability Curves

**For template authors:** Update `ADA/report template.docx` as follows so Part I is brief + curves only; Part II owns detailed narrative.

---

## 1. Rename Section C

- **Change heading text:**  
  `C. SECTOR ANALYSIS` → **`C. OPERATIONAL CAPABILITY CURVES`**
- The reporter only removes the **legacy** heading "C. SECTOR ANALYSIS" if present. It does **not** remove "C. OPERATIONAL CAPABILITY CURVES".

---

## 2. Remove Part I sector subheadings from Section C

- **Remove** the five Part I sector subheadings under Section C that appear in the TOC:
  - ELECTRIC POWER  
  - COMMUNICATIONS  
  - INFORMATION TECHNOLOGY  
  - WATER  
  - WASTEWATER  
- These must **not** be Heading 3 (or equivalent) items in Part I anymore. Section C should contain only the chart anchors (and any single Section C heading), not per-sector headings.

---

## 3. Keep chart anchors grouped in Section C

Keep these five anchors in Section C, in order:

- `[[CHART_ELECTRIC_POWER]]`
- `[[CHART_COMMUNICATIONS]]`
- `[[CHART_INFORMATION_TECHNOLOGY]]`
- `[[CHART_WATER]]`
- `[[CHART_WASTEWATER]]`

The reporter inserts a centered Heading 3 label (e.g. "Electric Power") above each chart image, then the image, then the caption. No INFRA_* anchors in Part I.

---

## 4. Remove Part I INFRA_* narrative anchors

- **Remove** from Part I (or leave out of template entirely):
  - `[[INFRA_ENERGY]]`
  - `[[INFRA_COMMS]]`
  - `[[INFRA_IT]]`
  - `[[INFRA_WATER]]`
  - `[[INFRA_WASTEWATER]]`
- These are **no longer required**. Narrative is only in Part II at `[[VULN_NARRATIVE]]`.

---

## 5. TOC and heading levels

- **PART I** / **PART II**: use **Heading 1**.
- **A / B / C / D / E** (e.g. A. Executive Summary, B. …, C. Operational Capability Curves, …): use **Heading 2**.
- **Do not** use Heading 3 in Part I for the five sector names (Electric Power, etc.); Section C has no per-sector subheadings in Part I.
- In Part II, sector headers may be Heading 2 or 3 as desired; if you do **not** want them in the TOC, use a style that is excluded from the TOC.

This avoids split sections and duplicate sector entries in the TOC.

---

## 6. Validation

After editing the template:

```bash
pnpm template:check
```

Required anchors (no INFRA_* in template):

- Part I: `[[SNAPSHOT_POSTURE]]`, `[[SNAPSHOT_SUMMARY]]`, `[[SNAPSHOT_DRIVERS]]`, `[[SNAPSHOT_MATRIX]]`, `[[SNAPSHOT_CASCADE]]`, `[[CHART_ELECTRIC_POWER]]`, `[[CHART_COMMUNICATIONS]]`, `[[CHART_INFORMATION_TECHNOLOGY]]`, `[[CHART_WATER]]`, `[[CHART_WASTEWATER]]`, `[[SYNTHESIS]]`, `[[PRIORITY_ACTIONS]]`
- Part II: `[[DEP_SUMMARY_TABLE]]`, `[[VULN_NARRATIVE]]`
