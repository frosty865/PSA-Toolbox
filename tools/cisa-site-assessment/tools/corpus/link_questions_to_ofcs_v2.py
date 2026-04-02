#!/usr/bin/env python3
"""
CORPUS: Link Questions to OFCs V2 (Semantic Matching)

Links question candidates to OFC candidates using semantic similarity
instead of page proximity. Uses TF-IDF cosine similarity with heading boost.

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
import psycopg2
from psycopg2.extras import execute_values

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("⚠️  sklearn not available. Install with: pip install scikit-learn", file=sys.stderr)


def link_questions_to_ofcs_v2(source_set: str, top_k: int = 5, min_score: float = 0.18):
    """
    Link questions to OFCs using semantic similarity.
    
    Args:
        source_set: Source set to process
        top_k: Maximum number of OFCs to link per question
        min_score: Minimum similarity score threshold
    """
    if not HAS_SKLEARN:
        raise ImportError("scikit-learn is required for semantic matching. Install with: pip install scikit-learn")
    
    conn = get_corpus_db_connection()
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
        q_id_column = id_col_row[0] if id_col_row else 'candidate_id'
        
        # Load questions needing linkage (only those method-valid)
        cur.execute(f"""
            SELECT {q_id_column}, document_id, locator, section_heading, methodology_type, psa_scope_ok,
                   COALESCE(rewrite_text, question_text) AS qtext
            FROM question_candidate_queue
            WHERE source_set=%s
        """, (source_set,))
        qrows = cur.fetchall()
        
        if not qrows:
            print(f"No questions found for source_set: {source_set}")
            return
        
        # Load OFCs
        cur.execute("""
            SELECT candidate_id, document_id, locator, section_heading, snippet_text
            FROM ofc_candidate_queue
            WHERE source_set=%s
        """, (source_set,))
        orows = cur.fetchall()
        
        # Group OFCs by document
        ofcs_by_doc = defaultdict(list)
        for ocid, doc, loc, head, text in orows:
            ofcs_by_doc[doc].append((ocid, loc, head, text or ""))
        
        updates = []
        processed = 0
        
        for qid, doc, qloc, qhead, mtype, scope_ok, qtext in qrows:
            processed += 1
            if processed % 10 == 0:
                print(f"Processing question {processed}/{len(qrows)}...")
            
            if not scope_ok or mtype not in ("YESNO", "CHECKLIST"):
                updates.append((False, [], "CONTEXT_ONLY", qid))
                continue
            
            ofcs = ofcs_by_doc.get(doc, [])
            if not ofcs:
                updates.append((False, [], "CONTEXT_ONLY", qid))
                continue
            
            # Build corpus: question text + all OFC texts from same document
            corpus_texts = [qtext] + [o[3] for o in ofcs]
            
            # Compute TF-IDF vectors
            try:
                vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", min_df=1)
                X = vec.fit_transform(corpus_texts)
                
                # Get question vector and OFC vectors
                qv = X[0:1]
                ov = X[1:]
                
                # Compute cosine similarities
                sims = cosine_similarity(qv, ov).flatten()
                
                # Apply heading boost (small boost for same heading)
                boosted = []
                for i, (ocid, loc, ohead, otext) in enumerate(ofcs):
                    score = float(sims[i])
                    # Small boost if headings match
                    if qhead and ohead:
                        qh_norm = qhead.strip().lower() if qhead else ""
                        oh_norm = ohead.strip().lower() if ohead else ""
                        if qh_norm and oh_norm and qh_norm == oh_norm:
                            score += 0.05
                    boosted.append((score, ocid))
                
                # Sort by score and take top_k above threshold
                boosted.sort(reverse=True, key=lambda x: x[0])
                best = [(s, ocid) for s, ocid in boosted[:top_k] if s >= min_score]
                linked = [ocid for _, ocid in best]
                
            except Exception as e:
                # Fallback if TF-IDF fails
                print(f"⚠️  Error computing similarity for question {qid}: {e}", file=sys.stderr)
                linked = []
            
            has = len(linked) > 0
            bucket = "PROMOTABLE" if has else "CONTEXT_ONLY"
            updates.append((has, linked, bucket, qid))
        
        # Apply updates in batch
        if updates:
            execute_values(
                cur,
                f"""
                UPDATE question_candidate_queue AS q
                SET has_citable_ofc = data.has_citable_ofc,
                    linked_ofc_candidate_ids = data.linked_ofc_candidate_ids,
                    promotion_bucket = data.promotion_bucket
                FROM (VALUES %s) AS data(has_citable_ofc, linked_ofc_candidate_ids, promotion_bucket, candidate_id)
                WHERE q.{q_id_column} = data.candidate_id
                """,
                updates,
                template="(%s, %s::UUID[], %s, %s::UUID)"
            )
        
        conn.commit()
        
        promotable_count = sum(1 for u in updates if u[2] == "PROMOTABLE")
        print(f"✅ Question–OFC linkage V2 complete for {source_set}")
        print(f"   - Questions processed: {len(updates)}")
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
    import argparse
    
    parser = argparse.ArgumentParser(description='Link questions to OFCs using semantic similarity')
    parser.add_argument('source_set', nargs='?', default='CISA_MASS_GATHERING',
                       help='Source set to process (default: CISA_MASS_GATHERING)')
    parser.add_argument('--top_k', type=int, default=5,
                       help='Maximum OFCs to link per question (default: 5)')
    parser.add_argument('--min_score', type=float, default=0.18,
                       help='Minimum similarity score threshold (default: 0.18)')
    
    args = parser.parse_args()
    
    try:
        link_questions_to_ofcs_v2(args.source_set, top_k=args.top_k, min_score=args.min_score)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
