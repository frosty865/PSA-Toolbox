import json
import re
from pathlib import Path

BASE_PATH = Path(r"D:\PSA_System\data\download")

# Update this path to your actual sector/subsector taxonomy file.
# Expected formats supported:
#  A) {"sectors":[{"code":"ENERGY","subsectors":[{"code":"ELECTRIC"}, ...]}, ...]}
#  B) {"sectors":[{"code":"ENERGY","subsectors":["ELECTRIC","OIL_GAS"]}, ...]}
#  C) [{"code":"ENERGY","subsectors":[...]}]  (top-level list)
TAXONOMY_FILE = Path(r"D:\PSA_System\psa_rebuild\taxonomy\sectors_subsectors.json")

def slug(s: str) -> str:
    """Normalize string to folder-safe slug."""
    s = (s or "").strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Za-z0-9_\-]", "", s)
    return s

def normalize_sectors(data):
    """Accept top-level list or dict with 'sectors' key."""
    # Accept top-level list
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "sectors" in data:
        return data["sectors"]
    raise ValueError("Unsupported taxonomy format: expected list or dict with 'sectors'.")

def normalize_subsectors(subsectors):
    """Accept list of strings or list of objects with code and name."""
    out = []
    if subsectors is None:
        return out
    if not isinstance(subsectors, list):
        raise ValueError("Unsupported subsectors format: expected list.")
    for ss in subsectors:
        if isinstance(ss, str):
            out.append({"code": ss})
        elif isinstance(ss, dict):
            # Preserve full dict including name field
            out.append(ss)
        else:
            raise ValueError(f"Unsupported subsector entry: {ss!r}")
    return out

def main():
    if not TAXONOMY_FILE.exists():
        raise FileNotFoundError(f"Taxonomy file not found: {TAXONOMY_FILE}")

    BASE_PATH.mkdir(parents=True, exist_ok=True)

    data = json.loads(TAXONOMY_FILE.read_text(encoding="utf-8"))
    sectors = normalize_sectors(data)

    created = 0
    skipped = 0

    for sector in sectors:
        if not isinstance(sector, dict):
            raise ValueError(f"Unsupported sector entry: {sector!r}")

        sector_code = slug(sector.get("code") or sector.get("sector_code") or sector.get("name"))
        if not sector_code:
            skipped += 1
            continue

        subsectors = normalize_subsectors(sector.get("subsectors") or sector.get("children") or [])
        if not subsectors:
            # still create sector folder even if no subsectors exist
            (BASE_PATH / sector_code).mkdir(parents=True, exist_ok=True)
            created += 1
            continue

        # Special case: Consolidate State, Local, Tribal, and Territories into SLTT
        SLTT_NAMES = {"State Facilities", "Local Facilities", "Tribal Facilities", "Territories", "Territory Facilities"}
        sltt_found = False
        
        for ss in subsectors:
            # Prefer name over code for subsectors (to get readable folder names)
            # Fall back to code if name is not available
            subsector_name = ss.get("name") or ss.get("subsector_name")
            subsector_code = ss.get("code") or ss.get("subsector_code")
            
            # Special handling for SLTT consolidation in government_facilities sector
            if sector_code == "government_facilities" and subsector_name in SLTT_NAMES:
                if not sltt_found:
                    (BASE_PATH / sector_code / "SLTT").mkdir(parents=True, exist_ok=True)
                    created += 1
                    sltt_found = True
                continue  # Skip creating individual folders for these
            
            # Use slugified name if available, otherwise slugify the code
            if subsector_name:
                subsector_folder = slug(subsector_name)
            elif subsector_code:
                subsector_folder = slug(str(subsector_code))
            else:
                skipped += 1
                continue
            
            if not subsector_folder:
                skipped += 1
                continue

            (BASE_PATH / sector_code / subsector_folder).mkdir(parents=True, exist_ok=True)
            created += 1

    print(f"✓ Created/ensured {created} folder(s) under {BASE_PATH}")
    if skipped:
        print(f"⚠ Skipped {skipped} entries due to missing/invalid codes")

if __name__ == "__main__":
    main()
