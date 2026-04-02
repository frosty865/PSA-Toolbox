#!/usr/bin/env python3
"""
CORPUS: Match OFC Candidates to Questions

Matches candidate snippets from ofc_candidate_queue to question targets.
Performs:
1. UNIVERSAL matching (all questions)
2. CONTEXT matching (if sector/subsector known)

HARD RULE: Only reads from CORPUS DB and writes to CORPUS DB (yylslokiaovdythzrbgt)
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import re
import psycopg2
from urllib.parse import urlparse
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)

def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_keywords(text: str) -> set:
    """Extract keywords from text."""
    normalized = normalize_text(text)
    words = set(normalized.split())
    # Remove common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'}
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
        jaccard *= 1.2  # 20% boost
    
    return min(jaccard, 1.0)

def load_question_index(index_path: str) -> Dict:
    """Load question matcher index."""
    if not os.path.exists(index_path):
        raise FileNotFoundError(f'Question index not found: {index_path}')
    
    with open(index_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def match_candidate_to_questions(
    snippet_text: str,
    question_index: Dict,
    top_k: int = 3
) -> List[Tuple[str, str, float]]:
    """Match candidate snippet to questions. Returns list of (target_type, target_key, score)."""
    snippet_keywords = extract_keywords(snippet_text)
    matches = []
    
    # Match BASE questions
    for q in question_index.get('base_questions', []):
        question_keywords = set(q.get('keywords', []))
        score = calculate_match_score(snippet_keywords, question_keywords)
        if score > 0.05:  # Lowered threshold for smoke test
            matches.append(('BASE_PRIMARY', q['target_key'], score))
    
    # Match EXPANSION questions
    for q in question_index.get('expansion_questions', []):
        question_keywords = set(q.get('keywords', []))
        score = calculate_match_score(snippet_keywords, question_keywords)
        if score > 0.05:  # Lowered threshold for smoke test
            matches.append(('EXPANSION_QUESTION', q['target_key'], score))
    
    # Sort by score descending and return top K per target_type
    matches.sort(key=lambda x: x[2], reverse=True)
    
    # Group by target_type and take top K per type
    by_type = defaultdict(list)
    for match in matches:
        by_type[match[0]].append(match)
    
    result = []
    for target_type, type_matches in by_type.items():
        result.extend(type_matches[:top_k])
    
    return result

def calculate_match_score_enhanced(
    snippet_text: str,
    question_text: str,
    question_keywords: set,
    min_score: float = 0.35
) -> float:
    """
    Enhanced deterministic scoring with domain term boosting.
    
    Returns score >= min_score if match is strong enough.
    """
    snippet_keywords = extract_keywords(snippet_text)
    
    # Base Jaccard similarity
    intersection = snippet_keywords & question_keywords
    union = snippet_keywords | question_keywords
    
    if not union:
        return 0.0
    
    jaccard = len(intersection) / len(union)
    
    # Domain term boost (security, access, perimeter, etc.)
    domain_terms = {
        'security', 'access', 'perimeter', 'screening', 'coordination', 'training',
        'monitoring', 'barriers', 'standoff', 'lighting', 'surveillance', 'control',
        'entry', 'exit', 'visitor', 'personnel', 'vehicle', 'package', 'inspection',
        'identification', 'verification', 'authentication', 'authorization', 'patrol',
        'response', 'emergency', 'evacuation', 'communication', 'notification'
    }
    
    snippet_domain_terms = snippet_keywords & domain_terms
    question_domain_terms = question_keywords & domain_terms
    
    # Boost if both have domain terms
    if snippet_domain_terms and question_domain_terms:
        domain_overlap = len(snippet_domain_terms & question_domain_terms)
        if domain_overlap > 0:
            jaccard *= (1.0 + domain_overlap * 0.1)  # 10% boost per overlapping domain term
    
    # Phrase hit boost (exact n-gram presence)
    snippet_normalized = normalize_text(snippet_text)
    question_normalized = normalize_text(question_text)
    
    # Check for 3+ word phrases
    snippet_words = snippet_normalized.split()
    question_words = question_normalized.split()
    
    phrase_boost = 0.0
    for i in range(len(snippet_words) - 2):
        phrase = ' '.join(snippet_words[i:i+3])
        if phrase in question_normalized:
            phrase_boost += 0.15  # 15% boost per phrase hit
    
    final_score = min(jaccard + phrase_boost, 1.0)
    
    return final_score if final_score >= min_score else 0.0

def match_candidate_to_questions_enhanced(
    snippet_text: str,
    question_index: Dict,
    top_k: int = 3,
    min_score: float = 0.35
) -> List[Tuple[str, str, float]]:
    """Enhanced matching with domain term boosting and phrase hits."""
    matches = []
    
    # Match BASE questions
    for q in question_index.get('base_questions', []):
        question_text = q.get('question_text', '')
        question_keywords = set(q.get('keywords', []))
        
        score = calculate_match_score_enhanced(
            snippet_text, question_text, question_keywords, min_score
        )
        
        if score > 0:
            matches.append(('BASE_PRIMARY', q['target_key'], score))
    
    # Match EXPANSION questions
    for q in question_index.get('expansion_questions', []):
        question_text = q.get('question_text', '')
        question_keywords = set(q.get('keywords', []))
        
        score = calculate_match_score_enhanced(
            snippet_text, question_text, question_keywords, min_score
        )
        
        if score > 0:
            matches.append(('EXPANSION_QUESTION', q['target_key'], score))
    
    # Sort by score descending and return top K per target_type
    matches.sort(key=lambda x: x[2], reverse=True)
    
    # Group by target_type and take top K per type
    by_type = defaultdict(list)
    for match in matches:
        by_type[match[0]].append(match)
    
    result = []
    for target_type, type_matches in by_type.items():
        result.extend(type_matches[:top_k])
    
    return result

def match_candidates_for_document(
    document_id: str,
    top_k: int = 3,
    min_score: float = 0.35
) -> Dict:
    """Match candidates for a specific document."""
    # Load question index
    index_path = Path(__file__).parent.parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
    
    if not index_path.exists():
        return {
            'error': 'Question index not found',
            'index_path': str(index_path),
            'message': 'Run tools/build_question_matcher_index.py first'
        }
    
    question_index = load_question_index(str(index_path))
    
    base_count = len(question_index.get('base_questions', []))
    expansion_count = len(question_index.get('expansion_questions', []))
    
    # Connect to CORPUS database
    conn = get_corpus_db_connection()
    
    # Enforce active source set
    active_source_set = require_active_source_set(conn)
    print(f"[Source Set] Active: {active_source_set}", file=sys.stderr)
    
    cur = conn.cursor()
    
    try:
        # Get document source_id and source_set
        cur.execute("""
            SELECT d.source_id, d.source_set
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        source_id, doc_source_set = doc_row
        
        # Warn if document source_set doesn't match active
        if doc_source_set != active_source_set:
            print(
                f"⚠️  Warning: Document source_set '{doc_source_set}' != active '{active_source_set}'",
                file=sys.stderr
            )
        
        # Get all candidates for this document's source (filtered by active source_set)
        cur.execute("""
            SELECT candidate_id, snippet_text
            FROM public.ofc_candidate_queue
            WHERE source_id = %s
                AND source_set = %s
            ORDER BY created_at
        """, (source_id, active_source_set))
        
        candidates = cur.fetchall()
        
        # Count candidates outside active set (informational)
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue
            WHERE source_id = %s
                AND source_set != %s
        """, (source_id, active_source_set))
        candidates_outside_set = cur.fetchone()[0]
        
        if not candidates:
            return {
                'document_id': document_id,
                'candidates_processed': 0,
                'targets_written': 0,
                'base_index_count': base_count,
                'expansion_index_count': expansion_count,
                'candidates_outside_active_set': candidates_outside_set,
                'active_source_set': active_source_set,
                'message': f'No candidates found for this document with source_set={active_source_set}'
            }
        
        # Get candidate IDs for idempotent deletion
        candidate_ids = [c[0] for c in candidates]
        
        # Delete existing UNIVERSAL targets for these candidates (idempotent)
        if candidate_ids:
            placeholders = ','.join(['%s'] * len(candidate_ids))
            cur.execute(f"""
                DELETE FROM public.ofc_candidate_targets
                WHERE candidate_id IN ({placeholders})
                AND match_mode = 'UNIVERSAL'
            """, candidate_ids)
        
        # Match each candidate
        targets_written = 0
        candidates_matched = 0
        target_frequency = defaultdict(int)
        target_scores = defaultdict(list)
        
        for candidate_id, snippet_text in candidates:
            matches = match_candidate_to_questions_enhanced(
                snippet_text, question_index, top_k=top_k, min_score=min_score
            )
            
            if matches:
                candidates_matched += 1
            
            # Insert matches
            for target_type, target_key, score in matches:
                cur.execute("""
                    INSERT INTO public.ofc_candidate_targets
                    (candidate_id, target_type, target_key, match_mode, match_score)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (candidate_id, target_type, target_key, match_mode) 
                    DO UPDATE SET match_score = EXCLUDED.match_score
                """, (candidate_id, target_type, target_key, 'UNIVERSAL', score))
                
                targets_written += 1
                target_frequency[(target_type, target_key)] += 1
                target_scores[(target_type, target_key)].append(float(score))
        
        conn.commit()
        
        # Get top targets by frequency
        top_targets = sorted(
            target_frequency.items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        top_targets_list = []
        for (target_type, target_key), count in top_targets:
            scores = target_scores[(target_type, target_key)]
            avg_score = sum(scores) / len(scores) if scores else 0.0
            top_targets_list.append({
                'target_type': target_type,
                'target_key': target_key,
                'count': count,
                'avg_score': round(avg_score, 3)
            })
        
        return {
            'document_id': document_id,
            'candidates_processed': len(candidates),
            'candidates_matched': candidates_matched,
            'targets_written': targets_written,
            'base_index_count': base_count,
            'expansion_index_count': expansion_count,
            'candidates_outside_active_set': candidates_outside_set,
            'active_source_set': active_source_set,
            'top_targets': top_targets_list,
            'index_incomplete': base_count < 36
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Match CORPUS candidates to questions')
    parser.add_argument('--document_id', required=True, help='Document ID (UUID)')
    parser.add_argument('--top_k', type=int, default=3, help='Top K matches per target type (default: 3)')
    parser.add_argument('--min_score', type=float, default=0.35, help='Minimum match score (default: 0.35)')
    
    args = parser.parse_args()
    
    try:
        result = match_candidates_for_document(
            args.document_id,
            top_k=args.top_k,
            min_score=args.min_score
        )
        
        print(json.dumps(result, indent=2))
        
        # Print header with active source set
        active_set = result.get('active_source_set', 'UNKNOWN')
        print(f"\n[Source Set] ACTIVE_SOURCE_SET={active_set}")
        print(f"[Source Set] Candidates in set: {result.get('candidates_processed', 0)}")
        if result.get('candidates_outside_active_set', 0) > 0:
            print(f"[Source Set] Candidates outside set: {result.get('candidates_outside_active_set', 0)} (not processed)")
        
        if result.get('index_incomplete'):
            print("\n⚠️  Warning: Question index is incomplete (BASE < 36)")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

