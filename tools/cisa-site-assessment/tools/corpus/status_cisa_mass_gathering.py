#!/usr/bin/env python3
"""
CORPUS: Status Report for CISA Mass Gathering Source Set

Reports status of CISA_MASS_GATHERING source set including:
- Document and chunk counts
- Candidate counts (OFC and question candidates)
- Sample candidates with page locators

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import sys
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SOURCE_SET = "CISA_MASS_GATHERING"

def main():
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        print("=" * 80)
        print(f"CISA MASS GATHERING SOURCE SET STATUS")
        print("=" * 80)
        print()
        
        # Document count
        cur.execute("""
            SELECT COUNT(*) FROM public.documents
            WHERE source_set = %s
        """, (SOURCE_SET,))
        doc_count = cur.fetchone()[0]
        print(f"Documents: {doc_count}")
        
        # Chunk count
        cur.execute("""
            SELECT COUNT(*) FROM public.document_chunks
            WHERE source_set = %s
        """, (SOURCE_SET,))
        chunk_count = cur.fetchone()[0]
        print(f"Chunks: {chunk_count}")
        
        # OFC candidate count
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue
            WHERE source_set = %s
        """, (SOURCE_SET,))
        ofc_candidate_count = cur.fetchone()[0]
        print(f"OFC Candidates: {ofc_candidate_count}")
        
        # Question candidate count
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'question_candidate_queue'
            )
        """)
        has_table = cur.fetchone()[0]
        
        question_candidate_count = 0
        if has_table:
            cur.execute("""
                SELECT COUNT(*) FROM public.question_candidate_queue
                WHERE source_set = %s
            """, (SOURCE_SET,))
            question_candidate_count = cur.fetchone()[0]
        print(f"Question Candidates: {question_candidate_count}")
        print()
        
        # Sample OFC candidates with locators
        if ofc_candidate_count > 0:
            print("Sample OFC Candidates (with page locators):")
            cur.execute("""
                SELECT 
                    ocq.candidate_id,
                    ocq.snippet_text,
                    ocq.locator,
                    d.title as document_title
                FROM public.ofc_candidate_queue ocq
                JOIN public.documents d ON ocq.document_id = d.document_id
                WHERE ocq.source_set = %s
                ORDER BY ocq.created_at
                LIMIT 5
            """, (SOURCE_SET,))
            
            for i, row in enumerate(cur.fetchall(), 1):
                candidate_id, snippet, locator, doc_title = row
                print(f"  {i}. [{locator}] {doc_title}")
                print(f"     {snippet[:100]}...")
                print()
        
        # Sample question candidates with locators
        if has_table and question_candidate_count > 0:
            print("Sample Question Candidates (with page locators):")
            cur.execute("""
                SELECT 
                    qcq.id,
                    qcq.question_text,
                    qcq.locator,
                    d.title as document_title
                FROM public.question_candidate_queue qcq
                JOIN public.documents d ON qcq.document_id = d.document_id
                WHERE qcq.source_set = %s
                ORDER BY qcq.created_at
                LIMIT 5
            """, (SOURCE_SET,))
            
            for i, row in enumerate(cur.fetchall(), 1):
                candidate_id, question_text, locator, doc_title = row
                print(f"  {i}. [{locator}] {doc_title}")
                print(f"     {question_text[:100]}...")
                print()
        
        # Summary
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        summary = {
            'source_set': SOURCE_SET,
            'documents': doc_count,
            'chunks': chunk_count,
            'ofc_candidates': ofc_candidate_count,
            'question_candidates': question_candidate_count
        }
        print(json.dumps(summary, indent=2))
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()

