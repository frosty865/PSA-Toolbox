#!/usr/bin/env python3
"""
Map the download folder structure (D:\PSA_System\data\download).
Shows sectors and their subsectors in a tree format.
"""
import json
from pathlib import Path

BASE_PATH = Path(r"D:\PSA_System\data\download")
TAXONOMY_FILE = Path(r"D:\PSA_System\psa_rebuild\taxonomy\sectors_subsectors.json")

def main():
    """Generate a map of the download folder structure."""
    
    # Load taxonomy
    if not TAXONOMY_FILE.exists():
        print(f"❌ Taxonomy file not found: {TAXONOMY_FILE}")
        print("   Run: python tools/fs/export_sectors_subsectors_to_json.py first")
        return
    
    with open(TAXONOMY_FILE, 'r', encoding='utf-8') as f:
        taxonomy = json.load(f)
    
    sectors = taxonomy.get('sectors', [])
    
    # Check actual folder structure
    if not BASE_PATH.exists():
        print(f"❌ Download folder not found: {BASE_PATH}")
        return
    
    print(f"📁 Download Folder Map: {BASE_PATH}\n")
    print("=" * 80)
    
    total_sectors = 0
    total_subsectors = 0
    missing_folders = []
    
    for sector in sectors:
        sector_code = sector.get('code', '')
        sector_name = sector.get('name', '')
        subsectors = sector.get('subsectors', [])
        
        sector_path = BASE_PATH / sector_code
        sector_exists = sector_path.exists() and sector_path.is_dir()
        
        status = "✓" if sector_exists else "✗"
        print(f"\n{status} {sector_code} ({sector_name})")
        
        if not sector_exists:
            missing_folders.append(f"  {sector_code}/")
        else:
            total_sectors += 1
        
        # Special case: Track SLTT subsectors for government_facilities
        SLTT_NAMES = {"State Facilities", "Local Facilities", "Tribal Facilities", "Territories", "Territory Facilities"}
        sltt_subsectors = []
        other_subsectors = []
        
        for subsector in subsectors:
            subsector_name = subsector.get('name', '')
            if sector_code == "government_facilities" and subsector_name in SLTT_NAMES:
                sltt_subsectors.append(subsector)
            else:
                other_subsectors.append(subsector)
        
        # Show SLTT as a single consolidated folder
        if sltt_subsectors:
            sltt_path = sector_path / "SLTT"
            sltt_exists = sltt_path.exists() and sltt_path.is_dir()
            status = "  ✓" if sltt_exists else "  ✗"
            sltt_names = ", ".join(ss.get('name', '') for ss in sltt_subsectors)
            print(f"{status}   └─ SLTT ({sltt_names})")
            if not sltt_exists:
                missing_folders.append(f"  {sector_code}/SLTT/")
            else:
                total_subsectors += len(sltt_subsectors)
        
        # Show other subsectors normally
        for subsector in other_subsectors:
            subsector_code = subsector.get('code', '')
            subsector_name = subsector.get('name', '')
            
            # Use slugified name for folder (matching create_sector_subsector_folders.py logic)
            def slug(s: str) -> str:
                import re
                s = (s or "").strip()
                s = re.sub(r"\s+", "_", s)
                s = re.sub(r"[^A-Za-z0-9_\-]", "", s)
                return s
            
            if subsector_name:
                subsector_folder = slug(subsector_name)
            elif subsector_code:
                subsector_folder = slug(str(subsector_code))
            else:
                subsector_folder = ""
            
            subsector_path = sector_path / subsector_folder if subsector_folder else None
            subsector_exists = subsector_path and subsector_path.exists() and subsector_path.is_dir()
            
            status = "  ✓" if subsector_exists else "  ✗"
            folder_display = subsector_folder if subsector_folder else subsector_code
            print(f"{status}   └─ {folder_display} ({subsector_name})")
            
            if not subsector_exists:
                missing_folders.append(f"  {sector_code}/{subsector_folder or subsector_code}/")
            else:
                total_subsectors += 1
    
    print("\n" + "=" * 80)
    print(f"Summary:")
    print(f"  Sectors: {total_sectors}/{len(sectors)} folders exist")
    print(f"  Subsectors: {total_subsectors}/{sum(len(s.get('subsectors', [])) for s in sectors)} folders exist")
    
    if missing_folders:
        print(f"\n⚠ Missing folders ({len(missing_folders)}):")
        for folder in missing_folders[:20]:  # Show first 20
            print(f"  {folder}")
        if len(missing_folders) > 20:
            print(f"  ... and {len(missing_folders) - 20} more")
    
    # Also check for extra folders not in taxonomy
    if BASE_PATH.exists():
        extra_folders = []
        for item in BASE_PATH.iterdir():
            if item.is_dir():
                sector_code = item.name
                # Check if this sector exists in taxonomy
                found = any(s.get('code') == sector_code for s in sectors)
                if not found:
                    extra_folders.append(sector_code)
        
        if extra_folders:
            print(f"\n⚠ Extra folders not in taxonomy ({len(extra_folders)}):")
            for folder in extra_folders[:10]:
                print(f"  {folder}/")
            if len(extra_folders) > 10:
                print(f"  ... and {len(extra_folders) - 10} more")

if __name__ == '__main__':
    main()
