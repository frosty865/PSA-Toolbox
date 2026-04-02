#!/usr/bin/env python3
"""
Deterministic transformer: Vulnerability JSON -> Module Import Payload

Converts vulnerability analysis JSON to module import payload with:
- Module OFCs (MOD_OFC_...) from physical security options
- Risk drivers (CYBER_DRIVER/FRAUD_DRIVER) from cyber/fraud options
- Sources extracted from references
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List

CYBER_FRAUD_TERMS = [
    "encryption",
    "two-factor",
    "2fa",
    "authenticate",
    "authentication",
    "network traffic",
    "monitor network",
    "packet",
    "api",
    "skimming",
    "identity theft",
    "payment",
    "transaction",
    "fraud",
    "data breach",
    "data theft",
]

def norm(s: str) -> str:
    """Normalize whitespace."""
    return re.sub(r"\s+", " ", (s or "")).strip()

def is_cyber_fraud(option_text: str, vuln_text: str, impact_text: str) -> bool:
    """Check if option is cyber/fraud related (should be risk driver, not OFC)."""
    blob = f"{option_text} {vuln_text} {impact_text}".lower()
    return any(t in blob for t in CYBER_FRAUD_TERMS)

def make_mod_ofc_id(module_short: str, n: int) -> str:
    """Generate deterministic MOD_OFC ID."""
    return f"MOD_OFC_{module_short}_{n:03d}"

def main():
    # INPUT/OUTPUT
    in_path = Path("analytics/extracted/ev_charging_vulnerabilities.json")
    out_path = Path("analytics/extracted/module_ev_charging_import_from_vuln.json")

    # MODULE METADATA
    module_code = "MODULE_EV_CHARGING"
    module_short = "EV_CHARGING"
    title = "Electric Vehicle Charging"
    description = "Additive module for EV charging station-related physical security, operations, and governance considerations."

    if not in_path.exists():
        print(f"[ERROR] Input file not found: {in_path}")
        return

    data = json.loads(in_path.read_text(encoding="utf-8"))
    root = data.get("Electric_Vehicle_Charging") or {}
    vulns = root.get("vulnerabilities") or []

    module_ofcs: List[Dict[str, Any]] = []
    risk_drivers: List[Dict[str, Any]] = []

    seq = 1
    for vi, v in enumerate(vulns):
        v_name = norm(v.get("vulnerability", ""))
        impact = norm(v.get("possible_impact", ""))
        opts = v.get("options_for_consideration") or []
        
        for oi, o in enumerate(opts):
            opt = norm(o.get("option", ""))
            ref = norm(o.get("reference", ""))

            if not opt:
                continue

            locator = {
                "vulnerability_index": vi,
                "option_index": oi,
                "vulnerability": v_name,
            }

            # Cyber/fraud options become risk drivers (context only) in PSA repo
            if is_cyber_fraud(opt, v_name, impact):
                driver_type = "FRAUD_DRIVER" if any(
                    t in (v_name + impact + opt).lower()
                    for t in ["fraud", "skimming", "identity theft", "payment", "transaction"]
                ) else "CYBER_DRIVER"
                
                risk_drivers.append({
                    "driver_type": driver_type,
                    "driver_text": f"{v_name}: {opt} — {impact}",
                    "source_locator": locator,
                    "reference": ref,
                })
                continue

            # Module OFC (module-owned, physical security scope)
            ofc_id = make_mod_ofc_id(module_short, seq)
            seq += 1

            # Keep OFC text capability-level, not implementation-specific phrasing
            # (still deterministic: light normalization only)
            ofc_text = opt
            if impact:
                ofc_text = f"{opt} Addresses: {impact}"

            module_ofcs.append({
                "ofc_id": ofc_id,
                "ofc_text": ofc_text,
                "order_index": len(module_ofcs) + 1,
                "source_system": "VULN_JSON",
                "source_locator": locator,
                "sources": [{"url": "", "label": ref}] if ref else [],
            })

    payload = {
        "module_code": module_code,
        "title": title,
        "description": description,
        "import_source": in_path.name,
        "mode": "REPLACE",
        "module_questions": [],  # module-owned only; add later if/when you have them
        "module_ofcs": module_ofcs,
        "risk_drivers": risk_drivers,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"[OK] wrote {out_path}")
    print(f"[OK] module_ofcs: {len(module_ofcs)}")
    print(f"[OK] risk_drivers: {len(risk_drivers)} (cyber/fraud context-only)")


if __name__ == "__main__":
    main()
