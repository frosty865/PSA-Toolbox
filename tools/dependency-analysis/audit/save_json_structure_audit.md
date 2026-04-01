# Save JSON Structure Audit

Generated: 2026-02-11

## Overview

The Asset Dependency Tool persists assessment data in multiple formats. This audit documents each structure, its schema, and consistency gaps.

---

## 1. Progress File (Download / Import)

**Path:** `apps/web/app/lib/io/progressFile.ts`  
**Filename:** `asset-dependency-progress-YYYY-MM-DD.json`  
**Use:** Save/load progress; file download and import.

### Structure

```json
{
  "tool": "asset-dependency-tool",
  "version": 1,
  "saved_at_iso": "2026-02-11T12:00:00.000Z",
  "assessment": { ... },
  "energy": {
    "answers": { ... },
    "derived": {
      "vulnerabilities": [],
      "ofcs": [],
      "reportBlocks": []
    },
    "saved_at_iso": "2026-02-11T12:00:00.000Z"
  },
  "comms": {
    "answers": { ... },
    "derived": { ... },
    "saved_at_iso": "2026-02-11T12:00:00.000Z"
  }
}
```

### Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tool` | string | Yes | Must be `"asset-dependency-tool"` |
| `version` | number | Yes | Must be `1` (import rejects other versions) |
| `saved_at_iso` | string (ISO) | Yes | Top-level timestamp |
| `assessment` | Assessment | Yes | Validated via `AssessmentSchema` |
| `energy` | EnergySnapshot | No | E-1–E-10 answers + derived; restores session |
| `comms` | CommsSnapshot | No | CO-1–CO-11 answers + derived; restores session |

### Gaps

- **Water** — Not included. Water answers are stored only in `assessment.categories.WATER`.
- **Wastewater** — Not included. Stored only in `assessment.categories.WASTEWATER`.
- **IT** — Not included. Stored only in `assessment.categories.INFORMATION_TECHNOLOGY`.

The assessment schema (CategoryInput) holds canonical curve + backup data for all categories, but the detailed questionnaire answers (IT-1–IT-11, WA-1–WA-11, WW-1–WW-11) are not persisted in a separate session snapshot like energy/comms.

---

## 2. localStorage (Assessment)

**Path:** `apps/web/app/lib/io/assessmentStorage.ts`  
**Key:** `asset-dependency-assessment`  
**Use:** Survive browser restarts and navigation.

### Structure

Uses `ProgressFileV1` via `buildProgressFile(assessment, undefined)` — so **no energy or comms** in localStorage. Only:

```json
{
  "tool": "asset-dependency-tool",
  "version": 1,
  "saved_at_iso": "...",
  "assessment": { ... }
}
```

Energy and comms are stored separately in `energy:storage` and `comms:storage` localStorage keys (see persistence.ts, energy_storage.ts).

---

## 3. Revision Package (Draft ZIP)

**Path:** `apps/web/app/api/export/draft/route.ts`  
**Archive entry:** `revision.pkg` (encrypted)  
**Use:** Encrypted backup; import restores assessment.

### Structure

The revision payload is raw `JSON.stringify(assessment)` — the **Assessment** object only. No progress file wrapper, no energy/comms snapshots.

```
revision.pkg = encrypt(JSON.stringify(assessment))
```

### Assessment Schema (Core)

```ts
{
  meta: { tool_version, template_version, created_at_iso },
  asset: { asset_name, visit_date_iso, location?, assessor? },
  categories: Record<CategoryCode, CategoryInput>,
  priority_restoration?: { energy, communications, information_technology, water, wastewater },
  cross_dependencies?: CrossDependency[] | CrossDependenciesNode,
  settings?: { pra_sla_enabled, cross_dependency_enabled }
}
```

### CategoryInput (per category)

- Curve: `requires_service`, `time_to_impact_hours`, `loss_fraction_no_backup`, `has_backup_any`, `backup_duration_hours`, `loss_fraction_with_backup`, `recovery_time_hours`
- Critical products, supply/sources, agreements (SLA/PRA)
- Equipment suppliers, maintenance, monitoring
- IT: `it_continuity_plan_exists`, `it_plan_exercised`, `it_exercise_scope`
- Comms: `comms_single_provider_restoration`, `comms_alternate_providers_or_paths`, `comms_restoration_constraints`

---

## 4. Dependency-Specific Session Storage

| Dependency | localStorage Key | Structure |
|------------|------------------|-----------|
| Energy | `energy:storage` | `{ answers, derived, saved_at_iso }` |
| Comms | `comms:storage` | `{ answers, derived?, saved_at_iso? }` |
| Water | — | Not persisted separately; only in assessment.categories.WATER |
| Wastewater | — | Not persisted separately; only in assessment.categories.WASTEWATER |
| IT | — | Not persisted separately; only in assessment.categories.INFORMATION_TECHNOLOGY |

---

## 5. Consistency Summary

| Source | Assessment | Energy | Comms | Water | Wastewater | IT |
|--------|------------|--------|-------|-------|------------|-----|
| Progress file | ✓ | ✓ | ✓ | — | — | — |
| localStorage (assessment) | ✓ | — | — | — | — | — |
| localStorage (energy) | — | ✓ | — | — | — | — |
| localStorage (comms) | — | — | ✓ | — | — | — |
| Revision package | ✓ | — | — | — | — | — |

**Assessment.categories** holds canonical curve + backup data for all five dependencies. The detailed questionnaire answers (E-1–E-10, CO-1–CO-11) are transformed into CategoryInput via `*_to_category_input.ts` for report/report generation. Energy and Comms also have separate session storage + progress file snapshots for full form restore.

---

## 6. Recommendations

1. **Extend ProgressFileV1** — Add `water`, `wastewater`, `it` snapshots if full session restore is required for those tabs.
2. **Version migration** — If ProgressFileV1 structure changes, bump `version` and add migration in `parseProgressFile`.
3. **Revision package** — Document that it contains only Assessment; energy/comms session state is not in the encrypted payload.
4. **Canonical source** — Assessment.categories is the canonical persisted shape; session storage is UI-scoped for energy/comms.
