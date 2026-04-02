#!/usr/bin/env python3
"""
CORPUS: Link Questions to OFCs

Links question candidates to OFC candidates within the same document and control area.
Only questions with citable OFCs can be PROMOTABLE.

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import re
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
import psycopg2

PAGE = re.compile(r"Page\s+(\d+)", re.I)


def page(locator):
    """Extract page number from locator string."""
    if not locator:
        return None
    m = PAGE.search(locator)
    return int(m.group(1)) if m else None


def link_questions_to_ofcs():
    """Link question candidates to OFC candidates by document and page proximity."""
    dsn = os.environ.get("CORPUS_DB_DSN")
    if not dsn:
        # Use corpus connection helper if DSN not set
        conn = get_corpus_db_connection()
    else:
        conn = psycopg2.connect(dsn)
    
    cur = conn.cursor()
    
    try:
        # Check if question_candidate_queue uses candidate_id or id
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'question_candidate_queue'
            AND column_name IN ('candidate_id', 'id')
            ORDER BY column_name
            LIMIT 1
        """)
        id_col_row = cur.fetchone()
        id_column = id_col_row[0] if id_col_row else 'candidate_id'
        
        # Get all question candidates
        cur.execute(f"""
            SELECT {id_column}, document_id, locator, methodology_type, psa_scope_ok
            FROM question_candidate_queue
        """)
        questions = cur.fetchall()
        
        # Check which columns exist in ofc_candidate_queue
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'ofc_candidate_queue'
            AND column_name IN ('document_id', 'page_locator', 'locator')
        """)
        ofc_cols = {row[0] for row in cur.fetchall()}
        has_doc_id = 'document_id' in ofc_cols
        locator_col = 'locator' if 'locator' in ofc_cols else ('page_locator' if 'page_locator' in ofc_cols else None)
        
        if not locator_col:
            print("⚠️  Warning: No locator column found in ofc_candidate_queue")
            ofcs = []
        elif has_doc_id:
            # Use document_id for matching (preferred)
            cur.execute(f"""
                SELECT candidate_id, document_id, {locator_col}
                FROM ofc_candidate_queue
                WHERE document_id IS NOT NULL
            """)
            ofcs = cur.fetchall()
            
            # Build index: document_id -> [(ofc_candidate_id, page_num), ...]
            by_doc = {}
            for ocid, doc_id, loc in ofcs:
                op = page(loc)
                by_doc.setdefault(doc_id, []).append((ocid, op))
        else:
            # Fallback: match by source_id
            cur.execute(f"""
                SELECT candidate_id, source_id, {locator_col}
                FROM ofc_candidate_queue
            """)
            ofcs = cur.fetchall()
            
            # Build index: source_id -> [(ofc_candidate_id, page_num), ...]
            by_source = {}
            for ocid, source_id, loc in ofcs:
                op = page(loc)
                by_source.setdefault(source_id, []).append((ocid, op))
            
            # Also build document_id -> source_id mapping
            cur.execute("""
                SELECT document_id, source_id FROM documents
            """)
            doc_to_source = {doc_id: source_id for doc_id, source_id in cur.fetchall()}
        
        # Link questions to OFCs
        linked_count = 0
        promotable_count = 0
        
        for qid, doc_id, qloc, method, scope_ok in questions:
            if not scope_ok or method not in ("YESNO", "CHECKLIST"):
                bucket = "CONTEXT_ONLY"
                linked = []
            else:
                # Find OFCs in same document within 1 page
                qp = page(qloc)
                linked = []
                
                if has_doc_id:
                    # Direct document_id matching
                    for ocid, op in by_doc.get(doc_id, []):
                        if qp is not None and op is not None and abs(op - qp) <= 1:
                            linked.append(ocid)
                else:
                    # Match via source_id
                    source_id = doc_to_source.get(doc_id)
                    if source_id:
                        for ocid, op in by_source.get(source_id, []):
                            if qp is not None and op is not None and abs(op - qp) <= 1:
                                linked.append(ocid)
                
                bucket = "PROMOTABLE" if linked else "CONTEXT_ONLY"
                if bucket == "PROMOTABLE":
                    promotable_count += 1
            
            if linked:
                linked_count += 1
            
            # Update question candidate
            cur.execute(f"""
                UPDATE question_candidate_queue
                SET has_citable_ofc=%s,
                    linked_ofc_candidate_ids=%s,
                    promotion_bucket=%s
                WHERE {id_column}=%s
            """, (bool(linked), linked, bucket, qid))
        
        conn.commit()
        
        print(f"✅ Question–OFC linkage complete:")
        print(f"   - Questions processed: {len(questions)}")
        print(f"   - Questions with linked OFCs: {linked_count}")
        print(f"   - Promotable questions: {promotable_count}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


def main():
    """CLI entry point."""
    try:
        link_questions_to_ofcs()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
