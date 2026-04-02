#!/usr/bin/env python3
"""
CORPUS: Match All Candidates from Active Source Set

Matches OFC candidates from all documents in the active source set to questions.
Wrapper around match_candidates_to_questions.py for batch processing.

HARD RULE: Only reads from CORPUS DB and writes to CORPUS DB (yylslokiaovdythzrbgt)
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
from tools.corpus.match_candidates_to_questions import match_candidates_for_document

def match_all_candidates(top_k: int = 3, min_score: float = 0.15):
    """
    Match candidates from all documents in the active source set.
    """
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        print(f"Active source set: {active_source_set}")
        
        # Get all documents in active source set that have candidates
        cur.execute("""
            SELECT DISTINCT d.document_id, d.title
            FROM public.documents d
            INNER JOIN public.ofc_candidate_queue ocq ON ocq.source_id = d.source_id
            WHERE d.source_set = %s
                AND ocq.source_set = %s
            ORDER BY d.title
        """, (active_source_set, active_source_set))
        
        documents = cur.fetchall()
        
        if not documents:
            print(f"⚠️  No documents with candidates found in active source set '{active_source_set}'")
            return {
                'status': 'no_documents',
                'active_source_set': active_source_set,
                'documents_processed': 0,
                'total_targets': 0
            }
        
        print(f"Found {len(documents)} documents with candidates in '{active_source_set}' source set")
        print()
        
        total_targets = 0
        results = []
        
        for doc_id, title in documents:
            print(f"Processing: {title} ({doc_id})")
            try:
                result = match_candidates_for_document(
                    document_id=str(doc_id),
                    top_k=top_k,
                    min_score=min_score
                )
                results.append({
                    'document_id': str(doc_id),
                    'title': title,
                    'candidates_processed': result['candidates_processed'],
                    'candidates_matched': result['candidates_matched'],
                    'targets_written': result['targets_written']
                })
                total_targets += result['targets_written']
                print(f"  ✅ {result['targets_written']} targets written from {result['candidates_processed']} candidates")
            except Exception as e:
                print(f"  ❌ Error processing {title}: {e}", file=sys.stderr)
                results.append({
                    'document_id': str(doc_id),
                    'title': title,
                    'error': str(e)
                })
            print()
        
        return {
            'status': 'completed',
            'active_source_set': active_source_set,
            'documents_processed': len(documents),
            'total_targets': total_targets,
            'results': results
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Match OFC candidates from all documents in active source set')
    parser.add_argument('--top_k', type=int, default=3, help='Top K matches per target type (default: 3)')
    parser.add_argument('--min_score', type=float, default=0.15, help='Minimum match score (default: 0.15)')
    
    args = parser.parse_args()
    
    try:
        result = match_all_candidates(
            top_k=args.top_k,
            min_score=args.min_score
        )
        
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            print(f"\n✅ Matching complete: {result['total_targets']} total targets from {result['documents_processed']} documents")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

