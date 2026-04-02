#!/usr/bin/env python3
"""
CORPUS: Link OFCs to Baseline Questions

Links OFC candidates to baseline assessment questions using TF-IDF similarity.
Stores links in CORPUS for admin review (no runtime writes).

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
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
from psycopg2.extras import execute_values

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("⚠️  sklearn not available. Install with: pip install scikit-learn", file=sys.stderr)


BASE_PATH = "analytics/runtime/baseline_questions.json"


def link_ofcs_to_baseline_questions(source_set: str, scope_code: str = "BASELINE", top_k: int = 5, min_score: float = 0.20):
    """
    Link OFC candidates to baseline questions using semantic similarity.
    
    Args:
        source_set: Source set to process
        scope_code: Question scope code (default: BASELINE)
        top_k: Maximum number of OFCs to link per question
        min_score: Minimum similarity score threshold
    """
    if not HAS_SKLEARN:
        raise ImportError("scikit-learn is required for semantic matching. Install with: pip install scikit-learn")
    
    # Load baseline questions
    if not os.path.exists(BASE_PATH):
        raise FileNotFoundError(f"Baseline questions file not found: {BASE_PATH}. Run export_baseline_questions.py first.")
    
    with open(BASE_PATH, "r", encoding="utf-8") as f:
        base = json.load(f)
    
    if not base:
        raise ValueError("No baseline questions loaded")
    
    print(f"Loaded {len(base)} baseline questions")
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Pull OFCs for this source_set
        cur.execute("""
            SELECT candidate_id, document_id, locator_type, locator, 
                   COALESCE(section_heading, '') as section_heading,
                   snippet_text
            FROM ofc_candidate_queue
            WHERE source_set=%s
        """, (source_set,))
        ofcs = cur.fetchall()
        
        if not ofcs:
            print(f"No OFCs found for source_set: {source_set}")
            return
        
        print(f"Found {len(ofcs)} OFC candidates")
        
        # Vectorize baseline + OFCs together for stable comparisons
        texts = [b["question_text"] for b in base] + [o[5] for o in ofcs]  # o[5] is snippet_text
        
        vec = TfidfVectorizer(ngram_range=(1, 2), stop_words="english", min_df=1)
        X = vec.fit_transform(texts)
        
        base_X = X[:len(base)]
        ofc_X = X[len(base):]
        
        # Compute similarity matrix
        sim = cosine_similarity(base_X, ofc_X)
        
        # Clear existing links for this run scope/source
        cur.execute("""
            DELETE FROM ofc_question_links
            WHERE source_set=%s AND scope_code=%s
        """, (source_set, scope_code))
        
        deleted_count = cur.rowcount
        if deleted_count > 0:
            print(f"Cleared {deleted_count} existing links")
        
        # Build links
        inserts = []
        for i, b in enumerate(base):
            scores = sim[i]
            # Get top_k OFCs above min_score
            ranked = sorted(enumerate(scores), key=lambda t: t[1], reverse=True)
            
            question_links = []
            for j, s in ranked[:top_k * 4]:  # Oversample then threshold
                if float(s) < min_score:
                    break
                ocid, doc_id, ltype, loc, heading, otext = ofcs[j]
                question_links.append((
                    source_set, scope_code, b["question_code"],
                    ocid, doc_id, ltype, loc, float(s)
                ))
                if len(question_links) >= top_k:
                    break
            
            inserts.extend(question_links)
        
        # Insert links in batch
        if inserts:
            execute_values(
                cur,
                """
                INSERT INTO ofc_question_links (
                    source_set, scope_code, question_code,
                    ofc_candidate_id, document_id, locator_type, locator,
                    similarity_score
                ) VALUES %s
                """,
                inserts,
                template="(%s, %s, %s, %s::UUID, %s::UUID, %s, %s, %s)"
            )
        
        conn.commit()
        
        print(f"✅ Linked {len(inserts)} OFC->question links for {source_set} ({scope_code})")
        print(f"   - Questions with links: {len(set(i[2] for i in inserts))}")
        print(f"   - Average links per question: {len(inserts) / len(base):.2f}")
        
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
    
    parser = argparse.ArgumentParser(description='Link OFCs to baseline questions using semantic similarity')
    parser.add_argument('source_set', nargs='?', default='CISA_MASS_GATHERING',
                       help='Source set to process (default: CISA_MASS_GATHERING)')
    parser.add_argument('--scope_code', default='BASELINE',
                       help='Question scope code (default: BASELINE)')
    parser.add_argument('--top_k', type=int, default=5,
                       help='Maximum OFCs to link per question (default: 5)')
    parser.add_argument('--min_score', type=float, default=0.20,
                       help='Minimum similarity score threshold (default: 0.20)')
    
    args = parser.parse_args()
    
    try:
        link_ofcs_to_baseline_questions(
            args.source_set,
            scope_code=args.scope_code,
            top_k=args.top_k,
            min_score=args.min_score
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
