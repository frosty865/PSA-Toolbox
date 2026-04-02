#!/usr/bin/env python3
"""
CORPUS Status Command

Prints status of CORPUS database including:
- Active source set
- Document count by source_set
- Chunk count by source_set
- Candidate count by source_set
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    get_active_source_set
)
from tools.corpus.overlay_control import (
    get_overlay_control
)

def main():
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_set = get_active_source_set(conn)
        print(f"Active Source Set: {active_set}")
        print()
        
        # Document counts by source_set
        cur.execute("""
            SELECT source_set, COUNT(*) as count
            FROM public.documents
            GROUP BY source_set
            ORDER BY source_set
        """)
        
        print("Documents by source_set:")
        total_docs = 0
        for row in cur.fetchall():
            source_set, count = row
            marker = " ← ACTIVE" if source_set == active_set else ""
            print(f"  {source_set}: {count}{marker}")
            total_docs += count
        print(f"  Total: {total_docs}")
        print()
        
        # Chunk counts by source_set
        cur.execute("""
            SELECT source_set, COUNT(*) as count
            FROM public.document_chunks
            GROUP BY source_set
            ORDER BY source_set
        """)
        
        print("Chunks by source_set:")
        total_chunks = 0
        for row in cur.fetchall():
            source_set, count = row
            marker = " ← ACTIVE" if source_set == active_set else ""
            print(f"  {source_set}: {count}{marker}")
            total_chunks += count
        print(f"  Total: {total_chunks}")
        print()
        
        # Candidate counts by source_set
        cur.execute("""
            SELECT source_set, COUNT(*) as count
            FROM public.ofc_candidate_queue
            GROUP BY source_set
            ORDER BY source_set
        """)
        
        print("Candidates by source_set:")
        total_candidates = 0
        for row in cur.fetchall():
            source_set, count = row
            marker = " ← ACTIVE" if source_set == active_set else ""
            print(f"  {source_set}: {count}{marker}")
            total_candidates += count
        print(f"  Total: {total_candidates}")
        print()
        
        # Candidate counts by locator_type (for active source set)
        try:
            cur.execute("""
                SELECT locator_type, COUNT(*) as count
                FROM public.ofc_candidate_queue 
                WHERE source_set = %s
                GROUP BY locator_type
                ORDER BY locator_type
            """, (active_set,))
            
            locator_rows = cur.fetchall()
            if locator_rows:
                print(f"Candidates by locator_type (source_set={active_set}):")
                for row in locator_rows:
                    locator_type, count = row
                    locator_type_str = locator_type or 'NULL'
                    print(f"  {locator_type_str}: {count}")
                print()
        except Exception as e:
            # If locator_type column doesn't exist yet, skip silently
            pass
        
        # Check for UNSPECIFIED (should be minimal)
        cur.execute("""
            SELECT COUNT(*) FROM public.documents WHERE source_set = 'UNSPECIFIED'
        """)
        unspecified_docs = cur.fetchone()[0]
        
        if unspecified_docs > 0:
            print(f"⚠️  Warning: {unspecified_docs} documents have source_set='UNSPECIFIED'")
            print("   These will be excluded from processing unless explicitly assigned.")
        
        print()
        
        # Overlay control
        try:
            overlay_control = get_overlay_control(conn)
            print("Active Overlays:")
            print(f"  Sectors:      {overlay_control['active_sector_codes']}")
            print(f"  Subsectors:   {overlay_control['active_subsector_codes']}")
            print(f"  Technologies: {overlay_control['active_technology_codes']}")
            print()
            
            # Expansion question counts
            cur.execute("""
                SELECT 
                    scope_type,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = true) as active
                FROM public.expansion_questions
                GROUP BY scope_type
                ORDER BY scope_type
            """)
            
            expansion_by_type = {row[0]: {'total': row[1], 'active': row[2]} for row in cur.fetchall()}
            
            if expansion_by_type:
                print("Expansion Questions:")
                for scope_type in sorted(expansion_by_type.keys()):
                    counts = expansion_by_type[scope_type]
                    print(f"  {scope_type}: {counts['active']} active / {counts['total']} total")
                
                # Count for currently selected overlays
                active_sectors = overlay_control['active_sector_codes']
                active_subsectors = overlay_control['active_subsector_codes']
                active_technologies = overlay_control['active_technology_codes']
                
                conditions = []
                params = []
                
                if active_sectors:
                    conditions.append("(scope_type = 'SECTOR' AND scope_code = ANY(%s))")
                    params.append(active_sectors)
                if active_subsectors:
                    conditions.append("(scope_type = 'SUBSECTOR' AND scope_code = ANY(%s))")
                    params.append(active_subsectors)
                if active_technologies:
                    conditions.append("(scope_type = 'TECHNOLOGY' AND scope_code = ANY(%s))")
                    params.append(active_technologies)
                
                if conditions:
                    where_clause = " OR ".join(conditions)
                    cur.execute(f"""
                        SELECT COUNT(*) FROM public.expansion_questions
                        WHERE is_active = true AND ({where_clause})
                    """, params)
                    selected_count = cur.fetchone()[0]
                    print(f"  Selected overlays: {selected_count} questions would be included")
                else:
                    print(f"  Selected overlays: 0 (no overlays selected)")
            else:
                print("Expansion Questions: None imported")
            
        except Exception as e:
            # If overlay_control or expansion_questions tables don't exist, skip
            pass
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()

