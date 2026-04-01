# Repository tree

Source and config only (excludes `node_modules/`, `.next/`, `out/`, `dist/`, `target/`, `build/`, `.venv*/`, `__pycache__/`).

```
asset-dependency-tool/
├── .editorconfig
├── .gitignore
├── CISA_Design_System.css
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── README.md
├── RELEASE.md
├── REPO_TREE.md
│
├── archive/
│   └── 2026-02/
│       ├── python/
│       │   └── main_baseline.py
│       ├── scripts/
│       │   ├── add_table_summary_anchor.py
│       │   └── test_reporter.ps1
│       └── test_artifacts/
│           ├── test_report_full.json
│           ├── test_report_input.json
│           ├── test_work/
│           │   └── output.docx
│           └── test_work_full/
│               ├── chart_COMMUNICATIONS.png
│               ├── chart_ELECTRIC_POWER.png
│               ├── chart_INFORMATION_TECHNOLOGY.png
│               ├── chart_WASTEWATER.png
│               ├── chart_WATER.png
│               └── output.docx
│
├── apps/
│   ├── reporter/
│   │   ├── build.ps1
│   │   ├── dev_smoke.py
│   │   ├── inject_anchors.py
│   │   ├── main.py
│   │   ├── perf_reporter.py
│   │   ├── pyproject.toml
│   │   ├── reporter.spec
│   │   ├── requirements.txt
│   │   ├── verify_output.py
│   │   └── reporter/
│   │       ├── __init__.py
│   │       └── main.py
│   │
│   └── web/
│       ├── .env.local.example
│       ├── .eslintrc.json
│       ├── next.config.js
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── next-env.d.ts
│       ├── app/
│       │   ├── api/
│       │   │   ├── export/draft/route.ts, final/route.ts
│       │   │   ├── purge/route.ts
│       │   │   ├── revision/export, import, metadata/route.ts
│       │   │   ├── template/check/route.ts
│       │   │   └── vofc/generate/route.ts, ready/route.ts
│       │   ├── assessment/
│       │   │   ├── categories/page.tsx
│       │   │   ├── dependencies/energy/page.tsx
│       │   │   ├── layout.tsx
│       │   │   ├── new/page.tsx
│       │   │   └── review/page.tsx
│       │   ├── components/ServiceWorkerRegister.tsx
│       │   ├── debug/ui-config/, workbook-alignment/ (layout.tsx, page.tsx)
│       │   ├── lib/
│       │   │   ├── asset-dependency/priorityRestorationAutoMap.ts, priorityRestorationSchema.ts
│       │   │   ├── charts/CategoryChart.tsx, chartService.ts, curveClient.ts
│       │   │   ├── dependencies/ (derive_energy_findings, energy_storage, …)
│       │   │   ├── help/, io/, purge/, report/, reporter/, sla/, template/, ui/
│       │   │   └── (assessmentStorage, progressFile, purgeAll, path, validateAnchors, …)
│       │   ├── CISA_Design_System.css, globals.css
│       │   ├── layout.tsx, page.tsx, providers.tsx
│       │   └── template-readiness/page.tsx
│       ├── assets/data/
│       │   ├── .gitkeep
│       │   └── VOFC_Library.xlsx
│       ├── components/
│       │   ├── asset-dependency/ (PriorityRestorationHelp*, SlaMttrBadge, index)
│       │   ├── AssetInformationSection, DependencySection, ProgressActions
│       │   ├── ReviewExportSection, SectionTabsShell, SummaryTab, SupplySourcesEditor
│       │   └── ui/NumericInput.tsx
│       ├── lib/
│       │   ├── agreements.ts, api.ts, assessment-context.tsx, default-assessment.ts
│       │   ├── clear-dependent-fields.ts, get-default-category-input.ts, numeric.ts
│       │   ├── export/runExport.ts
│       │   └── platform/apiBase.ts, runtime.ts; vofc/resolveVofcLibraryPath.ts
│       ├── public/
│       │   ├── sw.js
│       │   └── vofc-library.json
│       └── scripts/
│           ├── seed_energy_demo.ts
│           └── tests/ (_helpers, exportSmoke, perfExport, fixtures)
│
├── assets/
│   ├── templates/
│   │   ├── _dev_with_anchors.docx
│   │   └── Asset Dependency Assessment Report_BLANK.docx
│   └── workbooks/
│       └── Asset Dependency Visualization.xlsm
│
├── data/
│   └── exports/
│       └── .gitkeep
│
├── docs/
│   ├── BASELINE_STATE.md
│   ├── DEPLOYMENT.md
│   ├── NEW_FUNCTION_TEMPLATE.md
│   ├── NEW_FUNCTIONS_BACKLOG.md
│   ├── PACKAGING-PLAN.md
│   ├── PERFORMANCE_TEST_PLAN.md
│   ├── PUNCH_LIST_ORIGINAL_TRACK.md
│   ├── SECURITY.md
│   ├── TEMPLATE_ANCHORS.md
│   └── UI_REFERENCE_ELECTRICITY.md
│
├── packages/
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── client.ts
│   │       ├── curve.ts
│   │       ├── index.ts
│   │       ├── summary.ts
│   │       ├── curve.test.ts
│   │       ├── summary.test.ts
│   │       ├── electric_power_workbook_alignment.test.ts
│   │       ├── export/
│   │       │   ├── export_guard.ts
│   │       │   └── export_guard.test.ts
│   │       ├── testutils/
│   │       │   ├── freezeMeta.ts
│   │       │   └── stableStringify.ts, .test.ts
│   │       ├── vofc/
│   │       │   ├── library_types.ts
│   │       │   ├── library.ts
│   │       │   ├── generate.ts
│   │       │   ├── generate_core.ts
│   │       │   ├── evaluate_triggers.ts
│   │       │   ├── normalize.ts
│   │       │   ├── calibrate_severity.ts
│   │       │   ├── explain_calibration.ts
│   │       │   ├── map_doctrine.ts
│   │       │   ├── map_guard.ts
│   │       │   ├── severity_bands.ts
│   │       │   ├── generate.test.ts
│   │       │   ├── evaluate_triggers.test.ts
│   │       │   ├── normalize.test.ts
│   │       │   ├── map_guard.test.ts
│   │       │   ├── library_legacy.test.ts
│   │       │   ├── calibration_*.test.ts
│   │       │   ├── __fixtures__/
│   │       │   │   ├── assessments/ (base, cap_four_per_category, …)
│   │       │   │   └── rules_minimal.ts
│   │       │   └── __tests__/__snapshots__/
│   │       └── __tests__/ (workbook_alignment_*.test.ts, vofc_library_presence.test.ts)
│   │
│   ├── schema/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── assessment.ts
│   │       ├── vofc.ts
│   │       ├── agreements_ui_config.ts
│   │       ├── build_info.ts
│   │       ├── percent_display.ts
│   │       ├── template_anchor_guidance.ts
│   │       ├── template_anchors.ts
│   │       ├── ui_config.ts
│   │       ├── ui_config.generated.ts
│   │       ├── ui_help.ts
│   │       ├── ui_help_overrides.ts
│   │       └── __tests__/ (agreements, electric_power_labels, percent_display, ui_*)
│   │
│   ├── security/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   │
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.tsx
│           └── HelpIcon.tsx
│
├── scripts/
│   ├── build-vofc-json.ts
│   ├── check_generated_integrity.ts
│   ├── extract_xlsm_ui_config.ts
│   ├── release_gate.ts
│   ├── validate_template_anchors.ts
│   ├── xlsm_cell_map.ts
│   ├── xlsm_question_map.ts
│   ├── dev/
│   │   ├── bootstrap.ps1
│   │   └── start.ps1
│   └── tests/
│       └── release_smoke.ps1
│
└── tools/
    └── release/
        └── README.md
```

*Generated for asset-dependency-tool. Omitted: `node_modules/`, `.next/`, `out/`, `dist/`, `target/`, `build/`, `.venv*/`, `__pycache__/`.*
