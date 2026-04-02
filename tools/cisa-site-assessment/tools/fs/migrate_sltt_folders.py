#!/usr/bin/env python3
"""
Migrate State, Local, Tribal, and Territories folders into a single SLTT folder.
Consolidates these subsectors under government_facilities into one folder.
"""
import json
import shutil
from pathlib import Path

BASE_PATH = Path(r"D:\PSA_System\data\download")
TAXONOMY_FILE = Path(r"D:\PSA_System\psa_rebuild\taxonomy\sectors_subsectors.json")

def main():
    """Migrate SLTT folders into a single consolidated folder."""
    if not TAXONOMY_FILE.exists():
        print(f"❌ Taxonomy file not found: {TAXONOMY_FILE}")
        return
    
    with open(TAXONOMY_FILE, 'r', encoding='utf-8') as f:
        taxonomy = json.load(f)
    
    sectors = taxonomy.get('sectors', [])
    
    if not BASE_PATH.exists():
        print(f"❌ Download folder not found: {BASE_PATH}")
        return
    
    # Find government_facilities sector
    gov_sector = None
    for sector in sectors:
        if sector.get('code') == 'government_facilities':
            gov_sector = sector
            break
    
    if not gov_sector:
        print("❌ government_facilities sector not found in taxonomy")
        return
    
    sector_path = BASE_PATH / "government_facilities"
    if not sector_path.exists():
        print(f"❌ Sector folder not found: {sector_path}")
        return
    
    SLTT_NAMES = {"State Facilities", "Local Facilities", "Tribal Facilities", "Territories", "Territory Facilities"}
    SLTT_FOLDER_NAMES = {"State_Facilities", "Local_Facilities", "Tribal_Facilities", "Territories", "Territory_Facilities"}
    
    # Find SLTT subsectors
    sltt_subsectors = [ss for ss in gov_sector.get('subsectors', []) 
                      if ss.get('name') in SLTT_NAMES]
    
    if not sltt_subsectors:
        print("⚠ No SLTT subsectors found in taxonomy")
        return
    
    # Create SLTT folder
    sltt_path = sector_path / "SLTT"
    sltt_path.mkdir(parents=True, exist_ok=True)
    
    migrated = 0
    moved_files = 0
    
    # Migrate each SLTT subsector folder
    for subsector in sltt_subsectors:
        subsector_name = subsector.get('name', '')
        subsector_code = str(subsector.get('code', ''))
        
        # Try to find the folder (could be numeric code or slugified name)
        possible_folders = [
            sector_path / subsector_code,  # Numeric code
            sector_path / subsector_name.replace(' ', '_'),  # Simple replacement
            sector_path / subsector_name.replace(' ', '_').replace('/', '_'),  # With slash handling
        ]
        
        # Also try slugified version
        import re
        slug_name = subsector_name.strip()
        slug_name = re.sub(r"\s+", "_", slug_name)
        slug_name = re.sub(r"[^A-Za-z0-9_\-]", "", slug_name)
        possible_folders.append(sector_path / slug_name)
        
        source_folder = None
        for folder in possible_folders:
            if folder.exists() and folder.is_dir() and folder != sltt_path:
                source_folder = folder
                break
        
        if source_folder:
            # Move contents from source folder to SLTT
            try:
                items = list(source_folder.iterdir())
                if items:
                    for item in items:
                        dest = sltt_path / item.name
                        if item.is_dir():
                            if dest.exists():
                                # Merge directories
                                for subitem in item.rglob('*'):
                                    rel_path = subitem.relative_to(item)
                                    dest_item = dest / rel_path
                                    dest_item.parent.mkdir(parents=True, exist_ok=True)
                                    if subitem.is_file():
                                        if not dest_item.exists():
                                            shutil.copy2(subitem, dest_item)
                                            moved_files += 1
                            else:
                                shutil.move(str(item), str(dest))
                                moved_files += 1
                        else:
                            if not dest.exists():
                                shutil.move(str(item), str(dest))
                                moved_files += 1
                
                # Remove empty source folder
                try:
                    source_folder.rmdir()
                    migrated += 1
                    print(f"  ✓ Migrated: government_facilities/{source_folder.name} → government_facilities/SLTT")
                except OSError:
                    # Folder not empty or other error
                    print(f"  ⚠ Could not remove: government_facilities/{source_folder.name} (may not be empty)")
            except Exception as e:
                print(f"  ✗ Error migrating {source_folder.name}: {e}")
        else:
            print(f"  ⚠ Folder not found for: {subsector_name}")
    
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  Migrated: {migrated} folders")
    print(f"  Files moved: {moved_files}")
    print(f"  SLTT folder: {sltt_path}")

if __name__ == '__main__':
    main()
