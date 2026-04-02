# Artifacts Directory

## Purpose

This directory contains **generated, temporary, deletable outputs** from processes, tools, and analysis.

## What Belongs Here

- Generated UI documentation
- Test exports
- Analysis outputs
- Temporary reports
- Generated documentation
- Tool outputs

## What Does NOT Belong Here

- **Source code**: Code belongs in project root or appropriate modules
- **Doctrine**: Doctrine belongs in `psa_engine` or `docs/doctrine/` (read-only)
- **Process documentation**: Process docs belong in `docs/process/`
- **Decisions**: Decisions belong in `docs/decisions/`

## Classification

- **Type**: Generated/temporary outputs
- **Authority**: None (derived data)
- **Modifiable**: Yes (regenerated as needed)
- **Purpose**: Temporary storage for generated content
- **Deletable**: Yes (safe to delete and regenerate)

## Examples

- `ui_component_docs.json` - Generated component documentation
- `workflow_diagrams.svg` - Generated workflow diagrams
- `test_export_output.json` - Test exports

---

**See `../AUTHORITY.md` for full authority boundaries.**

