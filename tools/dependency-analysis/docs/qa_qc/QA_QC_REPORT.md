# ADA / Asset Dependency Assessment — QA/QC Report

**Date:** 2026-02-18  
**Scope:** Build health, data model, curve correctness, cross-dependency gating, question language, PACE doctrine, export/report.  
**Constraints:** No SAFE references; strict Comms vs IT separation; stakeholder-visible OFCs ≤ 4.

---

## 1. Repo Map

| Item | Finding |
|------|--------|
| **Package manager** | `pnpm@9.15.0` (enforced via `preinstall`: `npx only-allow pnpm`) |
| **Workspace** | Root `asset-dependency-tool/`; apps: `apps/web`, `apps/reporter`; packages: `packages/schema`, `packages/engine`, `packages/security`, `packages/ui` |
| **CI** | No `.github/workflows` present; gate via local scripts |
| **Scripts** | `package.json`: `lint`, `typecheck`, `test`, `build`; lint runs `verify:question-integrity`, `verify:dependency-scope`, `validate:deps`, `validate:dependency-contract`, then `pnpm -r lint` |
| **Test frameworks** | **Vitest** (schema, engine, web); no Playwright/Cypress in repo |
| **Question catalogs** | Per-tab specs: `apps/web/app/lib/dependencies/infrastructure/{energy_spec,comms_spec,it_spec,water_spec,wastewater_spec}.ts`; ordering: `order_questions.ts` + `canonical_question_order.ts`; visibility: `question-visibility.ts`, `evaluate_conditions.ts` |
| **Curve builders** | `apps/web/app/lib/charts/communications_pace_curve.ts` (PACE, HORIZON_HOURS=72, DEFAULT_CARRIER_SURVIVABILITY_HOURS=8); `chartService.ts` (buildCategoryChartData, buildCommsChartData, shouldShowChart); `curveClient.ts` (workbook-aligned curves) |
| **PACE model + renderer** | PACE layers: `comms_spec.ts` (CommPaceLayer, power_scope); curve: `communications_pace_curve.ts`; UI: `CommsQuestionnaireSection.tsx` (PaceLayerCard); “How built”: `assessment/categories/page.tsx` (table with Power scope, Effective sustain); legend: `CategoryChart.tsx` (segments + capped) |
| **Visual Analysis** | `components/ReviewExport/sections/ExecutiveSummaryPreview.tsx`: curves gated by `hasAnyCurveData(assessment)`; matrix gated by `isCrossDependencyEnabled(assessment)` + `hasMatrixData(assessment)`; predicates: `app/lib/report/visual_analysis_predicates.ts` |
| **Export pipeline** | DOCX: `apps/web/app/api/export/final/route.ts` (POST), `apps/reporter` (Python); template: `scripts/validate_template_anchors.ts`, `scripts/build_template_docx.ts`; anchors: `packages/schema/src/template_anchors.ts` |

---

## 2. Commands & Results

| Command | Result | Notes |
|---------|--------|--------|
| `pnpm run typecheck` | **PASS** | Fixed during QA: moved `buildSlaReliabilityForReport` / `buildSlaPraSummaryForReport` out of API route into `app/lib/export/sla_report_helpers.ts` to satisfy Next.js route export constraint. |
| `pnpm run lint` | **FAIL** | `verify:question-integrity` **PASS**. `verify_dependency_scope` **FAIL**: IT vs Comms scope violations (curve_primary_provider wording, IT-6/7/7a exterior/vehicle impact). Documented in punch list; not auto-fixed to avoid changing stakeholder copy without direction. |
| `pnpm run test` | **FAIL** (schema) | `packages/schema`: 2 snapshot failures in `ui_config_generated.test.ts` and `ui_labels_regression.test.ts` (generated UI config includes additional curve keys / sections). `apps/web` and other packages pass. |
| `pnpm run build` | Not run full | Depends on lint; `pnpm run typecheck` and web tests pass. |

---

## 3. Punch List (Prioritized)

### P0 — Critical (fix before release)

| # | Item | File(s) | Fix |
|---|------|---------|-----|
| P0-1 | TypeScript: route file must not export non-handler symbols | `apps/web/app/api/export/final/route.ts` | **DONE.** Moved `buildSlaReliabilityForReport` and `buildSlaPraSummaryForReport` to `apps/web/app/lib/export/sla_report_helpers.ts`. `draft/route.ts` now imports from there. |

### P1 — High (correctness / credibility)

| # | Item | File(s) | Fix |
|---|------|---------|-----|
| P1-1 | Question integrity: Comms curve question ids not in allowlist | `apps/web/app/lib/dependencies/canonical_question_order.ts`, `order_questions.ts` | **DONE.** Added `CURVE_ID_ALIASES` (curve_time_to_impact_hours, curve_loss_fraction_no_backup, etc.) and extended `CURVE_ID_SET`; sort maps aliases to canonical position. |
| P1-2 | Language: remove “can the facility identify…” | `energy_spec.ts` (E-2), `it_spec.ts` (IT-2) | **DONE.** E-2: “If known, which key upstream substation(s) may affect service to this site?”; IT-2: “List the critical externally hosted or managed digital services relied upon for core operations (if any).” |
| P1-3 | Visual Analysis / Matrix gating | — | **VERIFIED.** Matrix shows only when cross-dependency enabled; OFF shows “Enable Cross-Dependency to view”; ON + no edges shows “No confirmed cross-dependencies recorded yet.” |
| P1-4 | Curve: 72h horizon, 0–100 clamp, 0-value valid | — | **VERIFIED.** `HORIZON_HOURS = 72`; `shouldShowChart` and `hasAnyCurveData` treat 0 as valid; capacity clamped 0–100 in chartService. |
| P1-5 | PACE: device-only cap, “How built” disclosure | — | **VERIFIED.** Implemented in prior work: powerScope, effectiveSustain cap at 8h, Power scope + Effective sustain columns, “(capped)” in legend. |

### P2 — Medium (consistency / tech debt)

| # | Item | File(s) | Fix |
|---|------|---------|-----|
| P2-1 | Dependency scope lint failures | IT curve_primary_provider, IT-6, IT-7, IT-7a | Resolve wording/scope per Comms vs IT doctrine: remove carrier/ISP from IT prompt; move or reword exterior/vehicle impact to Comms or generic. |
| P2-2 | Schema UI config snapshots | `packages/schema` | Run `pnpm --filter schema test:update` to refresh snapshots if generated UI config is intentionally updated; otherwise align generation with expected snapshot. |
| P2-3 | Export: no wrong boilerplate / SAFE | Report view_model, DOCX generator | **VERIFIED.** view_model comment documents “no SAFE or generator language”; no user-facing SAFE found in report code. Non-energy sections should not mention “backup generator”; spot-check export templates. |

### P3 — Low (nice-to-have)

| # | Item | File(s) | Fix |
|---|------|---------|-----|
| P3-1 | Single `qa` script | Root `package.json` | **DONE.** Added `"qa": "pnpm run typecheck && pnpm -r test"`. |
| P3-2 | Playwright smoke | — | Not present; add optional smoke (create assessment, timeToImpact=0, curves render, cross-dependency OFF ⇒ matrix hidden) if E2E desired. |

---

## 4. Fixes Applied (Summary)

- **apps/web/app/lib/export/sla_report_helpers.ts** — New file: `buildSlaReliabilityForReport`, `buildSlaPraSummaryForReport` (moved out of export final route).
- **apps/web/app/api/export/final/route.ts** — Removed exported helpers; import from `sla_report_helpers`.
- **apps/web/app/api/export/draft/route.ts** — Import `buildSlaReliabilityForReport` from `sla_report_helpers`.
- **apps/web/app/lib/dependencies/canonical_question_order.ts** — Added `CURVE_ID_ALIASES` for comms curve question ids.
- **apps/web/app/lib/dependencies/order_questions.ts** — `CURVE_ID_SET` includes aliases; curve sort uses canonical mapping.
- **apps/web/app/lib/dependencies/infrastructure/energy_spec.ts** — E-2 prompt: removed “can the facility identify”, use “If known, which key upstream substation(s)…”.
- **apps/web/app/lib/dependencies/infrastructure/it_spec.ts** — IT-2 prompt: replaced “Can the facility identify…” with “List the critical externally hosted… (if any).”
- **package.json** (root) — Added `"qa": "pnpm run typecheck && pnpm -r test"`.

---

## 5. Remaining Recommendations

1. **Lint:** Fix dependency-scope violations (P2-1) so `pnpm run lint` passes; then add `qa` to run lint + typecheck + test + build in one command.
2. **Schema tests:** Update or align UI config snapshots (P2-2) so `pnpm run test` is green across workspace.
3. **Question order:** Confirm Q2 = “Who provides X?” immediately after Q1 reliance on all primary infrastructure tabs (already structured in MAIN_ORDER / curve then main; verify per-tab flow in UI).
4. **Energy runtime:** Ensure backup power “Est. runtime” is derived from curve sustain (Q5) and stays in sync; confirm export uses curve runtime (not per-asset only).
5. **OFCs:** Keep stakeholder-visible OFCs ≤ 4; no new SAFE references; maintain Comms vs IT separation in copy and scope checks.

---

## 6. How to Run Locally

```bash
# From repo root (asset-dependency-tool)
cd c:\ADA\asset-dependency-tool

# Install
pnpm install

# Typecheck (all packages)
pnpm run typecheck

# Lint (question integrity + dependency scope + deps + contract + per-package lint)
pnpm run lint

# Tests (all packages)
pnpm run test

# Build (validates deps, builds vofc-json, then all packages)
pnpm run build

# Web app only (dev)
pnpm --filter web run dev

# Web app build only (skip full monorepo build)
pnpm run build:web
```

**Minimal gate (typecheck + web tests):**

```bash
pnpm run typecheck
pnpm --filter web run test
```

**Schema generated-config integrity (default vs strict):**

- **Dev (default):** `pnpm --filter schema test` — passes even if the XLSM workbook is missing or extraction fails; only fails when the workbook exists and generated file is out of date.
- **Strict (QA/CI):** `ADA_STRICT_INTEGRITY=1 pnpm --filter schema test` — fails if the XLSM is missing, if extraction fails, or if the generated file is out of date; passes only when the workbook exists and `pnpm run check-generated` returns 0.
- **PowerShell (strict):** `$env:ADA_STRICT_INTEGRITY=1; pnpm run qa`

**Single `qa` script:** `pnpm run qa` runs typecheck + all package tests **with strict integrity** (requires XLSM and successful extraction for schema). For local dev without the workbook, run `pnpm --filter schema test` (or run tests without setting `ADA_STRICT_INTEGRITY`).
