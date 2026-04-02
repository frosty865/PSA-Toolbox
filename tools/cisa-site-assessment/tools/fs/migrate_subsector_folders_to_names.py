#!/usr/bin/env python3
"""
Migrate subsector folders from numeric codes to slugified names.
This script renames existing numeric folders to use readable names.
"""
import json
import re
import shutil
from pathlib import Path

BASE_PATH = Path(r"D:\PSA_System\data\download")
TAXONOMY_FILE = Path(r"D:\PSA_System\psa_rebuild\taxonomy\sectors_subsectors.json")

def slug(s: str) -> str:
    """Normalize string to folder-safe slug."""
    s = (s or "").strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Za-z0-9_\-]", "", s)
    return s

def main():
    """Migrate subsector folders from codes to names."""
    if not TAXONOMY_FILE.exists():
        print(f"❌ Taxonomy file not found: {TAXONOMY_FILE}")
        return
    
    with open(TAXONOMY_FILE, 'r', encoding='utf-8') as f:
        taxonomy = json.load(f)
    
    sectors = taxonomy.get('sectors', [])
    
    if not BASE_PATH.exists():
        print(f"❌ Download folder not found: {BASE_PATH}")
        return
    
    migrated = 0
    created = 0
    errors = []
    
    for sector in sectors:
        sector_code = sector.get('code', '')
        sector_name = sector.get('name', '')
        subsectors = sector.get('subsectors', [])
        
        sector_path = BASE_PATH / sector_code
        if not sector_path.exists():
            continue
        
        for subsector in subsectors:
            subsector_code = str(subsector.get('code', ''))
            subsector_name = subsector.get('name', '')
            
            if not subsector_name:
                continue
            
            # Old folder (numeric code)
            old_folder = sector_path / subsector_code
            
            # New folder (slugified name)
            new_folder_name = slug(subsector_name)
            new_folder = sector_path / new_folder_name
            
            # Skip if already migrated
            if new_folder.exists():
                if old_folder.exists() and old_folder != new_folder:
                    # Both exist - check if old is empty or has same content
                    try:
                        if not any(old_folder.iterdir()):
                            # Old folder is empty, safe to remove
                            old_folder.rmdir()
                            print(f"  Removed empty old folder: {sector_code}/{subsector_code}")
                        else:
                            print(f"  ⚠ Both folders exist: {sector_code}/{subsector_code} and {sector_code}/{new_folder_name}")
                    except Exception as e:
                        print(f"  ⚠ Error checking {sector_code}/{subsector_code}: {e}")
                continue
            
            # Migrate if old folder exists
            if old_folder.exists() and old_folder.is_dir():
                try:
                    # Rename/move the folder
                    old_folder.rename(new_folder)
                    migrated += 1
                    print(f"  ✓ Migrated: {sector_code}/{subsector_code} → {sector_code}/{new_folder_name}")
                except Exception as e:
                    errors.append(f"{sector_code}/{subsector_code}: {e}")
                    print(f"  ✗ Error migrating {sector_code}/{subsector_code}: {e}")
            else:
                # Create new folder if it doesn't exist
                try:
                    new_folder.mkdir(parents=True, exist_ok=True)
                    created += 1
                    print(f"  ✓ Created: {sector_code}/{new_folder_name}")
                except Exception as e:
                    errors.append(f"{sector_code}/{new_folder_name}: {e}")
                    print(f"  ✗ Error creating {sector_code}/{new_folder_name}: {e}")
    
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  Migrated: {migrated} folders")
    print(f"  Created: {created} folders")
    if errors:
        print(f"  Errors: {len(errors)}")
        for error in errors[:10]:
            print(f"    {error}")

if __name__ == '__main__':
    main()
