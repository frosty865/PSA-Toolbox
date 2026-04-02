#!/usr/bin/env python3
"""
Export sectors and subsectors from RUNTIME database to JSON file.
Creates the taxonomy file needed by create_sector_subsector_folders.py
"""
import json
import os
import sys
from pathlib import Path

# Add psa_rebuild directory to path to import db utilities
script_dir = Path(__file__).parent
tools_dir = script_dir.parent
psa_rebuild_dir = tools_dir.parent
sys.path.insert(0, str(psa_rebuild_dir))

# Load environment variables from .env.local or .local.env
def load_env_file():
    """Load environment variables from .env.local or .local.env file."""
    for env_file in (psa_rebuild_dir / ".env.local", psa_rebuild_dir / ".local.env"):
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")
            break

load_env_file()

from tools.db.runtime_db import get_runtime_conn

OUTPUT_FILE = Path(r"D:\PSA_System\psa_rebuild\taxonomy\sectors_subsectors.json")

def main():
    """Export sectors and subsectors from RUNTIME database to JSON."""
    conn = get_runtime_conn()
    cur = conn.cursor()
    
    try:
        # Load sectors
        cur.execute("""
            SELECT id, sector_name, name, description, is_active
            FROM sectors
            WHERE is_active = true
            ORDER BY COALESCE(sector_name, name)
        """)
        sectors_data = []
        for row in cur.fetchall():
            sector_id, sector_name, name, description, is_active = row
            sectors_data.append({
                'id': str(sector_id),
                'code': str(sector_id),  # Use id as code
                'name': sector_name or name or str(sector_id),
                'description': description,
                'is_active': is_active
            })
        
        # Load subsectors grouped by sector
        cur.execute("""
            SELECT s.id, s.name, s.sector_id, s.description, s.is_active,
                   sec.sector_name, sec.name as sector_name_alt
            FROM subsectors s
            INNER JOIN sectors sec ON s.sector_id = sec.id
            WHERE s.is_active = true AND sec.is_active = true
            ORDER BY sec.id, s.name
        """)
        
        # Group subsectors by sector
        subsectors_by_sector = {}
        for row in cur.fetchall():
            subsector_id, subsector_name, sector_id, description, is_active, sector_name, sector_name_alt = row
            sector_key = str(sector_id)
            if sector_key not in subsectors_by_sector:
                subsectors_by_sector[sector_key] = []
            subsectors_by_sector[sector_key].append({
                'id': str(subsector_id),
                'code': str(subsector_id),  # Use id as code
                'name': subsector_name,
                'description': description,
                'is_active': is_active
            })
        
        # Combine sectors with their subsectors
        output = {
            'sectors': []
        }
        
        for sector in sectors_data:
            sector_id = sector['id']
            subsectors = subsectors_by_sector.get(sector_id, [])
            sector_entry = {
                'code': sector['code'],
                'name': sector['name'],
                'subsectors': [
                    {'code': ss['code'], 'name': ss['name']}
                    for ss in subsectors
                ]
            }
            output['sectors'].append(sector_entry)
        
        # Write to file
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_FILE.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding='utf-8')
        
        print(f"✓ Exported {len(output['sectors'])} sectors with {sum(len(s['subsectors']) for s in output['sectors'])} subsectors")
        print(f"✓ Written to: {OUTPUT_FILE}")
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
