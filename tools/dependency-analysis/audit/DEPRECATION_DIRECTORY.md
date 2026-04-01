# Deprecation Directory

A structured inventory of files and directories to support deprecation decisions. Use this to decide what to remove, consolidate, or archive.

---

## Quick reference: potential deprecation candidates

| Category | Path | Notes |
|----------|------|-------|
| **Duplicate** | `inject_anchors.py` vs `inject_anchors_into_body.py` | Two anchor injection scripts; clarify which is canonical |
| **Backup** | `*.backup.docx` | Auto-generated backups; decide if to keep in repo |
| **Root duplicates** | `d:\ADA\Asset Dependency Assessment Report_BLANK.docx` | Duplicate of `assets/templates/` version |
| **Root test** | `main_baseline.py`, `test_reporter.ps1`, `test_report_input.json`, `test_report_full.json`, `test_work*/` | Archived under `archive/2026-02/`; confirm if still needed |
| **Debug** | `app/debug/` (ui-config, workbook-alignment) | Dev-only debug pages; deprecate or gate behind env |
| **Legacy** | `app/api/purge/` (per REPO_TREE) | May be replaced; verify if still used |
| **Duplicate tool** | `tools/validate_dependency_parity.ts` | Also in `apps/web/scripts/`; consolidate |
| **Duplicate config** | `CISA_Design_System.css` at root and in `app/` | Single source of truth? |

---

## Full directory structure (for deprecation review)

### Root (d:\ADA)

```
d:\ADA\
├── .cursorrules
├── Asset Dependency Assessment Report_BLANK.docx   ⚠️ Duplicate of assets/templates/
├── Asset Dependency Visualization.xlsm
├── INFRASTRUCTURE_QUESTIONS.md
├── layout test.docx
├── archive/
│   └── 2026-02/
│       ├── python/main_baseline.py               ✅ Archived legacy reporter script
│       ├── scripts/test_reporter.ps1             ✅ Archived PowerShell harness
│       └── test_artifacts/
│           ├── test_report_full.json             ✅ Archived test payload (full)
│           ├── test_report_input.json            ✅ Archived test payload (minimal)
│           ├── test_work/output.docx             ✅ Archived reporter output
│           └── test_work_full/*                  ✅ Archived full reporter output set
│       └── scripts/test_reporter.ps1             ✅ Archived PowerShell harness
├── MISSING_QUESTIONS_ANALYSIS.md
├── package.json
├── PATH.txt
├── scripts/
│   └── dev/fix-workbook-chart-format.ps1
├── settings.txt
├── SLA_PRA_QUESTIONS.md
├── TAB_AUDIT_REPORT.md
├── vercel.json
├── VOFC HTML Viewer/                               ⚠️ Legacy HTML viewer; still needed?
└── asset-dependency-tool/                          ← main app
```

---

### asset-dependency-tool/

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
├── Report-fixed.docx                               ⚠️ One-off output? Remove?
├── QA_QC_REPORT.md
├── IT_COMMS_QUESTIONS.md
│
├── apps/
│   ├── reporter/
│   │   ├── build.ps1
│   │   ├── dev_smoke.py
│   │   ├── inject_anchors.py                        ⚠️ vs inject_anchors_into_body.py
│   │   ├── inject_anchors_into_body.py              ⚠️ Newer variant? Consolidate
│   │   ├── main.py
│   │   ├── perf_reporter.py
│   │   ├── pyproject.toml
│   │   ├── reporter.spec
│   │   ├── requirements.txt
│   │   ├── verify_output.py
│   │   ├── reporter/ (subpackage)
│   │   └── build/                                  ⚠️ Build output; add to .gitignore?
│   │
│   └── web/
│       ├── app/
│       │   ├── api/
│       │   │   ├── admin/                           ⚠️ Admin APIs; secure in prod?
│       │   │   ├── export/draft/, final/
│       │   │   ├── revision/export, import, metadata
│       │   │   ├── template/check
│       │   │   └── vofc/generate, ready
│       │   ├── assessment/
│       │   ├── components/ServiceWorkerRegister.tsx
│       │   ├── debug/                              ⚠️ DEPRECATION CANDIDATE: dev-only
│       │   │   ├── ui-config/
│       │   │   └── workbook-alignment/
│       │   ├── db/migrations/
│       │   ├── lib/
│       │   ├── template-readiness/
│       │   └── ...
│       │
│       ├── components/
│       ├── lib/
│       ├── public/
│       │   ├── sw.js
│       │   └── vofc-library.json                   ⚠️ Generated? Source of truth?
│       │
│       └── scripts/
│           ├── validate_dependency_parity.ts       ⚠️ Duplicate in tools/
│           ├── verify_*.js/.ts (many)              ⚠️ Consolidate verify scripts?
│           └── tests/
│
├── assets/
│   ├── templates/
│   │   ├── _dev_with_anchors.docx
│   │   ├── _dev_with_anchors.backup.docx           ⚠️ Backup; remove from repo?
│   │   ├── Asset Dependency Assessment Report_BLANK.docx
│   │   └── Asset Dependency Assessment Report_BLANK.backup.docx  ⚠️ Backup; remove?
│   └── workbooks/
│       └── Asset Dependency Visualization.xlsm
│
├── audit/                                          ← You are here
│   ├── invalid_followups_report.md
│   ├── missing_or_invalid_help_report.md
│   ├── outstanding_issues_question_audit.json
│   ├── save_json_structure_audit.md
│   ├── terminology_clarity_issues.md
│   ├── vulnerability_traceability_report.md
│   └── DEPRECATION_DIRECTORY.md
│
├── data/
│   └── dependency_vofc_local.json
│
├── docs/
│   ├── BASELINE_STATE.md
│   ├── DEPLOYMENT.md
│   ├── NEW_FUNCTION_TEMPLATE.md
│   ├── NEW_FUNCTIONS_BACKLOG.md
│   ├── PACKAGING-PLAN.md
│   ├── PERFORMANCE_TEST_PLAN.md
│   ├── PUNCH_LIST_ORIGINAL_TRACK.md                ⚠️ One-off tracking; archive?
│   ├── runtime/
│   ├── SECURITY.md
│   ├── TEMPLATE_ANCHORS.md
│   └── UI_REFERENCE_ELECTRICITY.md
│
├── doctrine/
│   └── dependencies/it_vs_communications_boundary.md
│
├── packages/
│   ├── engine/
│   ├── schema/
│   ├── security/                                   ⚠️ Minimal content; used?
│   └── ui/
│
├── scripts/
│   ├── archive/2026-02/scripts/add_table_summary_anchor.py   ✅ Archived one-off template helper
│   ├── archive/2026-02/scripts/test_reporter.ps1             ✅ Archived PowerShell harness
│   ├── build-vofc-json.ts
│   ├── build-web-with-tmp.js
│   ├── check_generated_integrity.ts
│   ├── dev/
│   │   ├── bootstrap.ps1
│   │   ├── clear-next-cache.ps1
│   │   ├── start.ps1
│   │   └── update-wastewater-axis.ps1
│   ├── dev.js
│   ├── extract_xlsm_ui_config.ts
│   ├── generate_report_fixed.ps1
│   ├── outstanding_issues_audit.ts
│   ├── release_gate.ts
│   ├── seed_dependency_vofc.ts
│   ├── tests/release_smoke.ps1
│   ├── validate_template_anchors.ts
│   ├── xlsm_cell_map.ts
│   └── xlsm_question_map.ts
│
└── tools/
    ├── release/README.md
    └── validate_dependency_parity.ts                ⚠️ Duplicate of apps/web/scripts/
```

---

## Deprecation decision matrix

Use this to record decisions.

| Path | Action | Owner | Notes |
|------|--------|-------|-------|
| `*.backup.docx` | ☐ Keep ☐ Remove ☐ .gitignore | | |
| `inject_anchors.py` vs `inject_anchors_into_body.py` | ☐ Consolidate ☐ Keep both ☐ Remove one | | |
| `app/debug/` | ☐ Keep ☐ Remove ☐ Gate behind NODE_ENV | | |
| `tools/validate_dependency_parity.ts` | ☐ Consolidate ☐ Keep in tools only ☐ Keep in web only | | |
| Root `test_*`, `main_baseline.py` | ✅ Archive legacy Python/PowerShell harness; confirm remaining test artifacts | | |
| `VOFC HTML Viewer/` | ☐ Active ☐ Archive ☐ Remove | | |
| `packages/security/` | ☐ Used ☐ Unused ☐ Expand | | |
| `CISA_Design_System.css` (2 copies) | ☐ Single source ☐ Keep both | | |
| `Report-fixed.docx` | ☐ Remove ☐ Archive | | |
| `PUNCH_LIST_ORIGINAL_TRACK.md` | ☐ Archive ☐ Remove | | |

---

## Legend

- ⚠️ = Potential deprecation candidate
- Duplicate = Same/similar file in multiple locations
- Backup = Auto-generated or manual backup
- Debug = Dev-only, not for production
- Legacy = Old approach, possibly superseded
- Test artifact = Generated during tests, not source

---

*Generated for deprecation planning. Update decisions in the matrix as you decide.*
