#!/usr/bin/env python3
"""
Match CORPUS OFC Candidates to Questions

Matches candidate snippets from CORPUS ofc_candidate_queue to question targets.
Performs UNIVERSAL matching (all questions).

HARD RULE: Only reads from and writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import re
import psycopg2
from urllib.parse import urlparse
from collections import defaultdict

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if not corpus_url or not corpus_password:
        raise ValueError('SUPABASE_CORPUS_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    url = urlparse(corpus_url)
    project_ref = url.hostname.split('.')[0]
    connection_string = f'postgresql://postgres:{corpus_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    return psycopg2.connect(connection_string)

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
        if score > 0.05:  # Minimum threshold
            matches.append(('BASE_PRIMARY', q['target_key'], score))
    
    # Match EXPANSION questions
    for q in question_index.get('expansion_questions', []):
        question_keywords = set(q.get('keywords', []))
        score = calculate_match_score(snippet_keywords, question_keywords)
        if score > 0.05:  # Minimum threshold
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

def match_candidates_for_document(document_id: str) -> Dict:
    """Match candidates for a specific document."""
    # Load question index
    index_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
    
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
    cur = conn.cursor()
    
    try:
        # Get document source_id
        cur.execute("""
            SELECT d.source_id
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        source_id = doc_row[0]
        
        # Get all candidates for this document's source
        cur.execute("""
            SELECT candidate_id, snippet_text
            FROM public.ofc_candidate_queue
            WHERE source_id = %s
            ORDER BY created_at
        """, (source_id,))
        
        candidates = cur.fetchall()
        
        if not candidates:
            return {
                'document_id': document_id,
                'candidates_processed': 0,
                'targets_written': 0,
                'base_index_count': base_count,
                'expansion_index_count': expansion_count,
                'message': 'No candidates found for this document'
            }
        
        # Clear existing targets for these candidates (allow re-matching)
        candidate_ids = [c[0] for c in candidates]
        if candidate_ids:
            placeholders = ','.join(['%s'] * len(candidate_ids))
            cur.execute(f"""
                DELETE FROM public.ofc_candidate_targets
                WHERE candidate_id IN ({placeholders})
            """, candidate_ids)
        
        # Match each candidate
        targets_written = 0
        candidates_matched = 0
        target_frequency = defaultdict(int)
        target_scores = defaultdict(list)
        
        for candidate_id, snippet_text in candidates:
            matches = match_candidate_to_questions(snippet_text, question_index, top_k=3)
            
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
    parser = argparse.ArgumentParser(description='Match CORPUS candidates to questions')
    parser.add_argument('--document_id', required=True, help='Document ID (UUID)')
    
    args = parser.parse_args()
    
    try:
        result = match_candidates_for_document(args.document_id)
        
        import json
        print(json.dumps(result, indent=2))
        
        if result.get('index_incomplete'):
            print("\n⚠️  Warning: Question index is incomplete (BASE < 36)")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
