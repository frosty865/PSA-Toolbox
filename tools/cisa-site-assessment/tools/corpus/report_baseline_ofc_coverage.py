#!/usr/bin/env python3
"""
CORPUS: Report Baseline OFC Coverage

Generates coverage report showing which baseline questions have linked OFC evidence.
Used for admin review to attach evidence to questions.

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


def report_baseline_ofc_coverage(source_set: str, scope_code: str = "BASELINE"):
    """Generate coverage report for baseline questions with OFC links."""
    # Load baseline questions
    base_path = "analytics/runtime/baseline_questions.json"
    if not os.path.exists(base_path):
        raise FileNotFoundError(f"Baseline questions file not found: {base_path}. Run export_baseline_questions.py first.")
    
    with open(base_path, "r", encoding="utf-8") as f:
        BASE = json.load(f)
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get links for this source_set and scope_code
        cur.execute("""
            SELECT question_code, ofc_candidate_id, document_id, locator_type, locator, similarity_score
            FROM ofc_question_links
            WHERE source_set=%s AND scope_code=%s
            ORDER BY question_code, similarity_score DESC
        """, (source_set, scope_code))
        rows = cur.fetchall()
        
        # Group by question
        by_q = defaultdict(list)
        for qc, ocid, doc, ltype, loc, score in rows:
            by_q[qc].append({
                "ofc_candidate_id": str(ocid),
                "document_id": str(doc),
                "locator_type": ltype,
                "locator": loc,
                "score": float(score)
            })
        
        # Pull OFC text for included candidates
        all_ids = list({r["ofc_candidate_id"] for lst in by_q.values() for r in lst})
        ofc_text = {}
        if all_ids:
            cur.execute("""
                SELECT candidate_id::text, snippet_text, excerpt
                FROM ofc_candidate_queue
                WHERE candidate_id = ANY(%s::uuid[])
            """, (all_ids,))
            for cid, ctext, ctx in cur.fetchall():
                ofc_text[cid] = {
                    "candidate_text": ctext or "",
                    "excerpt": ctx or ""
                }
        
        # Build output
        out = []
        covered = 0
        for b in BASE:
            links = by_q.get(b["question_code"], [])
            if links:
                covered += 1
            
            # Enrich links with OFC text
            enriched = []
            for l in links:
                t = ofc_text.get(l["ofc_candidate_id"], {})
                enriched.append({**l, **t})
            
            out.append({
                "question_code": b["question_code"],
                "question_text": b["question_text"],
                "linked_ofcs": enriched
            })
        
        # Write report
        os.makedirs("analytics/reports", exist_ok=True)
        path = f"analytics/reports/baseline_ofc_coverage_{source_set}.json"
        
        report = {
            "source_set": source_set,
            "scope_code": scope_code,
            "baseline_total": len(BASE),
            "baseline_covered": covered,
            "baseline_uncovered": len(BASE) - covered,
            "coverage_percent": round((covered / len(BASE) * 100) if BASE else 0, 1),
            "items": out
        }
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        
        print(f"✅ Wrote coverage report: {path}")
        print(f"   - Baseline questions: {len(BASE)}")
        print(f"   - Questions with OFC links: {covered}")
        print(f"   - Questions without links: {len(BASE) - covered}")
        print(f"   - Coverage: {report['coverage_percent']}%")
        
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
    
    parser = argparse.ArgumentParser(description='Generate baseline OFC coverage report')
    parser.add_argument('source_set', nargs='?', default='CISA_MASS_GATHERING',
                       help='Source set to process (default: CISA_MASS_GATHERING)')
    parser.add_argument('--scope_code', default='BASELINE',
                       help='Question scope code (default: BASELINE)')
    
    args = parser.parse_args()
    
    try:
        report_baseline_ofc_coverage(args.source_set, scope_code=args.scope_code)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
