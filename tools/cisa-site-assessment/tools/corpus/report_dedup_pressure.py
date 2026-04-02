#!/usr/bin/env python3
"""
CORPUS: Report Dedup Pressure

Analyzes whether questions are getting multiple candidate links from the same
document/locator (indicating potential duplicate candidates or over-matching).
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SOURCE_SET = "CISA_MASS_GATHERING"
OUT_PATH = "analytics/reports/dedup_pressure_cisa_mass_gathering.json"

def main():
    """Report dedup pressure."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # For each question_code, count distinct locators and total candidate links
        cur.execute("""
            SELECT
                cql.universe,
                cql.question_code,
                COUNT(*) AS link_count,
                COUNT(DISTINCT (ocq.document_id::text || '|' || COALESCE(ocq.locator_type, '') || '|' || COALESCE(ocq.locator, ''))) AS distinct_locators,
                MAX(cql.score) AS max_score,
                AVG(cql.score) AS avg_score
            FROM public.corpus_candidate_question_links cql
            JOIN public.ofc_candidate_queue ocq ON ocq.candidate_id = cql.candidate_id
            WHERE cql.source_set = %s
            GROUP BY cql.universe, cql.question_code
            ORDER BY link_count DESC
            LIMIT 200
        """, (SOURCE_SET,))
        
        rows = cur.fetchall()
        
        out = []
        for r in rows:
            link_count = int(r[2])
            distinct_loc = int(r[3])
            spam_ratio = round(link_count / max(1, distinct_loc), 3)  # >1.0 means multiple per same locator(s)
            
            out.append({
                "question_universe": r[0],
                "question_code": r[1],
                "link_count": link_count,
                "distinct_locators": distinct_loc,
                "spam_ratio_links_per_locator": spam_ratio,
                "avg_score": float(r[5]) if r[5] else 0.0,
                "max_score": float(r[4]) if r[4] else 0.0
            })
        
        output_path = Path(OUT_PATH)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({
                "source_set": SOURCE_SET,
                "rows": out
            }, f, indent=2, ensure_ascii=False)
        
        # Calculate summary stats
        high_pressure = [r for r in out if r["spam_ratio_links_per_locator"] > 1.5]
        
        print(json.dumps({
            "out": str(output_path),
            "rows": len(out),
            "high_pressure_count": len(high_pressure),
            "summary": {
                "avg_spam_ratio": round(sum(r["spam_ratio_links_per_locator"] for r in out) / len(out), 3) if out else 0,
                "max_spam_ratio": max((r["spam_ratio_links_per_locator"] for r in out), default=0),
                "questions_with_high_pressure": len(high_pressure)
            }
        }, indent=2))
        
        return out
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()


