# ADA Repo Map

Canonical locations and single-source-of-truth modules for the Asset Dependency Tool.

## Root layout

Only essential files live at repo root: `.editorconfig`, `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `requirements.txt`, `vercel.json`. Design and implementation notes moved to `docs/design/` and `docs/implementation/`; reference docs (e.g. `REPO_TREE.md`, `RELEASE.md`) in `docs/`. Outdated or duplicate root files archived under `archive/ada_cleanup_YYYYMMDD/root_cleanup/`.

## Canonical template path

- **Only active template:** `ADA/report template.docx` (relative to repo root).
- Absolute example: `C:\ADA\asset-dependency-tool\ADA\report template.docx`
- All export, validation, and reporter code must use this path. No `assets/templates/` or `Asset Dependency Assessment Report_BLANK.docx` in active code paths.

## Fixtures

- **Inputs:** `ADA/_pilot_fixtures/inputs/` — test JSON payloads (e.g. `test_report_input.json`, `test_report_full.json`).
- **Exports:** `ADA/_pilot_fixtures/exports/` — optional sample DOCX/PDF outputs; may be gitignored to avoid bloat.

## Scripts

- **General:** `tools/` — `pilot_check.ps1`, `export_sample.ps1`.
- **Validation:** `tools/validation/` — `anchor_scan.ps1`, `style_scan.ps1`, `safe_scan.ps1`, and other audit scripts (see `tools/validation/AUDIT_PLAN.md`).

## Archive

- **Per Matt's rule:** archive root is `D:\psa-workspace\archive`.
- **Cleanup snapshot:** `D:\psa-workspace\archive\ada_cleanup_YYYYMMDD\` (e.g. `ada_cleanup_20250224`). If D: is not available, in-repo fallback: `archive/ada_cleanup_YYYYMMDD/`.
- Moved items: duplicate/legacy templates under `ada_cleanup_*/templates/`, old folders under `ada_cleanup_*/{original_folder_name}/`. Nothing is deleted.

## Single source of truth (modules)

- **Anchors list:** `packages/schema/src/template_anchors.ts` — `REQUIRED_TEMPLATE_ANCHORS`, `LEGACY_ANCHORS_TO_REMOVE`.
- **Template path:** `apps/web/app/lib/template/path.ts` — `CANONICAL_TEMPLATE_RELATIVE`, `getCanonicalTemplatePath()`, `findRootWithReporter()`.
- **Vulnerability builder / severity mapping / driver mapping:** (to be filled in after repo audit; see `ADA/DEAD_CODE_CHECKLIST.md`).
