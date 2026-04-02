#!/usr/bin/env python3
"""
CORPUS: Route Derived Questions to Lanes

Scores general applicability and assigns lanes to question candidates.
Protects baseline questions from automatic promotion.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import re
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)

GENERAL_TOKENS = [
    r"\bemployees?\b", r"\bstaff\b", r"\btraining\b", r"\bexercise\b",
    r"\bincident\b", r"\breport\b", r"\bnotification\b", r"\bfirst responders?\b",
    r"\broles?\b", r"\bresponsibilit(y|ies)\b", r"\bplans?\b", r"\bprocedures?\b",
    r"\bcoordina(te|tion)\b", r"\bsecurity operations\b"
]

MASS_GATHERING_TOKENS = [
    r"\bevent\b", r"\bvenue\b", r"\bpatrons?\b", r"\bcrowd\b", r"\bticket\b",
    r"\bcredential\b", r"\bwristband\b", r"\btailgate\b", r"\bVIP\b", r"\bdignitar(y|ies)\b",
    r"\balcohol\b", r"\bparticipants?\b", r"\bspectators?\b"
]

CONTEXT_ONLY_TOKENS = [
    r"\bhours of operation\b", r"\bwho will be attending\b", r"\bcrowd density\b",
    r"\balcohol consumption\b", r"\bVIPs?\b", r"\bdignitar(y|ies)\b"
]

def score(text: str, patterns: list) -> float:
    """Score text against pattern list."""
    t = text.lower()
    hits = 0
    for p in patterns:
        if re.search(p, t, re.I):
            hits += 1
    if not patterns:
        return 0.0
    return min(1.0, hits / 4.0)  # saturate quickly

def main():
    """Route question candidates to lanes."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        print(f"Active source set: {active_source_set}")
        print()
        
        # Check if table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'question_candidate_queue'
            )
        """)
        
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("⚠️  question_candidate_queue table does not exist")
            return {
                'status': 'no_table',
                'active_source_set': active_source_set
            }
        
        # Get all question candidates for source_set
        cur.execute("""
            SELECT id, question_text
            FROM public.question_candidate_queue
            WHERE source_set = %s
        """, (active_source_set,))
        
        rows = cur.fetchall()
        
        if not rows:
            print(f"⚠️  No question candidates found for source_set='{active_source_set}'")
            return {
                'status': 'no_candidates',
                'active_source_set': active_source_set,
                'rows_updated': 0
            }
        
        print(f"Routing {len(rows)} question candidates...")
        print()
        
        updated = 0
        exp = 0
        base_rev = 0
        ctx = 0
        
        for cid, text in rows:
            # Score against token patterns
            g = score(text, GENERAL_TOKENS)
            m = score(text, MASS_GATHERING_TOKENS)
            c = score(text, CONTEXT_ONLY_TOKENS)
            
            # Lane assignment rules
            if c >= 0.5:
                lane = "CONTEXT_ONLY"
                reason = "context/facility-info style prompt (not a security control question set item)"
            elif g >= 0.5 and m < 0.5:
                lane = "BASELINE_REVISION_CANDIDATE"
                reason = "appears generally applicable across facilities; store for baseline governance review (no auto-promotion)"
            else:
                lane = "EXPANSION"
                reason = "event/venue-specific or not clearly general; keep as overlay expansion"
            
            # Update candidate
            cur.execute("""
                UPDATE public.question_candidate_queue
                SET lane = %s, general_applicability_score = %s, lane_reason = %s
                WHERE id = %s
            """, (lane, g, reason, cid))
            
            updated += 1
            if lane == "EXPANSION":
                exp += 1
            elif lane == "BASELINE_REVISION_CANDIDATE":
                base_rev += 1
            else:
                ctx += 1
        
        conn.commit()
        
        result = {
            "status": "completed",
            "active_source_set": active_source_set,
            "rows_updated": updated,
            "lane_counts": {
                "EXPANSION": exp,
                "BASELINE_REVISION_CANDIDATE": base_rev,
                "CONTEXT_ONLY": ctx
            }
        }
        
        print(json.dumps(result, indent=2))
        return result
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

