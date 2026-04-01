# Snapshot policy

**Workbook wording changes must be reviewed and accepted via snapshot updates.**

- **ui_config.generated.test.ts**: Full UI_CONFIG snapshot. Any change to the generated file (labels, help, types, defaults) will fail until the snapshot is updated with `pnpm test:update` in the schema package.
- **ui_labels_regression.test.ts**: Label surface only (category title, per field: key, label, label_source). Use this to catch wording drift from the workbook. Updating the snapshot indicates acceptance of the new wording.
- **electric_power_labels.test.ts**: Electric Power category only (key, label, label_source). Labels must exactly match XLSM question wording (including punctuation). **If this snapshot changes, the reviewer must confirm the workbook changed.**

When the XLSM workbook is edited and the extractor is re-run, run `pnpm test:update` in `packages/schema` and review the diff before committing.
