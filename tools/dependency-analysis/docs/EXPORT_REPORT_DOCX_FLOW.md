# Export Report (DOCX) Flow

Trace of the "Export report (DOCX)" button through to reporter output.

## 1. Button → API

| File | Function | Action |
|------|----------|--------|
| `apps/web/components/ReviewExport/ExportPanel.tsx` | `handleDownloadReport()` | Calls `exportFinal(assessment, options)` |
| `apps/web/lib/api.ts` | `exportFinal()` | POST to `/api/export/final` with JSON body |

## 2. API Route

| File | Function | Action |
|------|----------|--------|
| `apps/web/app/api/export/final/route.ts` | `POST()` | Handles request, builds payload, calls reporter |
| `apps/web/app/lib/template/path.ts` | `getTemplatePath()` | Returns `Asset Dependency Assessment Report_BLANK.v2backup.docx` |
| `apps/web/app/api/export/final/route.ts` | `getReporterCommand()` | Python `main.py` in dev; else `reporter.exe` |
| `apps/web/app/api/export/final/route.ts` | `runReporter()` | Spawns process with `WORK_DIR`, `TEMPLATE_PATH` env |

**workDir:** `{repoRoot}/data/temp/{uuid}`  
**templatePath:** `{repoRoot}/assets/templates/Asset Dependency Assessment Report_BLANK.v2backup.docx`

## 3. Reporter

| File | Function | Action |
|------|----------|--------|
| `apps/reporter/main.py` | `main()` | Reads JSON from stdin, loads template, processes, writes `output.docx` |

**Env:** `TEMPLATE_PATH`, `WORK_DIR`

## 4. Page Break Logic (reporter)

**Fix applied:** Use `paragraph_format.page_break_before = True` instead of adding a separate page-break paragraph. The extra paragraph was ending up on its own page, causing blank pages.

| Phase | Function | Purpose |
|-------|----------|---------|
| Load | `collapse_consecutive_pagebreaks()` | Remove duplicate breaks |
| Load | `remove_blank_pages_after_section_b()` | Strip empties after SNAPSHOT_CASCADE |
| Cleanup | `remove_sector_analysis_chart_block()` | Remove Part I chart block |
| Cleanup | `remove_orphaned_page_breaks_before_section_d()` | Remove orphan breaks before D. CROSS |
| Part II | `ensure_part2_starts_new_page()` | **Uses page_break_before** on PART II para |
| Sectors | `render_sector_pages_at_anchor()` | **Uses page_break_before** on sector titles (idx>0) |
| Final | `collapse_consecutive_pagebreaks()` | Remove duplicates |
| Final | `remove_empty_paragraphs_after_page_breaks()` | Strip empties after breaks |
| Final | `_trim_trailing_empty_paragraphs()` | Trim trailing empties |
| Final | `compress_blank_paragraphs(max_run=0)` | Allow 0 consecutive blank paras |
