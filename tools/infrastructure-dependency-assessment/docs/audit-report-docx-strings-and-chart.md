# Audit Report: DOCX String Origins, Notes Column, and Comms PACE Chart

**Read-only audit.** No code changes. Evidence only.

---

## A) String origin map

### 1) "Not documented" / "Not documented in assessment input" / "not documented"

| Phrase | File | Function / line | Call chain into export |
|--------|------|-----------------|------------------------|
| `Not documented in assessment input.` | `apps/web/app/lib/report/cross_infrastructure_synthesis.ts` | `toSentence`-related fallbacks at 76, 114; `buildParagraph1`/`buildBullets` at 192, 226, 237, 250, 261; `toPlainSentence` at 286, 288, 296, 346, 364, 376 | Annex/narrative blocks → `buildVulnerabilityBlocks` / annex_content_builder → payload `report_vm.part2.vulnerabilities[].narrative` or structural/vuln blocks |
| `Not documented in assessment input.` | `apps/web/app/lib/report/vm_to_reporter_payload.ts` | Line 165: `ensureNonEmptyNarrative` default return | Payload sector narrative when no vulns triggered |
| `Not documented in assessment input.` | `apps/web/app/lib/report/synthesis_builder.ts` | Line 198: restoration prioritization gap | Themed/synthesis narrative |
| `Not documented in assessment input.` | `apps/web/app/lib/report/vulnerability/key_risk_driver_engine.ts` | Line 499: restoration sequencing fallback | Key risk / narrative |
| `Not documented.` | `apps/web/app/lib/report/cross_infrastructure_synthesis.ts` | Lines 284–288, 296, 309, 341, 346, 364, 376: `toPlainSentence` (null/empty/unknown → "Not documented.") | Same as above |
| `not documented in assessment input` | `apps/reporter/main.py` | Lines 1819, 1824: `build_sector_narrative` (activation delay; route independence) | Sector narrative written into DOCX (paragraphs), not table cells |
| `not documented in assessment input` | `apps/web/app/lib/report/vulnerability/condition_trigger_map.ts` | Line 872: IT multiple connections description | Condition-driven narrative → vulnerability text |
| `not documented in assessment input` | `apps/web/app/lib/dependencies/vulnerabilities/theme_combiners/it.ts` | Line 42 | Theme combiner narrative |
| `Not documented in assessment input` | `apps/web/app/lib/dependencies/knowledge_gaps/it.ts` | Line 37 | Knowledge-gap description |

**Summary:** "Not documented" wording is introduced in **TypeScript** (cross_infrastructure_synthesis, vm_to_reporter_payload, synthesis_builder, key_risk_driver_engine, condition_trigger_map, theme_combiners, knowledge_gaps) and in **Python** (main.py `build_sector_narrative`). It reaches the DOCX via vulnerability narratives, annex blocks, and sector narratives—**not** via the dependency summary table Notes cell (which is fed from `part2.dependency_summary_rows[].notes` or Python `build_summary` → `_sources_summary` / `normalize_note_text`).

---

### 2) "Documented sources" / "Sources provided: 1" / "sources:" notes

| Phrase | File | Function / line | Call chain into export |
|--------|------|-----------------|------------------------|
| `Sources provided: 1` | `packages/engine/src/summary.ts` | `sourcesSummary()` lines 23–24: when `!supply` or `!supply.has_alternate_source` | `buildSummary(assessment)` → row `.sources` → `buildPart2ForReport` → `buildDependencySummaryRows` → `notes: r.sources?.trim() \|\| '—'` → payload `part2.dependency_summary_rows[].notes` |
| `Sources provided: 1` | `apps/web/app/lib/export/build_part2_for_report.ts` | Line 112: `notesForRow()` when `demarc \|\| ind` (IT transport row) | `buildInternetTransportRows` → payload `part2.internet_transport_rows[].notes` |
| `Sources provided: 1` | `apps/reporter/main.py` | Line 984: IT transport table row notes when `notes_raw` empty and demarc/indep not "Not provided" | Fallback when building IT table from assessment (or part2); writes to INTERNET TRANSPORT table |
| `Sources provided: 1` | `apps/reporter/render_part2.py` | Line 304: same logic for IT transport notes | Same |
| `Sources provided: 1` | `apps/reporter/main.py` / `qc_pipeline.py` | Lines 5001–5008 (main), 323–327 (qc_pipeline): `sanitize_spof_language` replacement for "(SPOF likely)" / "SPOF likely" | Post-render QC: replaces SPOF phrasing in **paragraphs** with "Sources provided: 1" |

**Exact phrase "Documented sources" (or "Documented sources: 1"):**  
- **Not emitted by any current code.** It appears only in tests as a **forbidden** string: `apps/reporter/tests/test_docx_export_qc.py` lines 540, 564 assert that tables must **not** contain "Documented sources". So the phrase in a user screenshot likely came from (1) an older build, (2) a different code path that was since removed, or (3) Word list numbering rendering "1 " + "Sources provided: 1" so it was misread as "1 Documented sources: 1".

**Payload field names:**
- Dependency summary Notes: `payload.report_vm.part2.dependency_summary_rows[i].notes`
- Internet transport Notes: `payload.report_vm.part2.internet_transport_rows[i].notes`

---

## B) DOCX render point (dependency summary Notes and internet transport Notes)

### Dependency summary table (CORE INFRASTRUCTURE OVERVIEW)

- **Function:** `build_summary_table_at_anchor` in `apps/reporter/main.py` (lines 3288–3343) and mirror in `apps/reporter/render_part2.py` (lines 770–818).
- **Notes cell write:**  
  `table.rows[r].cells[5].text = sanitize_text(notes_cell)`  
  where `notes_raw = str(row_data.get("notes", SUMMARY_NOT_CONFIRMED_TEXT))` and `notes_cell = expand_acronym_in_text(notes_raw, acronyms_seen)`.  
  So the **exact** string is `row_data["notes"]` from `summary_rows` (either `part2["dependency_summary_rows"]` when `use_vm and part2`, or Python `build_summary(assessment)` otherwise).
- **Paragraph/style:** Cell text is set via python-docx `cell.text = ...`, which sets the **first paragraph** of the cell. No explicit style is set for this cell; the table is created with `insert_table_after` → `doc.add_table()`, so cells get the document default paragraph style (typically "Normal"). **No "List Number" or list style is applied to the dependency summary table cells in this code path.**

### Internet transport table

- **Function:** Same `build_summary_table_at_anchor` block (main.py 3355–3359, render_part2 equivalent) builds the transport block; the actual table is rendered via `replace_anchor_with_table_only` (or equivalent) with `block["rows"]` where row notes come from `part2.internet_transport_rows` or from Python-built IT rows. Notes column is the 5th column; cell text is set the same way (`cell.text = sanitize_text(...)`). **No List Number or numPr applied to these table cells in code.**

### Leading "1 " in Notes (numbering leak hypothesis)

- **Evidence in code:** There is **no** use of "List Number" or numbering style when writing the dependency summary or internet transport table cells. Both use `table.rows[r].cells[c].text = sanitize_text(...)`.
- **Possible causes:** (1) **Template inheritance:** If the DOCX template defines a style for table cell paragraphs that includes list numbering (numPr), new cells created with `doc.add_table()` might inherit that style in some Word versions. (2) **QC or another pass** that modifies table cell paragraphs and adds list formatting. (3) **Payload content:** If `notes` ever contained a literal "1 " (e.g. from a list serialization), it would appear as-is. Audit found no code that prepends "1 " to notes.
- **Conclusion:** The "leading 1 " is **not** introduced by the explicit table-render code. To confirm numPr/list style, the generated DOCX would need to be inspected (e.g. unzip and check `word/document.xml` for `w:numPr` or list style on the table cell paragraphs).

---

## C) Comms PACE chart: PRIMARY vs numeric truth (repro and evidence)

### Data flow

- **Input:** `categories.COMMUNICATIONS` from assessment (or export payload). Keys: `comm_pace_P`, `comm_pace_A`, `comm_pace_C`, `comm_pace_E`; each may have `effective_capacity_pct`, `sustain_hours`, `activate_after_hours`, `system_type`.
- **Reporter:** `main.py` → `build_pace_model_from_comm(cat_inp)` (lines 5863–5949) → `render_comms_pace_chart_png(pace_model, ...)` (lines 5958–6027). Chart is built in the same process that generates the DOCX (around 6476–6480).

### Root cause of PRIMARY mismatch

- When **any** PACE layer is viable (`has_pace = True`), the **PRIMARY** curve is built by **`build_primary()`** (lines 5911–5913), which uses:
  - `t_impact = inp.get("time_to_impact_hours") or inp.get("curve_time_to_impact_hours")`
  - `loss_no = loss_fraction_no_backup` (or curve variant)
  - `cap_after = 100 - loss_no`
  - `_primary_capacity_at_hour(h, t_impact, cap_after)` → 100% until `t_impact`, then `cap_after`.
- **`comm_pace_P` is not used for the PRIMARY curve** when `has_pace` is True. Only `comm_pace_A/C/E` are passed to `build_layer(raw, key)`, which uses `effective_capacity_pct` and `sustain_hours`. So:
  - **PRIMARY** plotted value = legacy single-step curve (time_to_impact_hours + loss_fraction_no_backup).
  - **ALTERNATE / CONTINGENCY / EMERGENCY** = from `comm_pace_A/C/E` (effective_capacity_pct, sustain_hours, etc.).

Therefore, if the user sets `comm_pace_P.effective_capacity_pct` to a non-zero value (e.g. 50), the chart will **not** show that for PRIMARY; it will show the legacy `cap_after` (e.g. 100 - loss_fraction_no_backup * 100). If legacy values are missing or zero, PRIMARY can appear as 0 or wrong.

### Reproducer

- **Script:** `apps/reporter/tools/repro_primary_chart_issue.py`
- **Usage:**  
  `python tools/repro_primary_chart_issue.py [path/to/assessment.json]`  
  Default path: `/mnt/data/asset-dependency-progress-2026-03-05.json` or env `ASSESSMENT_JSON`.
- **What it does:** Loads JSON, prints `comm_pace_P/A/C/E.effective_capacity_pct`, calls `build_pace_model_from_comm`, prints the computed PRIMARY/ALTERNATE/CONTINGENCY/EMERGENCY curve samples (t=0, 24, 96), reports mismatch when PRIMARY plotted value ≠ `comm_pace_P.effective_capacity_pct`, and dumps dependency summary Notes (from `part2.dependency_summary_rows` or Python `build_summary`).
- **Run with fixture:**  
  `python tools/repro_primary_chart_issue.py "D:\ADA\asset-dependency-tool\apps\web\app\lib\report\audit\fixtures\assessment_full.json"`  
  Result: PRIMARY curve = [100, 50, 50] (from legacy TTI=4, loss 0.5 → cap_after 50); `comm_pace_P.effective_capacity_pct` = None. Demonstrates that PRIMARY is legacy-driven, not PACE P-driven.

---

## D) Hypotheses (max 3, with evidence)

1. **PRIMARY line wrong or zero despite non-zero comm_pace_P.effective_capacity_pct**  
   **Evidence:** In `build_pace_model_from_comm`, when `has_pace` is True, the PRIMARY curve is built only by `build_primary()` using `time_to_impact_hours` and `loss_fraction_no_backup`. `comm_pace_P` is never passed to `build_layer`; its `effective_capacity_pct` and `sustain_hours` are not used for the PRIMARY series. So the chart’s PRIMARY line reflects legacy inputs, not PACE P. (File: `apps/reporter/main.py`, lines 5907–5913, 5933–5948.)

2. **Notes column shows “documented” wording**  
   **Evidence:** Dependency summary Notes come from (a) TS: `part2.dependency_summary_rows[].notes` set from engine `sourcesSummary()` → "Sources provided: 1" (packages/engine/src/summary.ts, build_part2_for_report.ts); (b) Python: when no part2, `build_summary` → `_sources_summary` (provider names) or "Provider identified." / "not confirmed". "Not documented" appears in narratives (cross_infrastructure_synthesis, vm_to_reporter_payload, main.py sector narrative) but is not the source of the table Notes cell text; the table uses only the `notes` field from summary rows.

3. **Leading “1 ” in Notes cell**  
   **Evidence:** The code that writes the Notes cell does not prepend "1 " and does not set List Number or any list style on table cells. So the leak is either (a) template paragraph style for table cells including numPr, or (b) another post-processing step. No numPr or "List Number" reference found in the dependency summary or internet transport table render path in main.py or render_part2.py.

---

## PowerShell search results (Step 1)

Searches were run with Get-ChildItem + Select-String (excluding node_modules, .venv, dist). Grep results (project code only) are summarized above. Full PowerShell output for the "Not documented" family included many .venv and test files; the authoritative string locations are the file/line table in Section A.

---

## Files opened for trace (Steps 2–3)

- **TS:** `apps/web/app/api/export/final/route.ts`, `apps/web/app/lib/export/build_part2_for_report.ts`, `packages/engine/src/summary.ts`, `apps/web/app/lib/report/vm_to_reporter_payload.ts`, `apps/web/app/lib/report/transport_concentration.ts`, `apps/web/app/lib/report/cross_infrastructure_synthesis.ts`
- **Python:** `apps/reporter/main.py` (build_summary_table_at_anchor, build_sector_narrative, build_pace_model_from_comm, render_comms_pace_chart_png, sanitize_spof_language), `apps/reporter/render_part2.py`, `apps/reporter/qc_pipeline.py`

No fixes were applied; this report is proof-only.
