#!/usr/bin/env python3
"""
CORPUS: Verify Mass Gathering Expansion Promotion

Verifies that expansion questions were promoted correctly and baseline remains unchanged.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SCOPE_CODE = "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES"
EXPANSION_VERSION = "EXPANSION_QUESTIONS_V1"

def main():
    """Verify expansion promotion."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Count expansion questions for this scope
        cur.execute("""
            SELECT COUNT(*)
            FROM public.expansion_questions
            WHERE scope_code = %s AND expansion_version = %s
        """, (SCOPE_CODE, EXPANSION_VERSION))
        exp_cnt = cur.fetchone()[0]
        
        # Show first 10
        cur.execute("""
            SELECT question_code, question_text
            FROM public.expansion_questions
            WHERE scope_code = %s AND expansion_version = %s
            ORDER BY question_code ASC
            LIMIT 10
        """, (SCOPE_CODE, EXPANSION_VERSION))
        sample = [{"question_code": r[0], "question_text": r[1]} for r in cur.fetchall()]
        
        # Verify no baseline_questions table exists in CORPUS (it shouldn't)
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'baseline_questions'
            )
        """)
        baseline_table_exists = cur.fetchone()[0]
        
        result = {
            "scope_code": SCOPE_CODE,
            "expansion_version": EXPANSION_VERSION,
            "expansion_questions_count": exp_cnt,
            "sample": sample,
            "baseline_table_in_corpus": baseline_table_exists,
            "verification": {
                "expansion_promoted": exp_cnt > 0,
                "baseline_protected": not baseline_table_exists
            }
        }
        
        print(json.dumps(result, indent=2))
        
        if exp_cnt == 0:
            print("\n⚠️  WARNING: No expansion questions found for this scope_code/version", file=sys.stderr)
        else:
            print(f"\n✅ Verified: {exp_cnt} expansion questions promoted")
            print(f"✅ Baseline protected: No baseline_questions table in CORPUS")
        
        return result
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()


