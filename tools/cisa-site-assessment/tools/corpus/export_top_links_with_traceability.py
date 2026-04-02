#!/usr/bin/env python3
"""
CORPUS: Export Top Links with Traceability

Exports top-scoring candidate-question links with full traceability
(document, locator, excerpt).
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SOURCE_SET = "CISA_MASS_GATHERING"
SCOPE_CODE = "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES"
OUT_PATH = "analytics/reports/top_links_with_traceability_cisa_mass_gathering.json"
EXCERPT_LEN = 280

def main():
    """Export top links with traceability."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Pull top 200 links by score (across both universes)
        cur.execute("""
            SELECT
                cql.universe,
                cql.question_code,
                cql.score,
                cql.candidate_id,
                ocq.document_id,
                ocq.locator_type,
                ocq.locator,
                d.title AS document_title,
                LEFT(ocq.snippet_text, %s) AS excerpt
            FROM public.corpus_candidate_question_links cql
            JOIN public.ofc_candidate_queue ocq ON ocq.candidate_id = cql.candidate_id
            JOIN public.documents d ON d.document_id = ocq.document_id
            WHERE cql.source_set = %s
            ORDER BY cql.score DESC
            LIMIT 200
        """, (EXCERPT_LEN, SOURCE_SET))
        
        rows = cur.fetchall()
        
        out = []
        for r in rows:
            out.append({
                "question_universe": r[0],
                "question_code": r[1],
                "score": float(r[2]),
                "candidate_id": str(r[3]),
                "document_id": str(r[4]),
                "locator_type": r[5] or "NULL",
                "locator": r[6] or "NULL",
                "document_title": r[7] or "NULL",
                "excerpt": (r[8] or "")[:EXCERPT_LEN]
            })
        
        output_path = Path(OUT_PATH)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({
                "source_set": SOURCE_SET,
                "scope_code": SCOPE_CODE,
                "top_links": out
            }, f, indent=2, ensure_ascii=False)
        
        print(json.dumps({
            "out": str(output_path),
            "count": len(out)
        }, indent=2))
        
        return out
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()


