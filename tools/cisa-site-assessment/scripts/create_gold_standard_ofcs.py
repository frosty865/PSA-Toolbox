#!/usr/bin/env python3
"""
Create Gold Standard OFC Set

Creates 15 OFCs for Access Control Systems (ACS) discipline:
- Electronic Access Control (5 OFCs)
- Door Monitoring (5 OFCs)
- Visitor Management Systems (5 OFCs)

Uses the Module Data Management API endpoint to create OFCs.
"""

import json
import os
import sys
import requests
from pathlib import Path
from typing import Dict, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env_file('.env.local')

# Base URL for API (assumes localhost:3000 for Next.js dev server)
BASE_URL = os.environ.get('NEXT_PUBLIC_API_URL', 'http://localhost:3000')

# Discipline and Subtype IDs
DISCIPLINE_ID = "18d45ffa-6a44-4817-becb-828231b9e1e7"  # Access Control Systems

SUBTYPE_IDS = {
    "ELECTRONIC_ACCESS_CONTROL": "3227ab36-7f31-4be4-a0c2-0f838518fa96",
    "DOOR_MONITORING": "244c4ee1-2f2e-4014-96cc-8a32877ef1d2",
    "VISITOR_MANAGEMENT_SYSTEMS": "6abbccac-a6ba-4b8d-a451-1bc099e62b96"
}

# OFCs to create
OFCS = [
    # Electronic Access Control (5)
    {
        "title": "Access Control Policy Framework",
        "ofc_text": "Establish a written access control policy that defines authorization levels, access procedures, and accountability requirements for all controlled entry points.",
        "discipline_subtype_id": SUBTYPE_IDS["ELECTRONIC_ACCESS_CONTROL"],
        "ofc_class": "FOUNDATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Access Control System Design",
        "ofc_text": "Design and implement an electronic access control system that governs who can access which areas, when access is permitted, and under what conditions access is granted.",
        "discipline_subtype_id": SUBTYPE_IDS["ELECTRONIC_ACCESS_CONTROL"],
        "ofc_class": "FOUNDATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Access Control Monitoring",
        "ofc_text": "Maintain continuous monitoring of access control system activity to detect unauthorized access attempts, unusual access patterns, and system anomalies.",
        "discipline_subtype_id": SUBTYPE_IDS["ELECTRONIC_ACCESS_CONTROL"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Access Control Activity Logging",
        "ofc_text": "Generate and retain access control activity logs that record all access attempts, successful entries, denied entries, and administrative changes to the system.",
        "discipline_subtype_id": SUBTYPE_IDS["ELECTRONIC_ACCESS_CONTROL"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Access Control Point Coverage",
        "ofc_text": "Install access control devices at all perimeter entry points and interior doors leading to sensitive or restricted areas.",
        "discipline_subtype_id": SUBTYPE_IDS["ELECTRONIC_ACCESS_CONTROL"],
        "ofc_class": "PHYSICAL",
        "status": "PENDING"
    },
    
    # Door Monitoring (5)
    {
        "title": "Door Monitoring Procedures",
        "ofc_text": "Establish procedures for monitoring door status, responding to door alarms, and investigating door-related security events.",
        "discipline_subtype_id": SUBTYPE_IDS["DOOR_MONITORING"],
        "ofc_class": "FOUNDATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Door Status Monitoring",
        "ofc_text": "Monitor door open and closed states continuously to detect propped doors, forced entry, and unauthorized access through controlled entry points.",
        "discipline_subtype_id": SUBTYPE_IDS["DOOR_MONITORING"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Door Alarm Response",
        "ofc_text": "Ensure door alarms are monitored continuously and that security personnel respond promptly to door alarm activations to verify the cause and take appropriate action.",
        "discipline_subtype_id": SUBTYPE_IDS["DOOR_MONITORING"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Door Alarm Investigation Process",
        "ofc_text": "Maintain a documented process for investigating repeated door alarms to identify root causes, address systemic issues, and prevent false alarm fatigue.",
        "discipline_subtype_id": SUBTYPE_IDS["DOOR_MONITORING"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Door Monitoring Sensor Installation",
        "ofc_text": "Install door position sensors on all controlled entry points to detect door open, door closed, and forced entry conditions.",
        "discipline_subtype_id": SUBTYPE_IDS["DOOR_MONITORING"],
        "ofc_class": "PHYSICAL",
        "status": "PENDING"
    },
    
    # Visitor Management Systems (5)
    {
        "title": "Visitor Management Policy",
        "ofc_text": "Establish a visitor management policy that defines how visitors, contractors, and other non-badged individuals are identified, authorized, recorded, and controlled while on site.",
        "discipline_subtype_id": SUBTYPE_IDS["VISITOR_MANAGEMENT_SYSTEMS"],
        "ofc_class": "FOUNDATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Visitor Authorization Procedures",
        "ofc_text": "Implement procedures requiring visitors to be authorized by an employee or designated sponsor before being granted access to the facility.",
        "discipline_subtype_id": SUBTYPE_IDS["VISITOR_MANAGEMENT_SYSTEMS"],
        "ofc_class": "FOUNDATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Visitor Identification and Verification",
        "ofc_text": "Verify visitor identity using government-issued identification and maintain a record of all visitors including name, purpose of visit, sponsor, arrival time, and departure time.",
        "discipline_subtype_id": SUBTYPE_IDS["VISITOR_MANAGEMENT_SYSTEMS"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Visitor Escort Requirements",
        "ofc_text": "Require visitors to be escorted by authorized personnel when accessing areas beyond public reception areas or when visiting restricted or sensitive spaces.",
        "discipline_subtype_id": SUBTYPE_IDS["VISITOR_MANAGEMENT_SYSTEMS"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    },
    {
        "title": "Visitor Accountability During Incidents",
        "ofc_text": "Maintain a method to account for all visitors and contractors present in the facility during emergency situations or security incidents.",
        "discipline_subtype_id": SUBTYPE_IDS["VISITOR_MANAGEMENT_SYSTEMS"],
        "ofc_class": "OPERATIONAL",
        "status": "PENDING"
    }
]

def create_ofc(ofc_data: Dict) -> Dict:
    """Create an OFC via the API."""
    url = f"{BASE_URL}/api/admin/module-ofcs/create"
    
    response = requests.post(url, json=ofc_data)
    
    if response.status_code == 201:
        return response.json()
    else:
        error_data = response.json() if response.content else {}
        raise Exception(f"Failed to create OFC: {response.status_code} - {error_data.get('error', 'Unknown error')} - {error_data.get('message', '')}")

def main():
    """Create all gold-standard OFCs."""
    print("=" * 70)
    print("GOLD STANDARD OFC CREATION")
    print("=" * 70)
    print(f"\nCreating {len(OFCS)} OFCs for Access Control Systems (ACS)")
    print(f"Discipline ID: {DISCIPLINE_ID}")
    print(f"\nSubtypes:")
    for name, subtype_id in SUBTYPE_IDS.items():
        print(f"  - {name}: {subtype_id}")
    
    print(f"\nAPI Base URL: {BASE_URL}")
    print("\n" + "=" * 70)
    
    created = []
    failed = []
    
    for i, ofc_data in enumerate(OFCS, 1):
        print(f"\n[{i}/{len(OFCS)}] Creating: {ofc_data['title']}")
        print(f"  Subtype: {ofc_data['discipline_subtype_id']}")
        print(f"  Class: {ofc_data['ofc_class']}")
        
        try:
            result = create_ofc(ofc_data)
            created.append({
                "title": ofc_data['title'],
                "id": result.get('ofc', {}).get('id'),
                "status": result.get('ofc', {}).get('status')
            })
            print(f"  ✅ Created: {result.get('ofc', {}).get('id')}")
        except Exception as e:
            failed.append({
                "title": ofc_data['title'],
                "error": str(e)
            })
            print(f"  ❌ Failed: {e}")
    
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"\nCreated: {len(created)}/{len(OFCS)}")
    print(f"Failed: {len(failed)}/{len(OFCS)}")
    
    if created:
        print("\n✅ Successfully created OFCs:")
        for c in created:
            print(f"  - {c['title']} (ID: {c['id']}, Status: {c['status']})")
    
    if failed:
        print("\n❌ Failed OFCs:")
        for f in failed:
            print(f"  - {f['title']}: {f['error']}")
    
    # Save results to file
    results_path = Path(__file__).parent.parent / 'analytics' / 'reports' / 'gold_standard_ofc_creation.json'
    results_path.parent.mkdir(parents=True, exist_ok=True)
    
    results = {
        "timestamp": str(results_path),
        "total_ofcs": len(OFCS),
        "created": len(created),
        "failed": len(failed),
        "created_ofcs": created,
        "failed_ofcs": failed
    }
    
    results_path.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(f"\n[RESULTS] Written to: {results_path}")
    
    if failed:
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
