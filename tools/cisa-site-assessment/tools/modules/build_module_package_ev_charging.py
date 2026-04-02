#!/usr/bin/env python3
"""
Deterministic Module Builder for EV Charging Module

Reads vulnerability JSON and produces a clean module import payload with:
- module_questions[] (module-owned, additive, asset+event anchored)
- module_ofcs[] (module-owned MOD_OFC_* IDs only)
- risk_drivers[] (clean, non-concatenated cyber/fraud context)

Rules:
- No baseline questions
- No IST_OFC_* IDs in module_ofcs
- Cyber/fraud controls become risk_drivers only
- Deterministic output
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple


def norm(s: str) -> str:
    """Normalize whitespace."""
    return re.sub(r"\s+", " ", (s or "")).strip()


# Anything that is explicitly cyber/fraud/payment/security-implementation is a risk driver context,
# not a PSA OFC or question in this repo.
CYBER_TERMS = [
    "encryption", "2fa", "two-factor", "authentication", "authenticate", "network traffic", "monitor network",
    "api", "malware", "ransomware", "breach", "cyber", "intrusion"
]
FRAUD_TERMS = ["skimming", "payment", "transaction", "fraud", "identity theft", "card", "chargeback"]


def classify_driver(vuln: str, impact: str, opt: str) -> str:
    """Classify if vulnerability/option is cyber/fraud driver."""
    blob = f"{vuln} {impact} {opt}".lower()
    if any(t in blob for t in FRAUD_TERMS):
        return "FRAUD_DRIVER"
    if any(t in blob for t in CYBER_TERMS):
        return "CYBER_DRIVER"
    return ""


def make_mod_ofc_id(n: int) -> str:
    """Generate module-owned OFC ID."""
    return f"MOD_OFC_EV_CHARGING_{n:03d}"


def make_mod_q_id(n: int) -> str:
    """Generate module-owned question ID."""
    return f"MODULEQ_EV_CHARGING_{n:03d}"


def main():
    in_path = Path("analytics/extracted/ev_charging_vuln.json")
    out_path = Path("analytics/extracted/module_ev_charging_import.json")

    if not in_path.exists():
        print(f"ERROR: Input file not found: {in_path}")
        print(f"Please create {in_path} with vulnerability data.")
        return 1

    data = json.loads(in_path.read_text(encoding="utf-8"))
    root = data.get("Electric_Vehicle_Charging") or {}
    vulns = root.get("vulnerabilities") or []

    # Deterministic module question set for EV Charging (module-owned, additive, asset+event anchored)
    # NOTE: no baseline re-use, no generic "supports physical security" phrasing.
    module_questions: List[Dict[str, Any]] = [
        {
            "id": make_mod_q_id(1),
            "text": "Is physical access to EV charging equipment components (e.g., enclosures, service panels, cabinets) restricted to authorized personnel?",
            "order": 1,
            "discipline_id": "",  # Must be filled by importer or manual edit
            "discipline_subtype_id": "",  # Must be filled by importer or manual edit
            "asset_or_location": "EV charging equipment components",
            "event_trigger": "TAMPERING"
        },
        {
            "id": make_mod_q_id(2),
            "text": "Is video coverage implemented for EV charging stations and their immediate approaches to support incident detection and post-incident review?",
            "order": 2,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging stations",
            "event_trigger": "TAMPERING"
        },
        {
            "id": make_mod_q_id(3),
            "text": "Is adequate lighting implemented at EV charging station locations to support visibility during hours of darkness?",
            "order": 3,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging station locations",
            "event_trigger": "TAMPERING"
        },
        {
            "id": make_mod_q_id(4),
            "text": "Is a user-accessible method provided to request assistance or report an emergency at EV charging station locations?",
            "order": 4,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging station locations",
            "event_trigger": "OTHER"
        },
        {
            "id": make_mod_q_id(5),
            "text": "Is there a documented process to inspect EV charging stations for damage, tampering indicators, and unsafe conditions?",
            "order": 5,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging stations",
            "event_trigger": "TAMPERING"
        },
        {
            "id": make_mod_q_id(6),
            "text": "Are EV charging cables and connectors managed and maintained to reduce tampering opportunities and physical safety hazards?",
            "order": 6,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging cables and connectors",
            "event_trigger": "TAMPERING"
        },
        {
            "id": make_mod_q_id(7),
            "text": "Are responsibilities defined for coordinating with site management or service providers to restore safe operation following damage or disruption at EV charging station locations?",
            "order": 7,
            "discipline_id": "",
            "discipline_subtype_id": "",
            "asset_or_location": "EV charging station locations",
            "event_trigger": "OUTAGE"
        }
    ]

    # Convert options_for_consideration to module_ofcs (only PSA-scope ones)
    module_ofcs: List[Dict[str, Any]] = []
    risk_drivers: List[Dict[str, Any]] = []

    ofc_seq = 1
    for vi, v in enumerate(vulns):
        vuln = norm(v.get("vulnerability", ""))
        impact = norm(v.get("possible_impact", ""))
        opts = v.get("options_for_consideration") or []

        for oi, o in enumerate(opts):
            opt = norm(o.get("option", ""))
            ref = norm(o.get("reference", ""))
            locator = {"vulnerability_index": vi, "option_index": oi, "vulnerability": vuln}

            driver_type = classify_driver(vuln, impact, opt)
            if driver_type:
                # store as context only (clean, non-concatenated)
                risk_drivers.append({
                    "driver_type": driver_type,
                    "driver_text": vuln,
                    "impact": impact,
                    "example": opt,
                    "reference": ref,
                    "source_locator": locator
                })
                continue

            ofc_id = make_mod_ofc_id(ofc_seq)
            ofc_seq += 1

            ofc_text = opt
            if impact:
                ofc_text = f"{opt} Addresses: {impact}"

            module_ofcs.append({
                "ofc_id": ofc_id,
                "ofc_text": ofc_text,
                "order_index": len(module_ofcs) + 1,
                "source_system": "VULN_JSON",
                "source_ofc_id": None,
                "source_ofc_num": None,
                "source_locator": locator,
                "sources": ([{"url": "", "label": ref}] if ref else [])
            })

    payload = {
        "module_code": "MODULE_EV_CHARGING",
        "title": "EV Charging Stations",
        "description": "Optional module to assess EV charging station physical security, safety interfaces, and operational integration.",
        "import_source": in_path.name,
        "mode": "REPLACE",
        "module_questions": module_questions,
        "module_ofcs": module_ofcs,
        "risk_drivers": risk_drivers
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"[OK] wrote {out_path}")
    print(f"[OK] module_questions: {len(module_questions)}")
    print(f"[OK] module_ofcs: {len(module_ofcs)}")
    print(f"[OK] risk_drivers: {len(risk_drivers)}")
    print(f"\n[NOTE] Discipline IDs must be filled manually before import.")
    print(f"       Edit {out_path} and add discipline_id and discipline_subtype_id UUIDs to each question.")

    return 0


if __name__ == "__main__":
    exit(main())
