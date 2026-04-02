# Legacy Baseline Guard (NON-NEGOTIABLE)

Baseline canon import sources:
- doctrine/baseline_canon/baseline_spines.v1.json (authoring)
- doctrine/baseline_canon/baseline_canon_runtime.v1.json (generated build artifact)

Forbidden:
- Direct reads from legacy baseline question tables as an import source
- Any code path that mutates legacy baseline tables
- Any importer that accepts legacy baseline JSON as a substitute for baseline_spines.v1.json

Required:
- All downstream consumers (UI/export/analyzer/importers) must use baseline_canon_runtime.v1.json or baseline_spines.v1.json
- Failing closed is required: missing canon files must raise hard errors
