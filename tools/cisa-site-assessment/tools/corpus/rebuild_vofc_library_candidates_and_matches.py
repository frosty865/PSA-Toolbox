#!/usr/bin/env python3
"""
CORPUS: Rebuild VOFC Library Candidates and Matches

Rebuilds candidates and matches for VOFC_LIBRARY source set only.
Deletes existing candidates and matches, then re-runs discovery and matching.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
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
from tools.corpus.discover_candidates import discover_all_candidates
from tools.corpus.match_all_candidates import match_all_candidates

def rebuild_vofc_library():
    """
    Rebuild candidates and matches for VOFC_LIBRARY.
    """
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # STEP 1: Confirm active_source_set == "VOFC_LIBRARY" (hard fail otherwise)
        active_source_set = require_active_source_set(conn, expected='VOFC_LIBRARY')
        print(f"✅ Active source set confirmed: {active_source_set}")
        print()
        
        # STEP 2: Delete existing VOFC_LIBRARY match links
        print("Deleting existing VOFC_LIBRARY match links...")
        cur.execute("""
            DELETE FROM public.ofc_candidate_targets
            WHERE candidate_id IN (
                SELECT candidate_id FROM public.ofc_candidate_queue
                WHERE source_set = 'VOFC_LIBRARY'
            )
        """)
        matches_deleted = cur.rowcount
        print(f"  Deleted {matches_deleted} match links")
        
        # STEP 3: Delete existing VOFC_LIBRARY candidates
        print("Deleting existing VOFC_LIBRARY candidates...")
        cur.execute("""
            DELETE FROM public.ofc_candidate_queue
            WHERE source_set = 'VOFC_LIBRARY'
        """)
        candidates_deleted = cur.rowcount
        print(f"  Deleted {candidates_deleted} candidates")
        
        conn.commit()
        print()
        
        # STEP 4: Re-run discovery
        print("=" * 60)
        print("STEP 4: Re-running candidate discovery...")
        print("=" * 60)
        discovery_result = discover_all_candidates(
            authority_scope='BASELINE_AUTHORITY',
            max_candidates_per_doc=250
        )
        
        if discovery_result['status'] != 'completed':
            raise RuntimeError(f"Discovery failed: {discovery_result}")
        
        print()
        print(f"✅ Discovery complete: {discovery_result['total_candidates']} candidates from {discovery_result['documents_processed']} documents")
        print()
        
        # STEP 5: Build matcher index (BASE=36 enforced)
        print("=" * 60)
        print("STEP 5: Building question matcher index (BASE=36 enforced)...")
        print("=" * 60)
        import subprocess
        result = subprocess.run(
            [sys.executable, 'tools/build_question_matcher_index.py'],
            cwd=str(Path(__file__).parent.parent.parent),
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"⚠️  Warning: Index build had issues:\n{result.stderr}", file=sys.stderr)
        else:
            print(result.stdout)
        
        print()
        
        # STEP 6: Re-run matching
        print("=" * 60)
        print("STEP 6: Re-running candidate matching...")
        print("=" * 60)
        matching_result = match_all_candidates(
            top_k=3,
            min_score=0.15
        )
        
        if matching_result['status'] != 'completed':
            raise RuntimeError(f"Matching failed: {matching_result}")
        
        print()
        print(f"✅ Matching complete: {matching_result['total_targets']} targets from {matching_result['documents_processed']} documents")
        print()
        
        # STEP 7: Final counts
        print("=" * 60)
        print("FINAL COUNTS")
        print("=" * 60)
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue
            WHERE source_set = 'VOFC_LIBRARY'
        """)
        final_candidate_count = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_targets
            WHERE candidate_id IN (
                SELECT candidate_id FROM public.ofc_candidate_queue
                WHERE source_set = 'VOFC_LIBRARY'
            )
        """)
        final_match_count = cur.fetchone()[0]
        
        cur.execute("""
            SELECT COUNT(*) FROM public.document_chunks
            WHERE source_set = 'VOFC_LIBRARY'
        """)
        chunk_count = cur.fetchone()[0]
        
        print(f"Chunks processed: {chunk_count}")
        print(f"Candidates inserted: {final_candidate_count}")
        print(f"Matches created: {final_match_count}")
        print()
        
        return {
            'status': 'completed',
            'chunks_processed': chunk_count,
            'candidates_inserted': final_candidate_count,
            'matches_created': final_match_count,
            'discovery_result': discovery_result,
            'matching_result': matching_result
        }
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Rebuild failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    try:
        result = rebuild_vofc_library()
        print(json.dumps(result, indent=2))
        print()
        print("✅ Rebuild complete!")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

