#!/usr/bin/env python3
"""
CORPUS: Check Link Duplicates

Sanity check to verify no duplicate links exist after uniqueness constraint.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
import psycopg2


def check_link_duplicates(source_set: str = "CISA_MASS_GATHERING", link_method: str = "HYBRID_V3"):
    """Check for duplicate links (should be 0 after uniqueness constraint)."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Count duplicate groups
        cur.execute("""
            SELECT COUNT(*) FROM (
                SELECT source_set, link_method, question_code, ofc_candidate_id, COUNT(*) c
                FROM ofc_question_links
                WHERE source_set=%s AND link_method=%s
                GROUP BY 1, 2, 3, 4
                HAVING COUNT(*) > 1
            ) t
        """, (source_set, link_method))
        dupes = cur.fetchone()[0]
        
        # Count total links
        cur.execute("""
            SELECT COUNT(*) FROM ofc_question_links
            WHERE source_set=%s AND link_method=%s
        """, (source_set, link_method))
        total = cur.fetchone()[0]
        
        # Count links per question
        cur.execute("""
            SELECT question_code, COUNT(*) as link_count
            FROM ofc_question_links
            WHERE source_set=%s AND link_method=%s
            GROUP BY question_code
            ORDER BY link_count DESC
            LIMIT 10
        """, (source_set, link_method))
        top_questions = cur.fetchall()
        
        print(f"HYBRID_V3 Link Statistics for {source_set}:")
        print(f"  Total links: {total}")
        print(f"  Duplicate groups (should be 0): {dupes}")
        
        if dupes > 0:
            print(f"  ⚠️  WARNING: {dupes} duplicate groups found!")
        else:
            print(f"  ✅ No duplicates found")
        
        if top_questions:
            print(f"\n  Top questions by link count:")
            for qcode, count in top_questions:
                print(f"    {qcode}: {count} links")
        
    except Exception as e:
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
    
    parser = argparse.ArgumentParser(description='Check for duplicate OFC question links')
    parser.add_argument('--source_set', default='CISA_MASS_GATHERING',
                       help='Source set to check (default: CISA_MASS_GATHERING)')
    parser.add_argument('--link_method', default='HYBRID_V3',
                       help='Link method to check (default: HYBRID_V3)')
    
    args = parser.parse_args()
    
    try:
        check_link_duplicates(args.source_set, args.link_method)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
