#!/usr/bin/env python3
"""Check if external verification is working."""
import json
from pathlib import Path

# Load schema
schema = json.loads(Path("analytics/reports/ofc_link_schema_discovery.json").read_text())
print("Schema check:")
print(f"  source_registry_id_col: {schema['selected_ofc_table'].get('source_registry_id_col')}")
print(f"  source_id_col: {schema['selected_ofc_table'].get('source_id_col')}")
print(f"  source_registry exists: {schema.get('selected_source_registry') is not None}")

# Load link candidates
candidates = json.loads(Path("analytics/reports/ofc_link_candidates_topN.json").read_text())
all_promoted = []
all_suggested = []
for r in candidates.get("results", []):
    all_promoted.extend(r.get("promoted", []))
    all_suggested.extend(r.get("suggested", []))

ist_external = [p for p in all_promoted + all_suggested if p.get("external_verified") == True]
ist_reason = [p for p in all_promoted + all_suggested if p.get("eligibility_reason") == "IST_EXTERNAL_VERIFIED"]

print(f"\nLink candidates check:")
print(f"  Total promoted: {len(all_promoted)}")
print(f"  Total suggested: {len(all_suggested)}")
print(f"  With external_verified=true: {len(ist_external)}")
print(f"  With eligibility_reason=IST_EXTERNAL_VERIFIED: {len(ist_reason)}")

if ist_external:
    print(f"\nSample externally verified:")
    print(json.dumps(ist_external[0], indent=2))
