#!/usr/bin/env python3
"""
CORPUS: Generate Mass Gathering Coverage Summary

Generates a coverage report separating BASE vs EXPANSION question coverage.
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
from tools.corpus.overlay_control import get_overlay_control

def main():
    """Generate coverage summary."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        source_set = "CISA_MASS_GATHERING"
        scope_code = "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES"
        
        # Get overlay snapshot
        overlay_snapshot = get_overlay_control(conn)
        
        # BASE coverage
        cur.execute("""
            SELECT 
                cql.question_code,
                COUNT(DISTINCT cql.candidate_id) as candidate_count,
                AVG(cql.score) as avg_score,
                MAX(cql.score) as max_score
            FROM public.corpus_candidate_question_links cql
            WHERE cql.source_set = %s AND cql.universe = 'BASE'
            GROUP BY cql.question_code
            ORDER BY candidate_count DESC, avg_score DESC
        """, (source_set,))
        
        base_coverage = []
        for row in cur.fetchall():
            base_coverage.append({
                "question_code": row[0],
                "candidate_count": row[1],
                "avg_score": float(row[2]) if row[2] else 0.0,
                "max_score": float(row[3]) if row[3] else 0.0
            })
        
        # EXPANSION coverage
        cur.execute("""
            SELECT 
                cql.question_code,
                COUNT(DISTINCT cql.candidate_id) as candidate_count,
                AVG(cql.score) as avg_score,
                MAX(cql.score) as max_score
            FROM public.corpus_candidate_question_links cql
            WHERE cql.source_set = %s AND cql.universe = 'EXPANSION'
            GROUP BY cql.question_code
            ORDER BY candidate_count DESC, avg_score DESC
        """, (source_set,))
        
        expansion_coverage = []
        for row in cur.fetchall():
            expansion_coverage.append({
                "question_code": row[0],
                "candidate_count": row[1],
                "avg_score": float(row[2]) if row[2] else 0.0,
                "max_score": float(row[3]) if row[3] else 0.0
            })
        
        # Total counts
        cur.execute("""
            SELECT 
                COUNT(DISTINCT CASE WHEN universe = 'BASE' THEN question_code END) as base_questions_with_links,
                COUNT(DISTINCT CASE WHEN universe = 'EXPANSION' THEN question_code END) as expansion_questions_with_links,
                COUNT(DISTINCT candidate_id) as total_candidates_matched
            FROM public.corpus_candidate_question_links
            WHERE source_set = %s
        """, (source_set,))
        
        stats = cur.fetchone()
        
        # Total questions
        cur.execute("SELECT COUNT(*) FROM public.expansion_questions WHERE scope_code = %s", (scope_code,))
        total_expansion_questions = cur.fetchone()[0]
        
        report = {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "source_set": source_set,
            "scope_code": scope_code,
            "overlay_snapshot": overlay_snapshot,
            "summary": {
                "base_questions_with_links": stats[0] or 0,
                "base_questions_total": 36,
                "expansion_questions_with_links": stats[1] or 0,
                "expansion_questions_total": total_expansion_questions,
                "total_candidates_matched": stats[2] or 0
            },
            "base_coverage": {
                "top_10": base_coverage[:10],
                "total_questions_covered": len(base_coverage)
            },
            "expansion_coverage": {
                "top_10": expansion_coverage[:10],
                "total_questions_covered": len(expansion_coverage)
            }
        }
        
        output_path = Path("analytics/reports/mass_gathering_coverage_summary.json")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(json.dumps(report, indent=2))
        print(f"\n✅ Coverage report saved: {output_path}")
        
        return report
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()


