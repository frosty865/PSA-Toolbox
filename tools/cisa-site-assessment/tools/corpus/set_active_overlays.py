#!/usr/bin/env python3
"""
CORPUS: Set Active Overlays

Sets active expansion overlays (sector/subsector/technology) for matching.

Usage:
    python tools/corpus/set_active_overlays.py --sector CODE1 --sector CODE2 --subsector CODE3
    python tools/corpus/set_active_overlays.py --technology TECH_CODE
    python tools/corpus/set_active_overlays.py --clear
"""

import sys
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.overlay_control import (
    get_corpus_db_connection,
    set_overlay_control,
    clear_overlay_control,
    get_overlay_control
)

def main():
    parser = argparse.ArgumentParser(
        description='Set active expansion overlays for CORPUS matching',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tools/corpus/set_active_overlays.py --sector SECTOR_COMMERCIAL_FACILITIES --subsector SUBSECTOR_SPORTS_VENUES
  python tools/corpus/set_active_overlays.py --technology TECH_CLEAR_BAG_POLICY
  python tools/corpus/set_active_overlays.py --clear
        """
    )
    
    parser.add_argument('--sector', action='append', dest='sector_codes',
                        help='Add a sector code (repeatable)')
    parser.add_argument('--subsector', action='append', dest='subsector_codes',
                        help='Add a subsector code (repeatable)')
    parser.add_argument('--technology', action='append', dest='technology_codes',
                        help='Add a technology code (repeatable)')
    parser.add_argument('--clear', action='store_true',
                        help='Clear all overlay selections')
    
    args = parser.parse_args()
    
    try:
        conn = get_corpus_db_connection()
        
        if args.clear:
            clear_overlay_control(conn)
            print("✅ All overlay selections cleared")
        else:
            # Get current state
            current = get_overlay_control(conn)
            
            # Determine new values
            sector_codes = args.sector_codes if args.sector_codes else None
            subsector_codes = args.subsector_codes if args.subsector_codes else None
            technology_codes = args.technology_codes if args.technology_codes else None
            
            # If no flags provided, just show current state
            if not any([sector_codes, subsector_codes, technology_codes]):
                print("Current overlay selections:")
                print(f"  Sectors:      {current['active_sector_codes']}")
                print(f"  Subsectors:   {current['active_subsector_codes']}")
                print(f"  Technologies: {current['active_technology_codes']}")
                return
            
            # Update overlay control
            set_overlay_control(
                conn,
                sector_codes=sector_codes,
                subsector_codes=subsector_codes,
                technology_codes=technology_codes
            )
            
            # Show updated state
            updated = get_overlay_control(conn)
            print("✅ Overlay selections updated:")
            print(f"  Sectors:      {updated['active_sector_codes']}")
            print(f"  Subsectors:   {updated['active_subsector_codes']}")
            print(f"  Technologies: {updated['active_technology_codes']}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

