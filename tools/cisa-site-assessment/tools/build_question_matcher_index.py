#!/usr/bin/env python3
"""
Build Question Matcher Index

Creates an index of all current questions (BASE + EXPANSION) for OFC candidate matching.
Outputs: analytics/runtime/question_matcher_index.json
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Set
import re
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
                os.environ[key.strip()] = value.strip()

def get_db_connection():
    """Get database connection from DATABASE_URL."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)

def normalize_text(text: str) -> str:
    """Normalize text for matching."""
    # Lowercase, remove punctuation, normalize whitespace
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_keywords(text: str, synonyms: Dict[str, List[str]] = None) -> Set[str]:
    """Extract keywords from text, including synonyms."""
    normalized = normalize_text(text)
    words = set(normalized.split())
    
    # Add synonyms if available
    if synonyms:
        for word in list(words):
            for key, syn_list in synonyms.items():
                if word in [normalize_text(s) for s in syn_list]:
                    words.add(normalize_text(key))
                    break
    
    return words

def load_alt_safe_questions(alt_safe_path: str) -> List[Dict]:
    """Load BASE primary questions from ALT_SAFE model."""
    with open(alt_safe_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    questions = []
    for section in data.get('sections', []):
        section_title = section.get('section_title', '')
        for item in section.get('question_items', []):
            question_key = item.get('question_key')
            question_text = item.get('question_text', '')
            
            # Use question_text if valid, else fallback to section_title
            if not question_text or question_text.lower() in ['yes', 'no', 'n/a', 'n_a', 'na']:
                question_text = section_title if section_title else ''
            
            # Only include if we have a valid question_key and usable text
            if question_key and question_text and len(question_text.strip()) >= 6:
                questions.append({
                    'target_type': 'BASE_PRIMARY',
                    'target_key': question_key,
                    'question_text': question_text,
                    'section_title': section_title,
                    'keywords': None  # Will be populated after loading synonyms
                })
    
    return questions

def load_expansion_questions(conn) -> List[Dict]:
    """Load EXPANSION questions from database."""
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            eq.question_id::text,
            eq.question_text,
            eq.subtype_code,
            eq.profile_id::text,
            sep.sector,
            sep.subsector
        FROM public.expansion_questions eq
        JOIN public.sector_expansion_profiles sep ON eq.profile_id = sep.profile_id
        WHERE eq.status = 'ACTIVE'
    """)
    
    questions = []
    for row in cur.fetchall():
        questions.append({
            'target_type': 'EXPANSION_QUESTION',
            'target_key': row[0],
            'question_text': row[1],
            'subtype_code': row[2],
            'profile_id': row[3],
            'sector': row[4],
            'subsector': row[5],
            'keywords': None  # Will be populated after loading synonyms
        })
    
    cur.close()
    return questions

def load_synonyms(synonyms_path: str) -> Dict[str, List[str]]:
    """Load question synonyms."""
    if not os.path.exists(synonyms_path):
        return {}
    
    with open(synonyms_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data.get('synonyms', {})

def build_index(
    base_questions: List[Dict],
    expansion_questions: List[Dict],
    synonyms: Dict[str, List[str]]
) -> Dict:
    """Build the question matcher index."""
    index = {
        'metadata': {
            'version': '1.0',
            'base_question_count': len(base_questions),
            'expansion_question_count': len(expansion_questions),
            'total_questions': len(base_questions) + len(expansion_questions)
        },
        'base_questions': [],
        'expansion_questions': []
    }
    
    # Process BASE questions
    for q in base_questions:
        keywords = extract_keywords(q['question_text'], synonyms)
        index['base_questions'].append({
            'target_key': q['target_key'],
            'question_text': q['question_text'],
            'section_title': q.get('section_title', ''),
            'keywords': sorted(list(keywords))
        })
    
    # Process EXPANSION questions
    for q in expansion_questions:
        keywords = extract_keywords(q['question_text'], synonyms)
        index['expansion_questions'].append({
            'target_key': q['target_key'],
            'question_text': q['question_text'],
            'subtype_code': q.get('subtype_code'),
            'profile_id': q.get('profile_id'),
            'sector': q.get('sector'),
            'subsector': q.get('subsector'),
            'keywords': sorted(list(keywords))
        })
    
    return index

def main():
    import argparse
    from datetime import datetime
    
    parser = argparse.ArgumentParser(description='Build question matcher index')
    parser.add_argument('--alt_safe', help='Path to alt_safe_model_extracted.json', 
                       default=None)
    parser.add_argument('--output', help='Output path for index JSON', default=None)
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    
    # Paths
    if args.alt_safe:
        alt_safe_path = Path(args.alt_safe)
    else:
        alt_safe_path = project_root / 'analytics' / 'runtime' / 'alt_safe_model_extracted.json'
    
    synonyms_path = project_root / 'analytics' / 'runtime' / 'question_synonyms.json'
    
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = project_root / 'analytics' / 'runtime' / 'question_matcher_index.json'
    
    if not alt_safe_path.exists():
        print(f"Error: ALT_SAFE model not found: {alt_safe_path}")
        sys.exit(1)
    
    print("Loading BASE questions from ALT_SAFE model...")
    base_questions = load_alt_safe_questions(str(alt_safe_path))
    print(f"✓ Loaded {len(base_questions)} BASE primary questions")
    
    print("Loading EXPANSION questions from database...")
    conn = get_db_connection()
    expansion_questions = load_expansion_questions(conn)
    conn.close()
    print(f"✓ Loaded {len(expansion_questions)} EXPANSION questions")
    
    print("Loading synonyms...")
    synonyms = load_synonyms(str(synonyms_path))
    print(f"✓ Loaded synonyms for {len(synonyms)} keys")
    
    print("\nBuilding index...")
    index = build_index(base_questions, expansion_questions, synonyms)
    
    # HARD FAIL if BASE != 36
    base_count = index['metadata']['base_question_count']
    if base_count != 36:
        print(f"\n❌ ERROR: BASE question count is {base_count}, expected 36")
        print("   Index build failed. Fix ALT_SAFE extraction before proceeding.")
        sys.exit(1)
    
    # Save index
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    
    # Write build report
    report_path = project_root / 'analytics' / 'reports' / 'question_matcher_index_build_report.json'
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    report = {
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'base_question_count': base_count,
        'expansion_question_count': index['metadata']['expansion_question_count'],
        'total_questions': index['metadata']['total_questions'],
        'base_count_valid': base_count == 36,
        'index_path': str(output_path),
        'alt_safe_source': str(alt_safe_path)
    }
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Index saved: {output_path}")
    print(f"✓ Build report saved: {report_path}")
    print(f"\nSummary:")
    print(f"  BASE questions: {base_count} ✅")
    print(f"  EXPANSION questions: {index['metadata']['expansion_question_count']}")
    print(f"  Total: {index['metadata']['total_questions']}")
    print("\n✅ Index build complete!")

if __name__ == '__main__':
    main()

