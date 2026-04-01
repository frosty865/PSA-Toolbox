# Report Generation Process

Definition of the DOCX report generation flow: file locations, sequence, and dependencies.

---

## 1. Overview

The user triggers **Export DOCX** from the Review & Export UI. The web app sends the assessment (and optional energy/dependency sections) to the export API, which builds a payload, invokes the Python reporter, and returns the generated DOCX.

- **Single template:** `ADA/report template.docx` (narrative-only, anchor-based).
- **Reporter:** Python CLI (`apps/reporter/main.py`) or optional `reporter.exe`.
- **Output:** `Asset-Dependency-Assessment-Report.docx` (binary download).

---

## 2. File Locations and Roles

### 2.1 Web (Next.js) – Request and Payload

| File | Role |
|------|------|
| `apps/web/components/ReviewExport/ExportPanel.tsx` | UI: Export DOCX button, calls `exportFinal()`, shows error (stderr/stdout, template_path, repo_root). |
| `apps/web/lib/api.ts` | `exportFinal(assessment, options?)` → POST `/api/export/final` with JSON body; returns `Blob` (DOCX) or throws `ApiError` with `details`. |
| `apps/web/app/api/export/final/route.ts` | **Export API:** Validates body, parses assessment, builds payload, resolves template path, runs reporter subprocess, returns DOCX or JSON error. |

### 2.2 Template and Repo Paths (Web)

| File | Role |
|------|------|
| `apps/web/app/lib/template/path.ts` | `getRepoRoot()`, `findRootWithReporter()`, `getCanonicalTemplatePath(repoRoot)`, `assertCanonicalTemplatePath(path)`, `getTemplatePath()`. |
| `apps/web/app/lib/template/validateAnchors.ts` | `validateTemplateAnchorsOnce(templatePath)` – ensures required anchors exist in template (used by export route and template check). |
| `apps/web/app/lib/reporter/path.ts` | `getReporterPath(repoRoot)` – path to `reporter.exe` (or env `ADA_REPORTER_EXE`). |
| `apps/web/app/api/template/check/route.ts` | GET `/api/template/check` – uses `findRootWithReporter()` + `getCanonicalTemplatePath()` + anchor check (same template as export). |

**Canonical template path:**  
`<repoRoot>/ADA/report template.docx`  
where `repoRoot` = `findRootWithReporter()` (first directory containing `apps/reporter/main.py`).

**Template placeholders:** Use exactly `[[PSA_CELL]]` and `[[PSA_EMAIL]]` (double brackets each). A malformed placeholder (e.g. `[[PSA_CELL]` or `[PSA_CELL]]`) can produce output like "Cell: [404-518-9273". The reporter also maps the typo `[[PSA_CELL]` and `[[PSA_EMAIL]` for compatibility.

### 2.3 Report View Model and Payload (Web)

| File | Role |
|------|------|
| `apps/web/app/lib/report/build_report_vm.ts` | `buildReportVMForReviewAndExport(assessment, opts)` – builds in-memory report view model (snapshot, synthesis, priority actions, dependency sections). |
| `apps/web/app/lib/report/vm_to_reporter_payload.ts` | `vmToExecutiveSnapshot()`, `vmToSynthesis()`, `vmToDependencyPayload()` – convert VM to reporter payload fields. |
| `apps/web/app/lib/report/coverage_manifest.ts` | `buildCoverageManifest()`, `getUnaccountedKeys()` – coverage audit before export (fail if captured inputs not represented). |
| `apps/web/app/lib/report/qc/check_vulnerability_blocks.ts` | `runVulnerabilityBlockQC()` – validates vulnerability block text before sending to reporter. |
| `apps/web/app/lib/export/sla_report_helpers.ts` | `buildSlaReliabilityForReport()`, `buildSlaPraSummaryForReport()` – when PRA/SLA enabled. |
| `apps/web/app/lib/cross-dependencies/buildSummary.ts` | `buildCrossDependencySummary()`, `buildCrossDependencyModuleFindings()` – when cross-dependency enabled. |
| `apps/web/app/lib/dependencies/*` | Dependency sections, VOFC repo file, library injections, conditions (e.g. `evaluate_conditions`, `buildDependencySectionsFromRepo`, `mergeLibraryOfcs`). |
| `apps/web/app/lib/modules/apply_module_modifiers.ts` | `applyModuleModifiers()` – applied to summary before narrative tokens and export. |
| `apps/web/app/lib/purge/purgeAll.ts` | `purgeAll(repoRoot)` – cleanup `data/temp` and OS temp prefix after export. |

### 2.4 Engine and Schema (Shared)

| File / Package | Role |
|----------------|------|
| `schema` (package) | `parseAssessment()`, `Assessment` type – Zod validation of request body. |
| `engine` (package) | `generateVOFCs()`, `buildSummary()`, `assertExportReady()`, `REQUIRED_ANCHORS` – VOFC generation, summary, pre-export checks. |
| `apps/web/lib/vofc/resolveVofcLibraryPath.ts` | `resolveVofcLibraryPath(repoRoot)` – path to VOFC library (e.g. `data/vofc-library.json` or env). |

### 2.5 Reporter (Python) – DOCX Generation

| File | Role |
|------|------|
| `apps/reporter/main.py` | **Entry point.** Reads JSON payload from stdin; uses `WORK_DIR` and `TEMPLATE_PATH` (env); generates charts, loads template, injects content at anchors, runs QC, saves `output.docx`; prints output path to stdout. |
| `apps/reporter/sanitize.py` | `sanitize_text()`, `sanitize_vulnerability_text()` – strip mojibake, U+FFFD, control chars from text before insertion. |
| `apps/reporter/qc_export.py` | `run_export_qc()`, `ENCODING_ARTIFACT_PATTERNS`, `REQUIRED_SECTION_ANCHORS` – encoding-artifact check, unresolved-anchor check, priority/OFC limits, required-sections (when payload has full data). `main.py` imports `ENCODING_ARTIFACT_PATTERNS` for in-doc replacement and `run_export_qc` for final gate. |

### 2.6 Template and Data (On Disk)

| Path | Role |
|------|------|
| `<repoRoot>/ADA/report template.docx` | **Single canonical template.** Must contain required anchors (e.g. `[[SNAPSHOT_POSTURE]]`, `[[SYNTHESIS]]`, `[[PRIORITY_ACTIONS]]`, `[[INFRA_*]]`). |
| `<repoRoot>/data/temp/<uuid>/` | Per-export work dir: charts written here; reporter loads template and writes `output.docx` here. Deleted in API `finally`. |
| `<repoRoot>/data/vofc-library.json` (or env) | VOFC library used by `generateVOFCs()` (web). |

---

## 3. End-to-End Sequence

1. **User:** Clicks Export DOCX in `ExportPanel`.  
2. **Client:** `exportFinal(assessment, { energy_dependency?, dependency_sections? })` in `api.ts` → POST `/api/export/final` with JSON body.  
3. **Export route:**  
   - Parse body (Zod), strip agreements if PRA/SLA disabled.  
   - Resolve `repoRoot = findRootWithReporter()`, `templatePath = getCanonicalTemplatePath(repoRoot)`, assert canonical, check file exists, `validateTemplateAnchorsOnce(templatePath)`.  
   - Build VOFC collection (`generateVOFCs`), summary, report VM (`buildReportVMForReviewAndExport`), executive snapshot, synthesis, priority actions, dependency payload.  
   - Pre-export checks: `assertExportReady`, narrative tokens resolved, coverage audit, PSA phone, vulnerability block QC, report binding guards.  
   - Create work dir `data/temp/<uuid>`.  
   - Spawn reporter: `command` (Python or exe), `args`, `cwd: repoRoot`, env `WORK_DIR`, `TEMPLATE_PATH`, `TOOL_VERSION`; stdin = single JSON payload; on exit 0 read `workDir/output.docx`.  
   - On success: `purgeAll(repoRoot)`, return DOCX bytes. On failure: attach stderr/stdout to error, return 500/400 with `details` (e.g. `reporter_stderr`, `template_path`, `repo_root`).  
   - `finally`: remove work dir, `purgeAll(repoRoot)`.  
4. **Reporter (main.py):**  
   - Read JSON from stdin; resolve `work_path` from `WORK_DIR`, `template_path` from `TEMPLATE_PATH` or `repo_root/ADA/report template.docx`; assert path ends with `ADA/report template.docx`.  
   - Generate charts into work_path; load template DOCX.  
   - Run pipeline: margins, anchor assertions, placeholder removal, replace text placeholders (e.g. PSA phone), inject executive snapshot, synthesis, priority actions, executive summary brief, IT scope, summary table, clear TABLE_VOFC if present, inject sector narrative at INFRA_* anchors, SLA/PRA, cross-dependency, cyber VOFC, sources narrative, safety sweep, anchor cleanup, encoding-artifact replacement (`_replace_encoding_artifacts_in_doc` using `qc_export.ENCODING_ARTIFACT_PATTERNS`), `run_export_qc()`, template safeguard, final hygiene, save `output.docx`, print output path.  
5. **Client:** Receives DOCX blob, triggers download (e.g. `downloadReportDocx(blob)`).

---

## 4. Dependencies

### 4.1 Web (Node)

- **Runtime:** Next.js (API route, React).  
- **Key packages:** `schema`, `engine`, `zod`, `next`, `react`.  
- **Internal:** All `@/app/lib/*`, `@/lib/*` as above.

### 4.2 Reporter (Python)

- **Runtime:** Python 3 (recommended: venv at `.venv-reporter`).  
- **Packages** (`apps/reporter/requirements.txt`):  
  - `python-docx>=1.0.0`  
  - `matplotlib>=3.7.0`  
  - `Pillow>=9.0.0`  
  - `pytest>=7.0.0` (tests)  
- **Internal:** `main.py` imports `sanitize` (e.g. `sanitize_text`) and `qc_export` (`ENCODING_ARTIFACT_PATTERNS`, `run_export_qc`, `REQUIRED_SECTION_ANCHORS`). No other local Python modules required for the default pipeline.

### 4.3 Optional

- **reporter.exe:** Built e.g. via `apps/reporter/build.ps1`; used when `ADA_REPORTER_EXE` is set or when Python/venv not available (fallback).  
- **Env:** `ADT_APP_ROOT` / `ADT_ROOT` (repo root), `ADA_REPORTER_DEBUG=1` (reporter step logging), `ADA_REPORTER_EXE` (force exe), `ADA_USE_PYTHON_REPORTER=1` (prefer Python), `TOOL_VERSION` (passed to reporter).

---

## 5. Diagram (High Level)

```
[ExportPanel] --> exportFinal() [api.ts]
       |
       v
POST /api/export/final  [route.ts]
       |
       +-- findRootWithReporter() --> getCanonicalTemplatePath() --> template file
       +-- buildReportVMForReviewAndExport() --> vmTo*() --> payload
       +-- runReporter(command, args, workDir, templatePath, repoRoot, payload)
       |       |
       |       v
       |   spawn(Python|exe), stdin=JSON, env WORK_DIR, TEMPLATE_PATH
       |       |
       |       v
       |   [main.py] read stdin --> charts --> load template --> inject --> QC --> save output.docx
       |       |
       +-- read output.docx --> 200 + DOCX blob
       |
       v
[ExportPanel] download DOCX
```

---

## 6. Key Paths Summary

| What | Path or Location |
|------|-------------------|
| Export API | `apps/web/app/api/export/final/route.ts` |
| Template (canonical) | `<repoRoot>/ADA/report template.docx` |
| Reporter entry | `apps/reporter/main.py` |
| Reporter QC | `apps/reporter/qc_export.py` |
| Sanitization | `apps/reporter/sanitize.py` |
| Template path helpers | `apps/web/app/lib/template/path.ts` |
| Report VM → payload | `apps/web/app/lib/report/build_report_vm.ts`, `vm_to_reporter_payload.ts` |
| VOFC generation | `engine` package + `resolveVofcLibraryPath` |
| Work dir | `<repoRoot>/data/temp/<uuid>` (created per request, deleted in `finally`) |
| Output file | `<workDir>/output.docx` |

---

## 7. Title page graphic and template hardening

To avoid the reporter removing or damaging the title page graphic:

- **Template:** Put the title page graphic in its **own** paragraph with **no** anchors and **no** dynamic fields (e.g. `[[PSA_CELL]]`, `[[PSA_EMAIL]]`). Keep anchors in **separate** paragraphs below. If the image is floating, anchor it to a blank paragraph (e.g. a space) that has no anchors.
- **Reporter:** Anchor find/replace is restricted to **body** by default (`replace_anchor_in_doc(..., body_only=True)`); chart and narrative anchors use body-only search so header/footer and title page are not mutated. Paragraphs that contain drawings are never removed; only their text runs are cleared when an anchor would otherwise be removed. `remove_placeholder_images` never strips images from the first few body paragraphs (see `TITLE_PAGE_IMAGE_GUARD_COUNT`) so the title/cover graphic is preserved.
- After editing the template, run **`pnpm template:check`** to validate anchors.

### 7.1 Template author checklist (Section B/C, TOC)

When editing `ADA/report template.docx`:

- **Section C heading:** Add **Heading 2** `C. OPERATIONAL CAPABILITY CURVES` immediately after `B. DEPENDENCY SNAPSHOT TABLE`. Remove any residual "Dependency Curve" text; keep only the five chart anchors: `[[CHART_ELECTRIC_POWER]]`, `[[CHART_COMMUNICATIONS]]`, `[[CHART_INFORMATION_TECHNOLOGY]]`, `[[CHART_WATER]]`, `[[CHART_WASTEWATER]]`.
- **Section B (Snapshot):** Ensure **no** Heading 3 elements exist under Section B; the Snapshot table should be pure table content only.
- **TOC:** Set the Table of Contents field to include **only Heading 1 and Heading 2** (exclude Heading 3) so sector names (Heading 3 under Section C) do not appear in the TOC.

Then run **`pnpm template:check`** to validate anchors.

### 7.2 Part II – Technical Annex (federal-style anchors)

Part II uses a separate anchor set. See **`docs/TEMPLATE_PART_II_ANCHORS.md`** for:

- Exact headings and anchors: `[[TABLE_DEPENDENCY_SUMMARY]]`, `[[STRUCTURAL_PROFILE_SUMMARY]]`, `[[VULNERABILITY_COUNT_SUMMARY]]`, `[[VULNERABILITY_BLOCKS]]`, `[[CROSS_INFRA_ANALYSIS]]` (Annex ends there; no MODELED DISRUPTION CURVES section).
- Hard page break before "PART II – TECHNICAL ANNEX" (no extra page breaks inside vulnerability blocks)
- Validation via `pnpm template:check`

---

## 8. Vercel (online DOCX export)

Export works on Vercel without a local Python or reporter.exe by using a Python serverless function:

- **Root Directory:** Set the Vercel project **Root Directory** to the folder that contains `api/`, `apps/`, and `ADA/` (i.e. **asset-dependency-tool**). That ensures `api/render_docx.py` and the reporter (`apps/reporter/`) and template (`ADA/report template.docx`) are in the deployment.
- **Flow:** `POST /api/export/final` builds the payload; when no local reporter is available on Vercel, it calls `POST /api/render_docx` with that payload. The Python function runs the reporter and returns the DOCX bytes.
- **Dependencies:** Root `requirements.txt` lists `python-docx`, `matplotlib`, `Pillow` for the Python runtime.

No Linux binary or separate server is required; the same repo runs online and locally.

---

## 9. Regression check (export)

After changes that touch anchor removal or replacement:

1. Run export **twice**: (1) baseline (minimal payload), (2) full payload (charts + annex).
2. Verify: **title page graphic** intact, **header/footer branding** intact, and **no** paragraph that contains a drawing was deleted.
