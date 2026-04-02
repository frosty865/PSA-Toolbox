#!/usr/bin/env python3
"""
CORPUS: Cleanup Duplicate Links

Removes duplicate links before adding uniqueness constraint.
Keeps the link with the highest similarity_score.

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
import psycopg2


def cleanup_duplicate_links(source_set: str = "CISA_MASS_GATHERING", link_method: str = "HYBRID_V3"):
    """Remove duplicate links, keeping the one with highest score."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Find duplicates
        cur.execute("""
            SELECT source_set, link_method, question_code, ofc_candidate_id, COUNT(*) as dup_count
            FROM ofc_question_links
            WHERE source_set=%s AND link_method=%s
            GROUP BY source_set, link_method, question_code, ofc_candidate_id
            HAVING COUNT(*) > 1
        """, (source_set, link_method))
        duplicates = cur.fetchall()
        
        if not duplicates:
            print(f"✅ No duplicates found for {source_set} / {link_method}")
            return
        
        print(f"Found {len(duplicates)} duplicate groups")
        
        # For each duplicate group, keep the one with highest score, delete others
        deleted_count = 0
        for ss, lm, qc, ocid, dup_count in duplicates:
            # Get all links for this duplicate group
            cur.execute("""
                SELECT link_id, similarity_score
                FROM ofc_question_links
                WHERE source_set=%s AND link_method=%s AND question_code=%s AND ofc_candidate_id=%s
                ORDER BY similarity_score DESC
            """, (ss, lm, qc, ocid))
            links = cur.fetchall()
            
            # Keep the first one (highest score), delete the rest
            if len(links) > 1:
                keep_link_id = links[0][0]
                delete_link_ids = [l[0] for l in links[1:]]
                
                cur.execute("""
                    DELETE FROM ofc_question_links
                    WHERE link_id = ANY(%s::uuid[])
                """, (delete_link_ids,))
                
                deleted_count += len(delete_link_ids)
        
        conn.commit()
        
        print(f"✅ Deleted {deleted_count} duplicate links")
        print(f"   Kept {len(duplicates)} links (one per duplicate group)")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Cleanup duplicate OFC question links')
    parser.add_argument('--source_set', default='CISA_MASS_GATHERING',
                       help='Source set to clean (default: CISA_MASS_GATHERING)')
    parser.add_argument('--link_method', default='HYBRID_V3',
                       help='Link method to clean (default: HYBRID_V3)')
    
    args = parser.parse_args()
    
    try:
        cleanup_duplicate_links(args.source_set, args.link_method)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
