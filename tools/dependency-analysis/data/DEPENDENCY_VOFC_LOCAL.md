# DEPENDENCY_VOFC_LOCAL — Single Source of Truth

**Doctrine:** 1 vulnerability per dependency condition code, up to 4 OFCs per row. Deterministic export via condition_code lookup only.

## Sheet Specification

**Workbook:** `assets/workbooks/Asset Dependency Visualization.xlsm`  
**Sheet name:** `DEPENDENCY_VOFC_LOCAL`

**Headers (Row 1, exact):**
| condition_code | infrastructure | vulnerability | ofc_1 | ofc_2 | ofc_3 | ofc_4 | source_type | source_reference | approved | version |

**Rules:**
- `condition_code`: REQUIRED, UNIQUE
- `infrastructure`: REQUIRED — `ENERGY` | `COMMUNICATIONS` | `INFORMATION_TRANSPORT` | `WATER` | `WASTEWATER`
- `vulnerability`: REQUIRED (single canonical sentence/paragraph)
- `ofc_1`..`ofc_4`: OPTIONAL, max 4 total; neutral language (no install/issue/implement/must/require)
- `source_type`: `VOFC_XLS` | `CISA_GUIDE` | `NIST` | `OTHER`
- `source_reference`: REQUIRED (sheet/cell/row or document pointer)
- `approved`: TRUE/FALSE — only TRUE appears in exports
- `version`: `dep_v1` (or later)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run export:dep-vofc-sheet` | Export `dependency_vofc_local.json` → `data/DEPENDENCY_VOFC_LOCAL.xlsx` |
| `pnpm run add:dep-vofc-sheet` | Add DEPENDENCY_VOFC_LOCAL sheet to main workbook (from xlsx) |
| `pnpm run seed:dep-vofc` | Seed from sheet via admin API (requires web dev server) |
| `pnpm run seed:dep-vofc -- --direct` | Seed directly to JSON (local script execution) |
| `pnpm run seed:dep-vofc -- --from-json` | Use existing JSON as source (ts script; migration/fallback) |

## Source Priority (seed script)

1. `assets/workbooks/Asset Dependency Visualization.xlsm` — sheet `DEPENDENCY_VOFC_LOCAL`
2. `data/DEPENDENCY_VOFC_LOCAL.xlsx` — local workbook file
3. `--from-json` — use existing `dependency_vofc_local.json`

## Enforcements (seed fails if)

- Duplicate `condition_code`
- Missing required fields
- Forbidden verbs in OFCs (install, issue, implement, must, require, etc.)
- Blocked baseline keywords (cctv, badging, ids, cyber plan, etc.)
