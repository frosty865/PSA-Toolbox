# Impact Curve Storage

Impact curve values are now stored under the assessment's `infrastructure` namespace instead of the legacy `curve_*` fields on the root object. Each dependency topic owns a small `curve` map that mirrors the chart input fields and keeps derived values isolated.

## Structure

```
assessment.infrastructure = {
  energy: {
    curve: {
      requires_service: true,
      time_to_impact: 6,
      loss_no_backup: 0.5,
      backup_duration: 12,
      loss_with_backup: 0.2,
      recovery_time: 36,
    },
  },
  communications: {
    curve: {
      requires_service: false,
      time_to_impact: 0,
      loss_no_backup: 0,
      recovery_time: 0,
    },
  },
};
```

Only populated keys are persisted. Empty curve objects are stripped so we avoid creating noise in saved progress files.

## Normalization workflow

- Call `normalizeCurveStorage` whenever we hydrate or persist an assessment (already wired through default assessment generation, local storage load/save, and progress file parsing).
- The normalizer will:
  1. Migrate any legacy `curve_*` keys (pre-namespacing) into the first dependency that needs them.
  2. Derive curve values from category inputs when the `infrastructure` node does not have data yet.
  3. Remove empty curve nodes to keep the infrastructure tree compact.

## Guidelines for new code

- Always run `normalizeCurveStorage` before serializing an assessment or writing it to disk/local storage.
- Use the helpers in `curve_accessors.ts` (`getCurveValue`, `setCurveValue`, `mergeCurveIntoCategory`, etc.) instead of reading or mutating `infrastructure` directly.
- When adding new derived fields under `infrastructure`, keep them side-by-side with `curve` so the normalizer can preserve unknown keys without additional work.

## Testing

New vitest coverage exercises:

- Curve normalization skips writes when nothing changes, removes empty nodes, and migrates legacy `curve_*` fields.
- Structured exposure mappers clear dependent fields when gates turn off and keep vehicle-impact follow-ups consistent.

Run `pnpm --filter web test` to execute the new tests.
