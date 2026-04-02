#!/usr/bin/env python3
"""Quick analysis script for duplicate OFC investigation."""
import json
from pathlib import Path

data = json.loads(Path("analytics/extracted/ist_vofc_raw.json").read_text(encoding="utf-8"))
ofc6 = [o for o in data["ofcs"] if o["ofc_ref_num"] == 6]

print("=" * 80)
print("OFC #6 DUPLICATE ANALYSIS")
print("=" * 80)

for i, o in enumerate(ofc6, 1):
    print(f"\n--- Entry {i} ---")
    print(f"Text length: {len(o['ofc_text'])} chars")
    print(f"Text preview: {o['ofc_text'][:150]}...")
    print(f"Source URL: {o['source_url']}")
    print(f"Source label: {o.get('source_label')}")
    print(f"Context question: {o.get('context_question', 'N/A')[:100]}...")

print("\n" + "=" * 80)
print("COMPARISON")
print("=" * 80)
print(f"Same URL: {all(o['source_url'] == ofc6[0]['source_url'] for o in ofc6)}")
print(f"Same text: {all(o['ofc_text'] == ofc6[0]['ofc_text'] for o in ofc6)}")
print(f"Texts are identical: {ofc6[0]['ofc_text'] == ofc6[1]['ofc_text']}")
