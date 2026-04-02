#!/usr/bin/env python3
"""
Linking: Hybrid Link OFCs to Questions V3

Hybrid linking using BM25 + TF-IDF + keyword overlap with heading boost.
Produces traceable links with explanations for admin review.

HARD RULE: Only operates on CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
import math
from pathlib import Path
from collections import Counter, defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection
from tools.linking.text_normalize import normalize, split_compound
import psycopg2
from psycopg2.extras import execute_values

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("⚠️  sklearn not available. Install with: pip install scikit-learn", file=sys.stderr)


def bm25_scores(query_tokens, docs_tokens, k1=1.5, b=0.75):
    """
    Compute BM25 scores for query against documents.
    
    Args:
        query_tokens: List of query tokens
        docs_tokens: List of document token lists
        k1: BM25 k1 parameter
        b: BM25 b parameter
        
    Returns:
        List of normalized BM25 scores (0..1)
    """
    N = len(docs_tokens)
    if N == 0:
        return []
    
    avgdl = sum(len(d) for d in docs_tokens) / max(1, N)
    df = Counter()
    for d in docs_tokens:
        for w in set(d):
            df[w] += 1
    
    scores = []
    for d in docs_tokens:
        tf = Counter(d)
        dl = len(d)
        score = 0.0
        for w in query_tokens:
            if w not in tf:
                continue
            n = df.get(w, 0)
            idf = math.log(1 + (N - n + 0.5) / (n + 0.5))
            denom = tf[w] + k1 * (1 - b + b * (dl / avgdl))
            score += idf * (tf[w] * (k1 + 1)) / denom
        scores.append(score)
    
    # Normalize to 0..1
    mx = max(scores) if scores else 0.0
    if mx > 0:
        scores = [s / mx for s in scores]
    
    return scores


def keyword_overlap(q_tokens, d_tokens):
    """
    Compute keyword overlap score.
    
    Args:
        q_tokens: Query token set
        d_tokens: Document token set
        
    Returns:
        Overlap score (0..1)
    """
    q = set(q_tokens)
    d = set(d_tokens)
    if not q:
        return 0.0
    return len(q & d) / len(q)


def main(source_set="CISA_MASS_GATHERING", question_universe_path="analytics/runtime/baseline_full_312.json",
         top_k=3, min_score=0.26, clear_existing=True):
    """
    Link OFCs to questions using hybrid V3 method.
    
    Args:
        source_set: Source set to process
        question_universe_path: Path to question universe JSON
        top_k: Maximum links per question
        min_score: Minimum similarity score threshold
        clear_existing: Whether to clear existing links for this source_set
    """
    if not HAS_SKLEARN:
        raise ImportError("scikit-learn is required. Install with: pip install scikit-learn")
    
    # Load questions
    if not os.path.exists(question_universe_path):
        raise FileNotFoundError(f"Question universe file not found: {question_universe_path}")
    
    with open(question_universe_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
    
    print(f"Loaded {len(questions)} questions from {question_universe_path}")
    
    # Pull OFC candidates from CORPUS
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT candidate_id, document_id, locator_type, locator,
                   snippet_text, COALESCE(excerpt, '') AS excerpt,
                   COALESCE(section_heading, '') AS section_heading
            FROM ofc_candidate_queue
            WHERE source_set=%s
        """, (source_set,))
        ofcs = cur.fetchall()
        
        if not ofcs:
            raise ValueError(f"No OFC candidates found for source_set={source_set}")
        
        print(f"Found {len(ofcs)} OFC candidates")
        
        # Prepare corpus texts (OFCs)
        ofc_texts = []
        ofc_tokens = []
        for _, _, _, _, txt, ctx, _ in ofcs:
            t = normalize((txt or "") + " " + (ctx or ""))
            ofc_texts.append(t)
            ofc_tokens.append(t.split())
        
        # TF-IDF matrix for OFCs (once)
        vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1, stop_words="english")
        Xo = vec.fit_transform(ofc_texts)
        
        # Clear existing links if requested
        if clear_existing:
            cur.execute("""
                DELETE FROM ofc_question_links
                WHERE source_set=%s AND link_method='HYBRID_V3'
            """, (source_set,))
            conn.commit()
            print(f"Cleared existing HYBRID_V3 links for {source_set}")
        
        linked = 0
        total_links = 0
        inserts = []
        
        for q in questions:
            qcode = q["question_code"]
            qtext = q["question_text"]
            
            # Expand compounds for better matching, take best scoring variant
            variants = split_compound(qtext)
            best_variant = None
            best_matches = None
            best_score = 0.0
            best_explain = None
            
            for v in variants:
                qn = normalize(v)
                qtoks = qn.split()
                if len(qtoks) < 4:
                    continue
                
                # BM25
                bm = bm25_scores(qtoks, ofc_tokens)
                
                # TF-IDF
                qv = vec.transform([qn])
                tf = cosine_similarity(qv, Xo).flatten()
                tf = [float(x) for x in tf]
                
                # Keyword overlap
                ov = [keyword_overlap(qtoks, dt) for dt in ofc_tokens]
                
                # Combine scores: 0.45*BM25 + 0.35*TFIDF + 0.20*overlap
                scores = []
                for i in range(len(ofcs)):
                    s = 0.45 * bm[i] + 0.35 * tf[i] + 0.20 * ov[i]
                    scores.append(s)
                
                # OVERLAP_GATE_V1: require minimum overlap and tfidf to prevent generic matches
                gated = []
                for i in range(len(ofcs)):
                    # Require overlap >= 0.18 and TF-IDF >= 0.12
                    if ov[i] < 0.18:
                        continue
                    if tf[i] < 0.12:
                        continue
                    gated.append(i)
                
                # If nothing passes gate, skip this variant
                if not gated:
                    continue
                
                # Pick top-k from gated set only
                ranked = sorted([(scores[i], i) for i in gated], reverse=True)[:top_k]
                ranked = [(s, i) for (s, i) in ranked if s >= min_score]
                
                if ranked and ranked[0][0] > best_score:
                    best_score = ranked[0][0]
                    best_variant = v
                    best_matches = ranked
                    best_explain = {
                        "variant_used": v,
                        "normalized_variant": qn,
                        "min_score": min_score,
                        "top_k": top_k
                    }
            
            if not best_matches:
                continue
            
            # Prepare inserts for best variant
            for s, idx in best_matches:
                ocid, docid, ltype, loc, txt, ctx, heading = ofcs[idx]
                explanation = dict(best_explain or {})
                explanation.update({
                    "score": round(float(s), 6),
                    "method": "HYBRID_V3",
                    "source_set": source_set,
                    "question_code": qcode
                })
                
                inserts.append((
                    source_set, qcode, str(ocid), str(docid), ltype, loc,
                    float(s), "HYBRID_V3", json.dumps(explanation)
                ))
                total_links += 1
            
            linked += 1
        
        # Insert links in batch
        if inserts:
            execute_values(
                cur,
                """
                INSERT INTO ofc_question_links (
                    source_set, question_code, ofc_candidate_id, document_id,
                    locator_type, locator, similarity_score, link_method, link_explanation
                )
                VALUES %s
                ON CONFLICT (source_set, link_method, question_code, ofc_candidate_id) DO NOTHING
                """,
                inserts,
                template="(%s, %s, %s::UUID, %s::UUID, %s, %s, %s, %s, %s::jsonb)"
            )
        
        conn.commit()
        
        print(f"✅ Questions linked (>=1 link): {linked} / {len(questions)}")
        print(f"✅ Total links created: {total_links}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()


def main_cli():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Link OFCs to questions using hybrid V3 method')
    parser.add_argument('source_set', nargs='?', default='CISA_MASS_GATHERING',
                       help='Source set to process (default: CISA_MASS_GATHERING)')
    parser.add_argument('--universe', default='analytics/runtime/baseline_full_312.json',
                       help='Question universe JSON file (default: baseline_full_312.json)')
    parser.add_argument('--top_k', type=int, default=3,
                       help='Maximum links per question (default: 3)')
    parser.add_argument('--min_score', type=float, default=0.26,
                       help='Minimum similarity score (default: 0.26)')
    parser.add_argument('--no-clear', action='store_true',
                       help='Do NOT clear existing HYBRID_V3 links (default: clears existing)')
    
    args = parser.parse_args()
    
    try:
        main(
            source_set=args.source_set,
            question_universe_path=args.universe,
            top_k=args.top_k,
            min_score=args.min_score,
            clear_existing=not args.no_clear
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main_cli()
