#!/usr/bin/env python3
"""
Build EV Charging Module Import File

Reads analytics/extracted/ist_vofc_all.json and filters OFCs for EV Charging.
Emits analytics/extracted/module_ev_charging_import.json ready for admin import.

EDIT: Choose one of these approaches:
- EV_OFC_NUM_ALLOWLIST: Set of specific OFC numbers to include
- EV_KEYWORDS: Keyword filter (default: searches for EV/charging terms in OFC text)
"""

import json
from pathlib import Path

# EDIT: choose one of these approaches:
EV_OFC_NUM_ALLOWLIST = set()  # populate with ints if you know exact OFC nums
# Example: EV_OFC_NUM_ALLOWLIST = {61, 62, 63}  # specific OFC numbers

EV_KEYWORDS = [
    "electric vehicle",
    "ev ",
    "charging",
    "charger",
    "station",
    "battery",
    "plug",
    "vehicle charging",
    "evse",  # Electric Vehicle Supply Equipment
]  # keyword filter (case-insensitive)

MODULE_CODE = "MODULE_EV_CHARGING"
TITLE = "EV Charging Stations"
DESCRIPTION = "Optional module to assess EV charging station physical security, safety interfaces, and operational integration."

# TODO: fill with real canon_ids for your EV Charging question set
# These should be canon_ids that exist in baseline_spines_runtime
# Sample questions (replace with actual EV Charging relevant questions):
QUESTIONS = [
    "BASE-ACS-001",  # Entry control
    "BASE-ACS-ACS_ELECTRONIC_ACCESS_CONTROL",  # Electronic access control
    "BASE-ACS-ACS_DOOR_MONITORING",  # Door monitoring
    "BASE-CPTED-001",  # Site layout and environmental design
]


def main():
    src = Path("analytics/extracted/ist_vofc_all.json")
    if not src.exists():
        print(f"[ERROR] Source file not found: {src}")
        print("  Run: python tools/corpus/parse_ist_vofc_html.py")
        return 1

    try:
        obj = json.loads(src.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERROR] Failed to parse {src}: {e}")
        return 1

    ofcs = obj.get("ofcs", [])
    if not ofcs:
        print(f"[WARN] No OFCs found in {src}")
        return 1

    print(f"[INFO] Processing {len(ofcs)} OFCs from {src}")

    curated = []
    for o in ofcs:
        num = o.get("ofc_num")
        text = (o.get("ofc_text") or "").lower()

        # If allowlist is set, use it exclusively
        if EV_OFC_NUM_ALLOWLIST:
            if num in EV_OFC_NUM_ALLOWLIST:
                curated.append(o)
            continue

        # Otherwise, use keyword filter
        if any(k.lower() in text for k in EV_KEYWORDS):
            curated.append(o)

    out = {
        "module_code": MODULE_CODE,
        "title": TITLE,
        "description": DESCRIPTION,
        "questions": QUESTIONS,
        "curated_ofcs": curated,
    }

    Path("analytics/extracted").mkdir(parents=True, exist_ok=True)
    out_path = Path("analytics/extracted/module_ev_charging_import.json")
    out_path.write_text(json.dumps(out, indent=2), encoding="utf-8")

    print(f"[OK] Curated {len(curated)} OFCs -> {out_path}")
    print(f"[INFO] Module code: {MODULE_CODE}")
    print(f"[INFO] Title: {TITLE}")
    print(f"[INFO] Questions: {len(QUESTIONS)}")
    print(f"[INFO] Curated OFCs: {len(curated)}")

    if not QUESTIONS:
        print("[WARN] QUESTIONS is empty. Fill it with real question canon_ids before importing.")
        print("  Edit this script and set QUESTIONS = ['canon_id_1', 'canon_id_2', ...]")

    if len(curated) == 0:
        print("[WARN] No OFCs matched the filter criteria.")
        if EV_OFC_NUM_ALLOWLIST:
            print(f"  Allowlist: {sorted(EV_OFC_NUM_ALLOWLIST)}")
        else:
            print(f"  Keywords: {EV_KEYWORDS}")
        print("  Consider adjusting EV_OFC_NUM_ALLOWLIST or EV_KEYWORDS")

    return 0


if __name__ == "__main__":
    exit(main())
