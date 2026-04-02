#!/usr/bin/env python3
"""
CORPUS: Discover Candidates from Active Source Set

Discovers OFC candidates from all documents in the active source set.
Wrapper around mine_ofc_candidates_from_chunks.py for batch processing.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)
# Import mine_candidates function from parent tools directory
sys.path.insert(0, str(Path(__file__).parent.parent))
from mine_ofc_candidates_from_chunks import mine_candidates

def discover_all_candidates(authority_scope: str = "BASELINE_AUTHORITY", max_candidates_per_doc: int = 250):
    """
    Discover candidates from all documents in the active source set.
    """
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        print(f"Active source set: {active_source_set}")
        
        # Get all documents in active source set
        cur.execute("""
            SELECT document_id, title
            FROM public.documents
            WHERE source_set = %s
            ORDER BY title
        """, (active_source_set,))
        
        documents = cur.fetchall()
        
        if not documents:
            print(f"⚠️  No documents found in active source set '{active_source_set}'")
            return {
                'status': 'no_documents',
                'active_source_set': active_source_set,
                'documents_processed': 0,
                'total_candidates': 0
            }
        
        print(f"Found {len(documents)} documents in '{active_source_set}' source set")
        print()
        
        total_candidates = 0
        results = []
        
        for doc_id, title in documents:
            print(f"Processing: {title} ({doc_id})")
            try:
                result = mine_candidates(
                    document_id=str(doc_id),
                    authority_scope=authority_scope,
                    max_candidates=max_candidates_per_doc
                )
                results.append({
                    'document_id': str(doc_id),
                    'title': title,
                    'candidates_inserted': result['candidates_inserted'],
                    'candidates_skipped': result['candidates_skipped']
                })
                total_candidates += result['candidates_inserted']
                print(f"  ✅ {result['candidates_inserted']} candidates inserted, {result['candidates_skipped']} skipped")
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
            'authority_scope': authority_scope,
            'documents_processed': len(documents),
            'total_candidates': total_candidates,
            'results': results
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Discover OFC candidates from all documents in active source set')
    parser.add_argument('--authority_scope', default='BASELINE_AUTHORITY', help='Authority scope (default: BASELINE_AUTHORITY)')
    parser.add_argument('--max_candidates_per_doc', type=int, default=250, help='Max candidates per document (default: 250)')
    
    args = parser.parse_args()
    
    try:
        result = discover_all_candidates(
            authority_scope=args.authority_scope,
            max_candidates_per_doc=args.max_candidates_per_doc
        )
        
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            print(f"\n✅ Discovery complete: {result['total_candidates']} total candidates from {result['documents_processed']} documents")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

