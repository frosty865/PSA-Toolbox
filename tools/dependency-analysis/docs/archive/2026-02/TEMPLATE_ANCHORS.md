# Template Anchors (Archived)

Historical notes on template anchors used during Workbook export and report rendering. Superseded by automated extraction scripts in `scripts/validate_template_anchors.ts`.

## Purpose

- Track anchor identifiers used in Excel templates for mapping data fields.
- Provide quick reference for manual template updates.

## Anchor Format

- `ANCHOR_<CATEGORY>_<FIELD>` naming convention.
- Anchors placed in hidden worksheet cells to avoid interfering with layout.

## Maintenance Workflow (Legacy)

1. Open the Excel template (`assets/templates/*.xlsx`).
2. Insert or update anchors using consistent naming.
3. Run `scripts/extract_xlsm_ui_config.ts` to validate mapping.
4. Update documentation (this file) with new anchors and descriptions.

## Archive Notes

- New anchor management lives in generated documentation under `docs/runtime/template_anchors.md`.
- Use the validation script to audit templates instead of manual notes.
