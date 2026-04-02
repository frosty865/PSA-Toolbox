#!/usr/bin/env python3
"""
CORPUS: Report OFC Coverage

Generates coverage reports for question universes with OFC links.
Shows which questions have linked OFC evidence.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
import psycopg2


def report_ofc_coverage(source_set, universe_path, out_path):
    """
    Generate coverage report for a question universe.
    
    Args:
        source_set: Source set to process
        universe_path: Path to question universe JSON
        out_path: Output path for coverage report
    """
    # Load questions
    if not os.path.exists(universe_path):
        raise FileNotFoundError(f"Question universe file not found: {universe_path}")
    
    with open(universe_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
    
    qmap = {q["question_code"]: q["question_text"] for q in questions}
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get links for this source_set and HYBRID_V3 method
        cur.execute("""
            SELECT question_code, ofc_candidate_id, document_id, locator_type, locator,
                   similarity_score, link_method, link_explanation
            FROM ofc_question_links
            WHERE source_set=%s AND link_method='HYBRID_V3'
            ORDER BY similarity_score DESC
        """, (source_set,))
        rows = cur.fetchall()
        
        # Group by question
        by_q = defaultdict(list)
        for qc, ocid, docid, lt, loc, score, lm, exp in rows:
            if qc not in qmap:
                continue
            by_q[qc].append({
                "ofc_candidate_id": str(ocid),
                "document_id": str(docid),
                "locator_type": lt,
                "locator": loc,
                "score": float(score),
                "link_method": lm,
                "link_explanation": exp if isinstance(exp, dict) else json.loads(exp) if exp else {}
            })
        
        covered = len(by_q)
        total = len(qmap)
        
        # Build report
        report = {
            "source_set": source_set,
            "universe_file": universe_path,
            "questions_total": total,
            "questions_covered": covered,
            "coverage_pct": round((covered / total) * 100, 2) if total else 0.0,
            "links_total": sum(len(v) for v in by_q.values()),
            "items": [
                {
                    "question_code": qc,
                    "question_text": qmap[qc],
                    "links": by_q.get(qc, [])
                }
                for qc in qmap.keys()
            ]
        }
        
        # Write report
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Wrote {out_path}")
        print(f"   Coverage: {covered}/{total} ({report['coverage_pct']}%)")
        print(f"   Total links: {report['links_total']}")
        
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
    
    parser = argparse.ArgumentParser(description='Generate OFC coverage reports')
    parser.add_argument('source_set', nargs='?', default='CISA_MASS_GATHERING',
                       help='Source set to process (default: CISA_MASS_GATHERING)')
    
    args = parser.parse_args()
    
    # Generate reports for both universes
    report_ofc_coverage(
        args.source_set,
        "analytics/runtime/baseline_primary_36.json",
        "analytics/reports/ofc_coverage_primary36_CISA_MASS_GATHERING.json"
    )
    
    report_ofc_coverage(
        args.source_set,
        "analytics/runtime/baseline_full_312.json",
        "analytics/reports/ofc_coverage_full312_CISA_MASS_GATHERING.json"
    )


if __name__ == '__main__':
    main()
