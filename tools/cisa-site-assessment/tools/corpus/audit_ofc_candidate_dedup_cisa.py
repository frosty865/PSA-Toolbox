#!/usr/bin/env python3
"""
CORPUS: Audit OFC Candidate Deduplication for CISA_MASS_GATHERING

Audits what's collapsing in OFC candidate deduplication.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SOURCE_SET = "CISA_MASS_GATHERING"

def main():
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Total rows
        cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue WHERE source_set=%s", (SOURCE_SET,))
        total = cur.fetchone()[0]
        
        # Distinct (document_id, locator_type, locator)
        cur.execute("""
            SELECT COUNT(DISTINCT document_id || '|' || COALESCE(locator_type, 'NULL') || '|' || COALESCE(locator, 'NULL'))
            FROM public.ofc_candidate_queue
            WHERE source_set=%s
        """, (SOURCE_SET,))
        distinct_locator = cur.fetchone()[0]
        
        # Distinct (document_id, locator_type, locator, candidate_hash)
        cur.execute("""
            SELECT COUNT(DISTINCT document_id || '|' || COALESCE(locator_type, 'NULL') || '|' || COALESCE(locator, 'NULL') || '|' || COALESCE(candidate_hash, 'NULL'))
            FROM public.ofc_candidate_queue
            WHERE source_set=%s
        """, (SOURCE_SET,))
        distinct_locator_hash = cur.fetchone()[0]
        
        # Sample locators with >1 row (duplicates at same locator)
        cur.execute("""
            SELECT document_id, locator_type, locator, COUNT(*) AS n
            FROM public.ofc_candidate_queue
            WHERE source_set=%s
            GROUP BY document_id, locator_type, locator
            HAVING COUNT(*) > 1
            ORDER BY n DESC
            LIMIT 10
        """, (SOURCE_SET,))
        
        dup_locators = []
        for row in cur.fetchall():
            dup_locators.append({
                "document_id": str(row[0]),
                "locator_type": row[1] or "NULL",
                "locator": row[2] or "NULL",
                "count": row[3]
            })
        
        result = {
            "source_set": SOURCE_SET,
            "ofc_total_rows": total,
            "distinct_doc_locator": distinct_locator,
            "distinct_doc_locator_hash": distinct_locator_hash,
            "top_dup_locators": dup_locators
        }
        
        print(json.dumps(result, indent=2))
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

