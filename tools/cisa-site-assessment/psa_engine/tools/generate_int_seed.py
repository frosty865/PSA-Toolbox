#!/usr/bin/env python3
"""Generate INT template seed file from analyzer output."""

import json
import re
import os
from collections import defaultdict
from pathlib import Path

# Use relative paths from script location
_script_dir = Path(__file__).parent
_project_root = _script_dir.parent.parent.parent
SOURCE_JSON = _project_root / "analytics" / "reports" / "legacy_baseline_refactor_map.json"
OUT = _script_dir.parent / "doctrine" / "baseline_canon" / "review_packets" / "INT_templates.seed.json"

def load_records(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return data
    for k in ("items", "records", "results", "rows"):
        if k in data and isinstance(data[k], list):
            return data[k]
    raise ValueError("Unrecognized analyzer output shape")

def clean_hint(q):
    q = re.sub(r"\s+", " ", (q or "").strip())
    return q[:180]

def main():
    recs = load_records(SOURCE_JSON)
    
    int_systems = []
    for r in recs:
        if not isinstance(r, dict):
            continue
        code = (r.get("discipline_subtype_code") or "").strip()
        if not code.startswith("INT_"):
            continue
        dim = (r.get("capability_dimension") or "").strip()
        if dim != "SYSTEMS":
            continue
        int_systems.append(r)
    
    by_code = defaultdict(list)
    for r in int_systems:
        code = r.get("discipline_subtype_code")
        q = r.get("question_text") or r.get("question") or ""
        by_code[code].append(q)
    
    seed = {
        "generated_from": str(SOURCE_JSON),
        "discipline": "INT",
        "note": "Fill 'template' with YES/NO-form boundary control assertions. Keys must match discipline_subtype_code exactly. Leave empty to keep non-spine.",
        "templates": {}
    }
    
    for code, qs in sorted(by_code.items()):
        examples = [clean_hint(x) for x in qs if x][:3]
        seed["templates"][code] = {
            "template": "",
            "examples_from_legacy": examples
        }
    
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(seed, f, ensure_ascii=False, indent=2)
    
    print(f"[OK] Generated INT seed with {len(seed['templates'])} templates")
    print(f"     Output: {OUT}")

if __name__ == "__main__":
    main()
