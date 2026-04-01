# Snapshot drift policy

Snapshots in this directory are **authoritative expected behavior** for VOFC calibration regression. They freeze:

- Trigger matching
- Applicability assignment (CONFIRMED vs POTENTIAL)
- Normalization rules (neutral language only)
- Calibration (base → calibrated severity, and reasons)
- Ordering (calibrated_severity DESC, applicability CONFIRMED before POTENTIAL, vofc_id ASC)
- 4-per-category cap

## Changing snapshots

1. **If the change is intended** (e.g. you changed calibration bands or MAP rules):
   - Update `MINIMAL_VOFC_RULES` or assessment fixtures in `__fixtures__/` if the intended behavior requires it.
   - Document the rationale in the commit or in this file.
   - Re-run: `pnpm --filter engine test:update` to refresh snapshots.
2. **If the change is unintended**: fix the code so that behavior matches the existing snapshots; do not update snapshots.

## Ordering and cap

- **Ordering**: Items are sorted by calibrated severity (HIGH first), then applicability (CONFIRMED before POTENTIAL), then `vofc_id` (ascending). This order is stable and snapshot-sensitive.
- **4-per-category cap**: At most 4 VOFCs per category are returned; the rest are dropped after the sort. The cap is defined in `map_doctrine.ts` (`MAX_VOFC_PER_CATEGORY`).

## Determinism

- `generated_at_iso` and `tool_version` are stubbed in tests via `freezeCollectionMeta()` so snapshots do not depend on `Date.now()` or build version.
- Snapshots are produced with `stableStringify()` (sorted object keys, arrays in order, 2-space indent) so output is deterministic across OS and time.

## Golden DOCX artifacts

Golden DOCX artifacts (e.g. in `data/exports/_golden/`) are **manual review items** produced by running the export smoke test after the production template has all anchors placed. Do **not** commit them unless required for release or audit; they are large binary files. The release gate (`pnpm release:gate`) runs template check and export smoke to ensure the pipeline is safe without storing output.
