#!/usr/bin/env python3
"""
Convert Vulnerability Analysis JSON to Module Curated OFCs

Takes vulnerability analysis JSON and converts it to curated OFCs format
for module import.
"""

import json
from pathlib import Path
from typing import Dict, List, Any

def convert_vulnerabilities_to_ofcs(vuln_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert vulnerability analysis to curated OFCs.
    
    Input format:
    {
      "Electric_Vehicle_Charging": {
        "vulnerabilities": [
          {
            "vulnerability": "...",
            "possible_impact": "...",
            "options_for_consideration": [
              {
                "option": "...",
                "reference": "..."
              }
            ]
          }
        ]
      }
    }
    
    Output: List of curated OFC objects
    """
    curated_ofcs = []
    ofc_num = 1
    
    # Extract vulnerabilities
    ev_charging = vuln_data.get("Electric_Vehicle_Charging", {})
    vulnerabilities = ev_charging.get("vulnerabilities", [])
    
    for vuln in vulnerabilities:
        vuln_name = vuln.get("vulnerability", "")
        impact = vuln.get("possible_impact", "")
        options = vuln.get("options_for_consideration", [])
        
        # Create an OFC for each option
        for option_obj in options:
            option_text = option_obj.get("option", "")
            reference = option_obj.get("reference", "")
            
            if not option_text:
                continue
            
            # Build OFC text: combine option with context
            ofc_text_parts = [option_text]
            if impact:
                ofc_text_parts.append(f"Addresses: {impact}")
            
            ofc_text = " ".join(ofc_text_parts)
            
            # Create OFC
            ofc = {
                "ofc_id": f"IST_OFC_{ofc_num:06d}",
                "ofc_num": ofc_num,
                "ofc_text": ofc_text,
                "source_urls": [reference] if reference else [],
                "source_labels": [reference] if reference else [],
            }
            
            curated_ofcs.append(ofc)
            ofc_num += 1
    
    return curated_ofcs


def main():
    # Read the vulnerability data (could be from stdin or file)
    import sys
    
    if len(sys.argv) > 1:
        input_file = Path(sys.argv[1])
        vuln_data = json.loads(input_file.read_text(encoding="utf-8"))
    else:
        # Read from stdin
        vuln_data = json.loads(sys.stdin.read())
    
    # Convert to OFCs
    curated_ofcs = convert_vulnerabilities_to_ofcs(vuln_data)
    
    # Read existing module import file
    import_file = Path("analytics/extracted/module_ev_charging_import.json")
    if import_file.exists():
        module_data = json.loads(import_file.read_text(encoding="utf-8"))
    else:
        # Create new module data
        module_data = {
            "module_code": "MODULE_EV_CHARGING",
            "title": "EV Charging Stations",
            "description": "Optional module to assess EV charging station physical security, safety interfaces, and operational integration.",
            "questions": [],
            "curated_ofcs": []
        }
    
    # Merge OFCs (append new ones, avoiding duplicates by ofc_id)
    existing_ids = {o.get("ofc_id") for o in module_data.get("curated_ofcs", [])}
    new_ofcs = [o for o in curated_ofcs if o.get("ofc_id") not in existing_ids]
    
    module_data["curated_ofcs"].extend(new_ofcs)
    
    # Sort by ofc_num
    module_data["curated_ofcs"].sort(key=lambda x: x.get("ofc_num", 999999))
    
    # Write back
    import_file.parent.mkdir(parents=True, exist_ok=True)
    import_file.write_text(json.dumps(module_data, indent=2), encoding="utf-8")
    
    print(f"[OK] Converted {len(curated_ofcs)} vulnerabilities to {len(new_ofcs)} new OFCs")
    print(f"[OK] Total OFCs in module: {len(module_data['curated_ofcs'])}")
    print(f"[OK] Updated: {import_file}")


if __name__ == "__main__":
    main()
