# Page Breaks and Locations

Where page breaks are inserted in the report (reporter: `apps/reporter/main.py`).

---

## 1. Part II – Technical Annex

| Location | When | How |
|----------|------|-----|
| **Before "PART II – TECHNICAL ANNEX"** | Always (main pipeline step 1b3) | `ensure_part2_starts_new_page(doc)` — sets `paragraph_format.page_break_before = True` on the Part II paragraph (or inserts a single page-break paragraph before it). |

**Code:** ~line 4772 (`ensure_part2_starts_new_page`), ~659–675 (`ensure_part2_starts_new_page`).

---

## 2. Vulnerability narrative section (`[[VULN_NARRATIVE]]`)

| Location | When | How |
|----------|------|-----|
| **Before vulnerability section content** | When template has `[[VULN_NARRATIVE]]` and payload has narrative (string or structured) | One page break inserted immediately after the anchor paragraph, then the section heading and content. |

**Code:**  
- String narrative: `inject_vuln_narrative_at_anchor` ~1529–1532.  
- Structured narrative: `render_vofc_docx` ~1563–1566.

So the vulnerability block (Sector Reports / Infrastructure Dependency Vulnerabilities) always starts on a new page.

---

## 3. INFRA sectors (`[[INFRA_ENERGY]]` … `[[INFRA_WASTEWATER]]`)

Each of the five INFRA anchors is filled by `inject_infra_sector_as_paragraphs` with:

| Location | When | How |
|----------|------|-----|
| **Before sector title** | For every INFRA sector | One page break inserted before the Heading 2 (e.g. "ELECTRIC POWER", "COMMUNICATIONS"). |
| **After sector narrative** | For the first four sectors only (not after WASTEWATER) | One page break inserted after the sector’s narrative and the blank line that follows it. |

**Order in document:**

1. `[page break]` → **ELECTRIC POWER** → narrative → `[page break]`
2. `[page break]` → **COMMUNICATIONS** → narrative → `[page break]`
3. `[page break]` → **INFORMATION TECHNOLOGY** → narrative → `[page break]`
4. `[page break]` → **WATER** → narrative → `[page break]`
5. `[page break]` → **WASTEWATER** → narrative (no break after)

**Code:** ~2481–2502 (`inject_infra_sector_as_paragraphs`: `page_break_before`, `page_break_after`), ~4857–4869 (main loop calling it).

---

## 4. Table of Contents (no extra page break)

TOC is kept on one page by setting `keep_with_next` on each paragraph in the TOC block (from a “Table of Contents” / “Contents” heading until the next section). No page break is inserted there.

**Code:** `ensure_toc_remains_on_one_page(doc)` ~745–789, called early in main ~4752.

---

## 5. Helpers (used by the above)

| Helper | Purpose |
|--------|---------|
| `add_page_break_paragraph(doc, after_paragraph=None)` | Inserts a paragraph containing a single `w:br w:type=page`. |
| `ensure_single_page_break_before(doc, para)` | Ensures exactly one page break paragraph immediately before `para`. |
| `ensure_single_page_break_after(doc, after_para)` | Ensures exactly one page break after `after_para`. |

---

## 6. Cleanup / removal (no net new breaks)

These only remove or consolidate breaks:

- `remove_page_breaks_between_annex_table_and_sector_reports` — **disabled** in main (~4821–4822).
- `remove_orphaned_page_breaks_before_section_d` — removes orphaned breaks before “D. CROSS…”
- `collapse_consecutive_pagebreaks` — merges two consecutive page-break paragraphs into one.
- `remove_empty_paragraphs_after_page_breaks` — removes empty paragraphs immediately after a page break.

---

## 7. Unused / deprecated paths (no longer in main flow)

- `inject_sector_narrative_at_infra_anchors` (~1762): adds page break before each INFRA sector (except first). **Not called** from current main(); INFRA is filled by `inject_infra_sector_as_paragraphs` instead.
- `render_sector_pages_at_anchor`: **raises** “VOFC table removed…”; not used.

---

## Summary (active breaks only)

| # | Where | Before/after |
|---|--------|---------------|
| 1 | Part II – Technical Annex | Before Part II heading |
| 2 | Vulnerability narrative | Before section content |
| 3a | Electric Power | Before title; after narrative |
| 3b | Communications | Before title; after narrative |
| 3c | Information Technology | Before title; after narrative |
| 3d | Water | Before title; after narrative |
| 3e | Wastewater | Before title only (no break after) |

Total: **1** break before Part II, **1** before vulnerability section, **5** before INFRA titles, **4** after INFRA narratives = **11** page breaks in the main pipeline (excluding any in the template).
