#!/usr/bin/env python3
"""
CORPUS: Export Question Candidates by Lane

Exports question candidates grouped by lane for review.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)

def export_lane(lane: str, output_path: str, source_set: str) -> int:
    """Export candidates for a specific lane."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT 
                id, document_id, locator,
                question_text, context, lane_reason, general_applicability_score
            FROM public.question_candidate_queue
            WHERE source_set = %s AND lane = %s
            ORDER BY document_id, locator
        """, (source_set, lane))
        
        rows = cur.fetchall()
        
        payload = [{
            "candidate_id": str(r[0]),
            "document_id": str(r[1]),
            "locator": r[2] or "NULL",
            "question_text": r[3],
            "context": r[4],
            "lane_reason": r[5],
            "general_applicability_score": float(r[6]) if r[6] is not None else 0.0
        } for r in rows]
        
        # Write to file
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        
        return len(payload)
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    conn = get_corpus_db_connection()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        
        # Export each lane
        out1 = "analytics/reports/cisa_expansion_promotable.json"
        out2 = "analytics/reports/cisa_baseline_revision_candidates.json"
        out3 = "analytics/reports/cisa_context_only.json"
        
        n1 = export_lane("EXPANSION", out1, active_source_set)
        n2 = export_lane("BASELINE_REVISION_CANDIDATE", out2, active_source_set)
        n3 = export_lane("CONTEXT_ONLY", out3, active_source_set)
        
        result = {
            "active_source_set": active_source_set,
            "exports": {
                "EXPANSION": {"count": n1, "out": out1},
                "BASELINE_REVISION_CANDIDATE": {"count": n2, "out": out2},
                "CONTEXT_ONLY": {"count": n3, "out": out3}
            }
        }
        
        print(json.dumps(result, indent=2))
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()

