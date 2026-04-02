#!/usr/bin/env python3
"""
Generate Detailed Match + Non-Match Report

Lists unmatched candidates, groups by discipline, shows top 3 nearest questions,
and preserves SAFE reference numbers.
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from datetime import datetime

import psycopg2
from urllib.parse import urlparse

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

def extract_safe_reference(candidate_text: str) -> Optional[str]:
    """Extract SAFE reference number from candidate text."""
    # Look for patterns like "SAFE-XXX", "SAFE XXX", "Reference: XXX", etc.
    patterns = [
        r'SAFE[- ]?(\d+[A-Z]?|\d+\.\d+)',
        r'Reference[: ]+(\d+[A-Z]?|\d+\.\d+)',
        r'Ref[: ]+(\d+[A-Z]?|\d+\.\d+)',
        r'\((\d+[A-Z]?|\d+\.\d+)\)',  # Numbers in parentheses
    ]
    
    for pattern in patterns:
        match = re.search(pattern, candidate_text, re.IGNORECASE)
        if match:
            ref = match.group(1) if match.groups() else match.group(0)
            return f"SAFE-{ref}" if not ref.startswith('SAFE') else ref
    
    return None

def infer_discipline(candidate_text: str) -> str:
    """Infer discipline from candidate text."""
    text_lower = candidate_text.lower()
    
    # Discipline keywords
    discipline_keywords = {
        'VSS': ['video', 'surveillance', 'camera', 'cctv', 'monitoring', 'recording'],
        'ACS': ['access', 'control', 'card', 'reader', 'badge', 'credential', 'entry'],
        'PDS': ['perimeter', 'fence', 'barrier', 'gate', 'boundary', 'standoff'],
        'IDS': ['intrusion', 'detection', 'sensor', 'alarm', 'motion'],
        'LIGHTING': ['lighting', 'illumination', 'light', 'fixture'],
        'COMMS': ['communication', 'radio', 'phone', 'intercom', 'notification'],
        'SCREENING': ['screening', 'inspection', 'x-ray', 'metal detector', 'bag check'],
        'TRAINING': ['training', 'education', 'awareness', 'drill', 'exercise'],
        'COORDINATION': ['coordination', 'liaison', 'partnership', 'collaboration'],
        'RESPONSE': ['response', 'emergency', 'evacuation', 'incident'],
    }
    
    scores = {}
    for discipline, keywords in discipline_keywords.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[discipline] = score
    
    if scores:
        return max(scores.items(), key=lambda x: x[1])[0]
    
    return 'UNKNOWN'

def calculate_match_score(snippet_keywords: set, question_keywords: set, question_text: str = '') -> float:
    """Calculate match score between snippet and question."""
    if not question_keywords:
        return 0.0
    
    # Base Jaccard similarity
    intersection = snippet_keywords & question_keywords
    union = snippet_keywords | question_keywords
    
    if not union:
        return 0.0
    
    jaccard = len(intersection) / len(union)
    
    # Boost for strong keyword overlap
    if len(intersection) >= 3:
        jaccard *= 1.2
    
    return min(jaccard, 1.0)

def find_top_questions(candidate_text: str, question_index: Dict, top_k: int = 3) -> List[Dict]:
    """Find top K nearest questions even if below threshold."""
    snippet_keywords = extract_keywords(candidate_text)
    matches = []
    
    # Match BASE questions
    for q in question_index.get('base_questions', []):
        question_text = q.get('question_text', '')
        question_keywords = set(q.get('keywords', []))
        
        score = calculate_match_score(snippet_keywords, question_keywords, question_text)
        
        matches.append({
            'target_type': 'BASE_PRIMARY',
            'target_key': q['target_key'],
            'question_text': question_text,
            'score': score
        })
    
    # Match EXPANSION questions
    for q in question_index.get('expansion_questions', []):
        question_text = q.get('question_text', '')
        question_keywords = set(q.get('keywords', []))
        
        score = calculate_match_score(snippet_keywords, question_keywords, question_text)
        
        matches.append({
            'target_type': 'EXPANSION_QUESTION',
            'target_key': q['target_key'],
            'question_text': question_text,
            'score': score
        })
    
    # Sort by score descending and return top K
    matches.sort(key=lambda x: x['score'], reverse=True)
    
    return matches[:top_k]

def load_question_index(index_path: str) -> Dict:
    """Load question matcher index."""
    if not os.path.exists(index_path):
        return {'base_questions': [], 'expansion_questions': []}
    
    with open(index_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_detailed_report(document_id: str) -> Dict:
    """Generate detailed match + non-match report."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get document info
        cur.execute("""
            SELECT d.document_id, d.title, d.source_id
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        doc_id, title, source_id = doc_row
        
        # Get unmatched candidates (candidates with no target links)
        cur.execute("""
            SELECT 
                ocq.candidate_id,
                ocq.snippet_text,
                ocq.page_locator,
                NULL as page_num
            FROM public.ofc_candidate_queue ocq
            LEFT JOIN public.ofc_candidate_targets oct ON ocq.candidate_id = oct.candidate_id
            WHERE ocq.source_id = %s AND oct.candidate_id IS NULL
            ORDER BY ocq.created_at
        """, (source_id,))
        
        unmatched_candidates = cur.fetchall()
        
        # Load question index
        index_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
        question_index = load_question_index(str(index_path))
        
        # Process unmatched candidates
        candidates_by_discipline = defaultdict(list)
        
        for candidate_id, snippet_text, page_locator, page_num in unmatched_candidates:
            safe_ref = extract_safe_reference(snippet_text)
            discipline = infer_discipline(snippet_text)
            
            # Find top 3 nearest questions
            top_questions = find_top_questions(snippet_text, question_index, top_k=3)
            
            candidate_data = {
                'candidate_id': str(candidate_id),
                'snippet_text': snippet_text[:500],  # First 500 chars
                'safe_reference': safe_ref,
                'page_locator': page_locator,
                'top_3_questions': [
                    {
                        'target_key': q['target_key'],
                        'question_text': q['question_text'][:200],  # First 200 chars
                        'score': round(q['score'], 3)
                    }
                    for q in top_questions
                ]
            }
            
            candidates_by_discipline[discipline].append(candidate_data)
        
        # Get matched candidates for comparison
        cur.execute("""
            SELECT 
                ocq.candidate_id,
                ocq.snippet_text,
                COUNT(oct.target_key) as match_count
            FROM public.ofc_candidate_queue ocq
            JOIN public.ofc_candidate_targets oct ON ocq.candidate_id = oct.candidate_id
            WHERE ocq.source_id = %s
            GROUP BY ocq.candidate_id, ocq.snippet_text
            ORDER BY match_count DESC
        """, (source_id,))
        
        matched_candidates = cur.fetchall()
        
        report = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'document_id': str(doc_id),
            'document_title': title,
            'summary': {
                'total_candidates': len(unmatched_candidates) + len(matched_candidates),
                'matched_count': len(matched_candidates),
                'unmatched_count': len(unmatched_candidates),
                'disciplines_represented': len(candidates_by_discipline)
            },
            'unmatched_candidates_by_discipline': {
                discipline: {
                    'count': len(candidates),
                    'candidates': candidates
                }
                for discipline, candidates in sorted(candidates_by_discipline.items())
            },
            'matched_candidates_summary': [
                {
                    'candidate_id': str(row[0]),
                    'snippet_preview': row[1][:200],
                    'match_count': row[2]
                }
                for row in matched_candidates[:10]  # Top 10
            ]
        }
        
        return report
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate detailed match + non-match report')
    parser.add_argument('--document_id', required=True, help='Document ID (UUID)')
    parser.add_argument('--output', help='Output JSON path (default: analytics/reports/detailed_match_report.json)')
    
    args = parser.parse_args()
    
    try:
        report = generate_detailed_report(args.document_id)
        
        # Determine output path
        if args.output:
            output_path = Path(args.output)
        else:
            project_root = Path(__file__).parent.parent
            output_dir = project_root / 'analytics' / 'reports'
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / 'detailed_match_report.json'
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"Detailed report written to: {output_path}")
        print(f"\nSummary:")
        print(f"  Total candidates: {report['summary']['total_candidates']}")
        print(f"  Matched: {report['summary']['matched_count']}")
        print(f"  Unmatched: {report['summary']['unmatched_count']}")
        print(f"  Disciplines: {report['summary']['disciplines_represented']}")
        print(f"\nUnmatched by discipline:")
        for discipline, data in report['unmatched_candidates_by_discipline'].items():
            print(f"  {discipline}: {data['count']} candidates")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

