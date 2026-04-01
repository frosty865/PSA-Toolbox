# DOCX ANCHOR RECONSTRUCTION – SNAPSHOT MODEL v3

**TEMPLATE + EXPORT MAPPING ALIGNMENT**  
**NO ENGINE LOGIC CHANGES**

**Updated:** February 15, 2026  
**Status:** Snapshot Model v3 Active

---

## Objective

Resolve "template missing anchors" error by rebuilding the DOCX template anchor structure to match Snapshot-driven export model.

---

## STEP 1 – REMOVE LEGACY ANCHORS

Open the DOCX template:
- **File:** `assets/templates/Asset Dependency Assessment Report_BLANK.docx`
- Open in Microsoft Word

**Remove any legacy placeholders such as:**
- `[[TABLE_SUMMARY]]`
- `[[VISUALIZATION_START]]`
- `[[TABLE_VOFC]]`
- `[[CHART_ELECTRIC_POWER]]`
- `[[CHART_COMMUNICATIONS]]`
- `[[CHART_INFORMATION_TECHNOLOGY]]`
- `[[CHART_WATER]]`
- `[[CHART_WASTEWATER]]`
- `[[CHART_*]]`
- `[[SAFE_*]]`
- `[[LEGACY_*]]`
- `[[TABLE_CRITICAL_PRODUCTS]]`

**These are obsolete and must not exist in template.**

To find them:
1. Press **Ctrl+F** in Word
2. Search for `[[` to find all anchors
3. Delete each legacy anchor paragraph

---

## STEP 2 – INSERT REQUIRED SNAPSHOT ANCHORS

**Critical Rules:**
- Case-sensitive
- Bracket-sensitive  
- No extra spaces
- Each anchor on its own paragraph line
- Do NOT put anchors in headers, footers, text boxes, or tables

**How to insert:**
1. Click where content should appear
2. Press **Enter** to create new paragraph
3. Type or paste anchor exactly
4. Press **Enter** after anchor to isolate it

**Turn on paragraph marks (¶):**
- **Home** tab → click **¶** icon to verify each anchor is on own line

---

### COVER PAGE (Optional Dynamic Fields)

```
[[FACILITY_NAME]]
[[ASSESSMENT_DATE]]
```

**Placement:** Where facility name and date should appear on cover page.

**Title page graphic:** Keep the cover graphic in its **own** paragraph with **no** anchors and **no** dynamic fields. Do **not** put any `[[ANCHOR]]` or `[[PSA_*]]` in the same paragraph or run as the image. If the image is floating, anchor it to a blank paragraph (e.g. a space) that has no anchors. This prevents the reporter from removing or damaging the graphic.

---

### SECTION 1 – EXECUTIVE RISK POSTURE SNAPSHOT

```
[[SNAPSHOT_POSTURE]]
[[SNAPSHOT_SUMMARY]]
[[SNAPSHOT_DRIVERS]]
[[SNAPSHOT_MATRIX]]
[[SNAPSHOT_CASCADE]]
```

**Placement:**
- `[[SNAPSHOT_POSTURE]]` – Where overall risk classification appears (e.g., "ACCEPTABLE")
- `[[SNAPSHOT_SUMMARY]]` – Where one-sentence posture summary appears
- `[[SNAPSHOT_DRIVERS]]` – Where key risk drivers list appears (3-6 items)
- `[[SNAPSHOT_MATRIX]]` – Where infrastructure exposure matrix/table appears
- `[[SNAPSHOT_CASCADE]]` – Where cascading risk indicator appears (conditional)

**This section should appear on its own page before any narrative content.**

---

### SECTION 2 – EXECUTIVE SUMMARY

```
[[EXEC_SUMMARY]]
```

**Placement:** Where executive narrative summary should appear  
**Purpose:** Board-level briefing paragraph (deterministic, posture-driven)

---

### SECTION 3 – INFRASTRUCTURE SECTIONS

```
[[INFRA_ENERGY]]
[[INFRA_COMMS]]
[[INFRA_IT]]
[[INFRA_WATER]]
[[INFRA_WASTEWATER]]
```

**Placement:**
- `[[INFRA_ENERGY]]` – Under "Energy" or "Electric Power" section header
- `[[INFRA_COMMS]]` – Under "Communications" section header
- `[[INFRA_IT]]` – Under "Information Technology" section header
- `[[INFRA_WATER]]` – Under "Water" section header
- `[[INFRA_WASTEWATER]]` – Under "Wastewater" section header

**Structure:** Profile → Drivers → Options for Consideration

---

### SECTION 4 – CROSS-INFRASTRUCTURE SYNTHESIS

```
[[SYNTHESIS]]
```

**Placement:** Under "Cross-Infrastructure Analysis" or "Synthesis" section header  
**Purpose:** Analytical narrative on cross-dependency patterns (not just recounting)

---

### APPENDIX – VULNERABILITY INDEX

```
[[APPENDIX_INDEX]]
```

**Placement:** Under "Appendix: Vulnerability Index" section header  
**Purpose:** Reference table of all identified vulnerabilities

---

## STEP 3 – VALIDATION

### Automated Check

From repo root:

```powershell
pnpm template:check
```

**Must PASS before exports will succeed.**

### Manual Verification

Confirm all of these:
- [ ] All 17 required anchors present exactly once
- [ ] Zero legacy anchors remain
- [ ] Each anchor on its own paragraph line
- [ ] No anchors in headers, footers, text boxes, or table cells
- [ ] Paragraph marks (¶) confirm proper isolation
- [ ] Template saved as `.docx` (not `.doc` or other format)

---

## Troubleshooting

### If `pnpm template:check` reports missing anchors:

1. Open template in Word
2. Press **Ctrl+F** and search for the missing anchor
3. If not found, insert it according to placement guide above
4. Save and re-run `pnpm template:check`

### If `pnpm template:check` reports duplicate anchors:

1. Press **Ctrl+F** and search for the duplicate anchor
2. Use **Find Next** to locate all instances
3. Delete all but one instance
4. Confirm correct placement of remaining instance
5. Save and re-run `pnpm template:check`

### If `pnpm template:check` reports legacy anchors present:

1. Press **Ctrl+F** and search for `[[TABLE_SUMMARY]]` or `[[CHART_`
2. Delete all legacy anchor paragraphs
3. Confirm no SAFE-era placeholders remain
4. Save and re-run `pnpm template:check`

### If Word splits anchor into multiple "runs":

- Click the anchor and confirm the **whole** string is selected
- If only part highlights, delete and re-type manually (no paste)
- Ensure no leading/trailing spaces, bullets, or numbering

---

## Content Removal (Template Rewrite)

**DELETE ENTIRELY FROM TEMPLATE:**
- "Infrastructure systems are the backbone…" (legacy intro paragraph)
- All SAFE framework references and language
- FEMA preparedness explanations
- Educational infrastructure definitions
- Legacy master vulnerability tables in main body
- Legacy VOFC master table (replaced by per-infrastructure sections)
- Any placeholder instructional text
- "Asset Dependency Visualization" section as separate entity
- "Vulnerabilities and Options for Consideration" as monolithic table

**Tone shift:**
- From: Educational, explanatory, SAFE-derived
- To: Deterministic, executive-facing, posture-driven

---

## Complete Anchor List (v3)

**Required (17 total):**
1. `[[FACILITY_NAME]]` (optional cover page field)
2. `[[ASSESSMENT_DATE]]` (optional cover page field)
3. `[[SNAPSHOT_POSTURE]]`
4. `[[SNAPSHOT_SUMMARY]]`
5. `[[SNAPSHOT_DRIVERS]]`
6. `[[SNAPSHOT_MATRIX]]`
7. `[[SNAPSHOT_CASCADE]]`
8. `[[EXEC_SUMMARY]]`
9. `[[INFRA_ENERGY]]`
10. `[[INFRA_COMMS]]`
11. `[[INFRA_IT]]`
12. `[[INFRA_WATER]]`
13. `[[INFRA_WASTEWATER]]`
14. `[[SYNTHESIS]]`
15. `[[APPENDIX_INDEX]]`

**Forbidden (legacy – must not exist):**
- `[[TABLE_SUMMARY]]`
- `[[VISUALIZATION_START]]`
- `[[TABLE_VOFC]]`
- `[[CHART_*]]` (all variants)
- `[[SAFE_*]]` (all variants)
- Any other `[[LEGACY_*]]` placeholders

---

## Version History

- **v3 (Feb 15, 2026):** Snapshot Model active; legacy anchors deprecated
- **v2 (legacy):** SAFE-style narrative with master tables
- **v1 (legacy):** Initial template structure
