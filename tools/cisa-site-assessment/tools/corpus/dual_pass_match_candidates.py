#!/usr/bin/env python3
"""
CORPUS: Dual-Pass Candidate Matching (BASE + EXPANSION)

Matches candidates in two passes:
- PASS A: Always matches to BASE=36 questions
- PASS B: Optionally matches to EXPANSION questions (if overlays selected and index exists)

HARD RULE: Only reads from CORPUS DB and writes to CORPUS DB (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)
from tools.corpus.overlay_control import (
    get_overlay_control,
    snapshot_overlay_control
)

def load_question_index(index_path: Path) -> Dict:
    """Load question matcher index."""
    if not index_path.exists():
        return None
    
    with open(index_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_keywords(text: str) -> set:
    """Extract keywords from text."""
    normalized = normalize_text(text)
    words = set(normalized.split())
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'
    }
    words = words - stop_words
    return words

def calculate_match_score(snippet_keywords: set, question_keywords: set) -> float:
    """Calculate match score between snippet and question."""
    if not question_keywords:
        return 0.0
    
    # Jaccard similarity
    intersection = snippet_keywords & question_keywords
    union = snippet_keywords | question_keywords
    
    if not union:
        return 0.0
    
    jaccard = len(intersection) / len(union)
    
    # Boost for strong keyword overlap
    if len(intersection) >= 3:
        jaccard *= 1.2
    
    return min(jaccard, 1.0)

def match_pass(
    conn,
    candidates: List[Tuple],
    question_index: Dict,
    universe: str,
    source_set: str,
    overlay_snapshot: Dict,
    threshold: float,
    top_k: int = 3
) -> Tuple[str, int, int]:
    """
    Run a single matching pass (BASE or EXPANSION).
    
    Returns: (match_run_id, candidates_matched, links_written)
    """
    cur = conn.cursor()
    
    try:
        # Create match run record
        cur.execute("""
            INSERT INTO public.corpus_match_runs (
                source_set, universe, overlay_snapshot, threshold
            )
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            source_set,
            universe,
            json.dumps(overlay_snapshot),
            threshold
        ))
        
        match_run_id = str(cur.fetchone()[0])
        
        # Get questions for this universe
        if universe == 'BASE':
            questions = question_index.get('base_questions', [])
        else:  # EXPANSION
            questions = question_index.get('expansion_questions', [])
        
        if not questions:
            conn.commit()
            return match_run_id, 0, 0
        
        # Match candidates to questions
        candidates_matched = 0
        links_written = 0
        
        for candidate_id, snippet_text in candidates:
            snippet_keywords = extract_keywords(snippet_text)
            
            # Find matches
            matches = []
            for q in questions:
                question_keywords = set(q.get('keywords', []))
                score = calculate_match_score(snippet_keywords, question_keywords)
                
                if score >= threshold:
                    question_code = q.get('question_code') or q.get('target_key')
                    matches.append((question_code, score))
            
            # Sort and take top K
            matches.sort(key=lambda x: x[1], reverse=True)
            top_matches = matches[:top_k]
            
            if top_matches:
                candidates_matched += 1
                
                # Write links
                for question_code, score in top_matches:
                    cur.execute("""
                        INSERT INTO public.corpus_candidate_question_links (
                            match_run_id, source_set, universe, candidate_id, question_code, score
                        )
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (match_run_id, source_set, universe, candidate_id, question_code, score))
                    links_written += 1
        
        conn.commit()
        return match_run_id, candidates_matched, links_written
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()

def dual_pass_match_all(
    base_threshold: float = 0.15,
    expansion_threshold: float = 0.15,
    top_k: int = 3
) -> Dict:
    """
    Run dual-pass matching for all candidates in active source set.
    """
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        
        # Get overlay snapshot
        overlay_snapshot = snapshot_overlay_control(conn)
        
        # Load BASE index
        base_index_path = Path(__file__).parent.parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
        base_index = load_question_index(base_index_path)
        
        if not base_index:
            raise RuntimeError(f"BASE index not found: {base_index_path}")
        
        base_questions = base_index.get('base_questions', [])
        if len(base_questions) != 36:
            raise RuntimeError(f"BASE index must have exactly 36 questions, found {len(base_questions)}")
        
        # Load EXPANSION index (optional)
        expansion_index_path = Path(__file__).parent.parent.parent / 'analytics' / 'runtime' / 'expansion_question_matcher_index.json'
        expansion_index = load_question_index(expansion_index_path)
        
        # Check if EXPANSION pass should run
        has_overlays = bool(
            overlay_snapshot['active_sector_codes'] or
            overlay_snapshot['active_subsector_codes'] or
            overlay_snapshot['active_technology_codes']
        )
        has_expansion_questions = expansion_index and len(expansion_index.get('expansion_questions', [])) > 0
        
        # Get all candidates for active source set
        cur.execute("""
            SELECT candidate_id, snippet_text
            FROM public.ofc_candidate_queue
            WHERE source_set = %s
            ORDER BY created_at
        """, (active_source_set,))
        
        candidates = cur.fetchall()
        
        if not candidates:
            return {
                'status': 'no_candidates',
                'active_source_set': active_source_set,
                'candidates_processed': 0
            }
        
        print("=" * 80)
        print("DUAL-PASS MATCHING")
        print("=" * 80)
        print(f"ACTIVE_SOURCE_SET={active_source_set}")
        print(f"OVERLAYS:")
        print(f"  Sectors:      {overlay_snapshot['active_sector_codes']}")
        print(f"  Subsectors:   {overlay_snapshot['active_subsector_codes']}")
        print(f"  Technologies: {overlay_snapshot['active_technology_codes']}")
        print()
        
        # PASS A: BASE (always)
        print("PASS A: BASE questions")
        print(f"  Questions: {len(base_questions)}")
        print(f"  Candidates: {len(candidates)}")
        
        base_run_id, base_matched, base_links = match_pass(
            conn, candidates, base_index, 'BASE', active_source_set,
            overlay_snapshot, base_threshold, top_k
        )
        
        print(f"  Links: {base_links}")
        print()
        
        # PASS B: EXPANSION (optional)
        expansion_run_id = None
        expansion_matched = 0
        expansion_links = 0
        
        if has_overlays and has_expansion_questions:
            expansion_questions = expansion_index.get('expansion_questions', [])
            print("PASS B: EXPANSION questions")
            print(f"  Questions: {len(expansion_questions)}")
            print(f"  Candidates: {len(candidates)}")
            
            expansion_run_id, expansion_matched, expansion_links = match_pass(
                conn, candidates, expansion_index, 'EXPANSION', active_source_set,
                overlay_snapshot, expansion_threshold, top_k
            )
            
            print(f"  Links: {expansion_links}")
        else:
            if not has_overlays:
                print("PASS B: EXPANSION skipped (no overlays selected)")
            elif not has_expansion_questions:
                print("PASS B: EXPANSION skipped (no expansion questions in index)")
            print()
        
        return {
            'status': 'completed',
            'active_source_set': active_source_set,
            'overlay_snapshot': overlay_snapshot,
            'candidates_processed': len(candidates),
            'pass_a': {
                'universe': 'BASE',
                'questions': len(base_questions),
                'candidates_matched': base_matched,
                'links_written': base_links,
                'match_run_id': base_run_id
            },
            'pass_b': {
                'universe': 'EXPANSION',
                'questions': len(expansion_index.get('expansion_questions', [])) if expansion_index else 0,
                'candidates_matched': expansion_matched,
                'links_written': expansion_links,
                'match_run_id': expansion_run_id,
                'skipped': not (has_overlays and has_expansion_questions)
            }
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Dual-pass candidate matching (BASE + EXPANSION)')
    parser.add_argument('--source-set', help='Source set to match (default: use active source set)')
    parser.add_argument('--base-threshold', type=float, default=0.15, help='BASE matching threshold (default: 0.15)')
    parser.add_argument('--expansion-threshold', type=float, default=0.15, help='EXPANSION matching threshold (default: 0.15)')
    parser.add_argument('--top-k', type=int, default=3, help='Top K matches per question (default: 3)')
    
    args = parser.parse_args()
    
    try:
        # If source-set provided, set it as active first
        if args.source_set:
            from tools.corpus.source_set import get_corpus_db_connection, set_active_source_set
            conn = get_corpus_db_connection()
            set_active_source_set(conn, args.source_set)
            conn.close()
            print(f"Set active source set to: {args.source_set}")
            print()
        
        result = dual_pass_match_all(
            base_threshold=args.base_threshold,
            expansion_threshold=args.expansion_threshold,
            top_k=args.top_k
        )
        
        print()
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            print()
            print("✅ Dual-pass matching complete!")
            print(f"  PASS A (BASE): {result['pass_a']['links_written']} links")
            if not result['pass_b']['skipped']:
                print(f"  PASS B (EXPANSION): {result['pass_b']['links_written']} links")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

