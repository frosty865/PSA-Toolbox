# Part II – TECHNICAL ANNEX: Anchor Map (Federal-Style)

**Template file:** `ADA/report template.docx`  
**Single source of truth for required anchors:** `packages/schema/src/template_anchors.ts`

---

## Required structure in the template

Insert a **hard page break** immediately before the heading **PART II – TECHNICAL ANNEX**.  
Do **not** insert extra hard page breaks inside the vulnerability blocks.

Replace any existing "DEPENDENCY SUMMARY" through "INFRASTRUCTURE DEPENDENCY VULNERABILITIES AND OPTIONS FOR CONSIDERATION" scaffolding with **exactly** the following headings and anchors (each anchor on its own paragraph):

```
PART II – TECHNICAL ANNEX

DEPENDENCY SUMMARY
[[TABLE_DEPENDENCY_SUMMARY]]

STRUCTURAL RISK PROFILE
[[STRUCTURAL_PROFILE_SUMMARY]]

INFRASTRUCTURE VULNERABILITIES
[[VULNERABILITY_COUNT_SUMMARY]]
[[VULNERABILITY_BLOCKS]]

CROSS-INFRASTRUCTURE ANALYSIS
[[CROSS_INFRA_ANALYSIS]]
```
(The Annex ends with CROSS-INFRASTRUCTURE ANALYSIS. The MODELED DISRUPTION CURVES section has been removed.)

---

## Part II required anchors (exact strings)

| Anchor | Content injected |
|--------|------------------|
| `[[TABLE_DEPENDENCY_SUMMARY]]` | Dependency summary table (Category \| Provider \| Backup \| Time to Impact \| Recovery \| Notes). |
| `[[STRUCTURAL_PROFILE_SUMMARY]]` | Short paragraph (1–3 sentences) summarizing structural sensitivity and main drivers. |
| `[[VULNERABILITY_COUNT_SUMMARY]]` | 2–3 lines: count of findings + number HIGH/ELEVATED/MODERATE. |
| `[[VULNERABILITY_BLOCKS]]` | Full federal-style vulnerability blocks (options cap 4 per vulnerability). |
| `[[CROSS_INFRA_ANALYSIS]]` | Cross-infrastructure synthesis content. Annex ends here. |

---

## Full required anchor list (Part I + Part II)

**Part I (unchanged):**  
`[[SNAPSHOT_POSTURE]]`, `[[SNAPSHOT_SUMMARY]]`, `[[SNAPSHOT_DRIVERS]]`, `[[SNAPSHOT_MATRIX]]`, `[[SNAPSHOT_CASCADE]]`,  
`[[CHART_ELECTRIC_POWER]]`, `[[CHART_COMMUNICATIONS]]`, `[[CHART_INFORMATION_TECHNOLOGY]]`, `[[CHART_WATER]]`, `[[CHART_WASTEWATER]]`,  
`[[SYNTHESIS]]`, `[[PRIORITY_ACTIONS]]`

**Part II (federal-style):**  
`[[TABLE_DEPENDENCY_SUMMARY]]`, `[[STRUCTURAL_PROFILE_SUMMARY]]`, `[[VULNERABILITY_COUNT_SUMMARY]]`, `[[VULNERABILITY_BLOCKS]]`, `[[CROSS_INFRA_ANALYSIS]]`

**Total:** 17 required anchors. Each must appear **exactly once**.  
**Deprecated (remove from template):** `[[DEP_SUMMARY_TABLE]]`, `[[VULN_NARRATIVE]]`, `[[INFRA_*]]`, and other legacy anchors.

---

## Validation

From repo root (PowerShell):

```powershell
pnpm template:check
```

Must pass before export will succeed.
