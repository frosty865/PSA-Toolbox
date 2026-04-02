#!/usr/bin/env python3
"""
CORPUS: Export Expansion Question Candidates

Exports question candidates for human review and promotion.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

def export_question_candidates(source_set: str, output_path: str) -> Dict:
    """Export question candidates to JSON file."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
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
            return {
                'status': 'no_table',
                'message': 'question_candidate_queue table does not exist'
            }
        
        # Get all question candidates for source_set
        cur.execute("""
            SELECT 
                qcq.id,
                qcq.question_text,
                qcq.context,
                qcq.locator,
                d.title as document_title,
                d.document_id
            FROM public.question_candidate_queue qcq
            JOIN public.documents d ON qcq.document_id = d.document_id
            WHERE qcq.source_set = %s
            ORDER BY d.title, qcq.locator
        """, (source_set,))
        
        candidates = []
        for row in cur.fetchall():
            candidate_id, question_text, context, locator, doc_title, doc_id = row
            candidates.append({
                'candidate_id': str(candidate_id),
                'question_text': question_text,
                'context': context,
                'locator': locator,
                'document_title': doc_title,
                'document_id': str(doc_id)
            })
        
        # Write to file
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(candidates, f, indent=2, ensure_ascii=False)
        
        return {
            'status': 'completed',
            'source_set': source_set,
            'candidates_exported': len(candidates),
            'output_path': str(output_file)
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description='Export expansion question candidates for review')
    parser.add_argument('--source-set', required=True, help='Source set to export from')
    parser.add_argument('--out', required=True, help='Output JSON file path')
    
    args = parser.parse_args()
    
    try:
        result = export_question_candidates(args.source_set, args.out)
        
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            print(f"\n✅ Exported {result['candidates_exported']} question candidates to {result['output_path']}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

