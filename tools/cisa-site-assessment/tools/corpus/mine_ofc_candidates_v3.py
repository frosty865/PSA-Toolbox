#!/usr/bin/env python3
"""
OFC Candidate Miner V3

Mines capability-level OFC candidates from CORPUS documents using locked doctrine:
- OFCs are capability-level solution patterns
- OFCs attach only to NO answers
- Documents/chunks are EVIDENCE only
- Candidates must be authored patterns, not scraped sentences
- PSA scope only (physical security, governance, planning, operations)
- NO cyber/data/IT/CSA/regulatory language
- Hard separation: CORPUS only, never module tables

Usage:
    python tools/corpus/mine_ofc_candidates_v3.py --limit_subtypes 25 --max_per_subtype 30 --dry_run
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict
import hashlib

import psycopg2
from urllib.parse import urlparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from validators.ofc_candidate_validator import validate_candidate

def get_runtime_db_connection():
    """Get RUNTIME database connection."""
    load_env_file('.env.local')
    
    runtime_url = os.getenv('RUNTIME_DATABASE_URL') or os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_SERVICE_ROLE_KEY')
    
    if not runtime_url or not runtime_password:
        raise ValueError('RUNTIME_DATABASE_URL and SUPABASE_RUNTIME_DB_PASSWORD must be set')
    
    clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
    
    # Parse URL
    if runtime_url.startswith('postgresql://'):
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0] if 'supabase.co' in url.hostname else url.hostname
        connection_string = runtime_url.replace('postgresql://', f'postgresql://postgres:{clean_password}@')
    else:
        # Supabase URL format
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('CORPUS_DATABASE_URL') or os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD') or os.getenv('SUPABASE_CORPUS_SERVICE_ROLE_KEY')
    
    if not corpus_url or not corpus_password:
        raise ValueError('CORPUS_DATABASE_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
    
    if corpus_url.startswith('postgresql://'):
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0] if 'supabase.co' in url.hostname else url.hostname
        connection_string = corpus_url.replace('postgresql://', f'postgresql://postgres:{clean_password}@')
    else:
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise

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

# Problem signal phrases (conditions/failures) - deterministic heuristics
PROBLEM_SIGNALS = [
    'lack of', 'lacks', 'missing', 'absent', 'insufficient', 'inadequate',
    'failure to', 'failures', 'deficiency', 'deficiencies', 'gap', 'gaps',
    'weakness', 'weaknesses', 'vulnerability', 'vulnerabilities',
    'limited', 'restricted', 'poor', 'incomplete', 'unavailable'
]

# Capability state anchors (what exists)
CAPABILITY_ANCHORS = [
    'is implemented', 'are implemented', 'is established', 'are established',
    'is provided', 'are provided', 'is maintained', 'are maintained',
    'is in place', 'are in place', 'exists', 'are available', 'is available',
    'capability', 'capabilities', 'system', 'systems', 'process', 'processes'
]

def normalize_text(text: str) -> str:
    """Normalize text for deduplication."""
    # Lowercase, remove punctuation, collapse spaces
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_problem_signals(chunk_text: str) -> List[str]:
    """Extract problem signal phrases from chunk text."""
    chunk_lower = chunk_text.lower()
    found_signals = []
    
    for signal in PROBLEM_SIGNALS:
        if signal in chunk_lower:
            found_signals.append(signal)
    
    return found_signals

def author_ofc_candidate(chunk_text: str, subtype_info: Dict) -> Optional[str]:
    """
    Author an OFC candidate from chunk text.
    
    This is a simplified authoring step. In production, this could use
    Ollama/LLM with strict constraints, but for now uses deterministic
    pattern extraction and rewriting.
    """
    # Extract sentences with capability anchors
    sentences = re.split(r'[.!?]+', chunk_text)
    capability_sentences = []
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        
        # Check for capability indicators
        has_capability = any(anchor in sentence.lower() for anchor in CAPABILITY_ANCHORS)
        has_problem = any(signal in sentence.lower() for signal in PROBLEM_SIGNALS)
        
        # Prefer sentences with capability indicators, avoid problem-only sentences
        if has_capability and not has_problem:
            capability_sentences.append(sentence)
    
    if not capability_sentences:
        return None
    
    # Take first capability sentence and normalize
    candidate_text = capability_sentences[0].strip()
    
    # Remove leading bullets/dashes
    candidate_text = re.sub(r'^[•\-\–\—\▪\*]\s+', '', candidate_text)
    
    # Ensure it's a complete sentence
    if not candidate_text.endswith(('.', '!', '?')):
        candidate_text += '.'
    
    # Basic validation: must be 12-40 words
    word_count = len(re.findall(r'\b\w+\b', candidate_text))
    if word_count < 12 or word_count > 40:
        return None
    
    return candidate_text

def get_subtype_keywords(subtype_info: Dict) -> List[str]:
    """Extract keywords from subtype taxonomy for chunk matching."""
    keywords = []
    
    # From subtype name
    if subtype_info.get('subtype_name'):
        name_words = re.findall(r'\b\w+\b', subtype_info['subtype_name'].lower())
        keywords.extend([w for w in name_words if len(w) > 3])
    
    # From subtype code (split on underscores)
    if subtype_info.get('subtype_code'):
        code_words = subtype_info['subtype_code'].lower().split('_')
        keywords.extend([w for w in code_words if len(w) > 3])
    
    # From overview (if available in runtime DB)
    # Note: This would require fetching from runtime DB, simplified here
    
    return list(set(keywords))

def find_relevant_chunks(
    corpus_cur,
    subtype_info: Dict,
    max_chunks: int = 50
) -> List[Dict]:
    """Find relevant document chunks for a subtype."""
    keywords = get_subtype_keywords(subtype_info)
    
    if not keywords:
        return []
    
    # Build keyword search query
    keyword_patterns = '|'.join(keywords)
    
    query = """
        SELECT 
            dc.chunk_id,
            dc.document_id,
            dc.chunk_index,
            dc.page_number,
            dc.chunk_text,
            dc.section_heading,
            d.source_id,
            d.title as document_title
        FROM public.document_chunks dc
        JOIN public.documents d ON dc.document_id = d.document_id
        WHERE dc.chunk_text ~* %s
            AND LENGTH(dc.chunk_text) BETWEEN 100 AND 5000
        ORDER BY dc.document_id, dc.chunk_index
        LIMIT %s
    """
    
    corpus_cur.execute(query, (keyword_patterns, max_chunks))
    
    chunks = []
    for row in corpus_cur.fetchall():
        chunks.append({
            'chunk_id': str(row[0]),
            'document_id': str(row[1]),
            'chunk_index': row[2],
            'page_number': row[3],
            'chunk_text': row[4],
            'section_heading': row[5],
            'source_id': str(row[6]),
            'document_title': row[7]
        })
    
    return chunks

def deduplicate_candidates(
    new_candidates: List[Dict],
    existing_candidates: List[Dict],
    similarity_threshold: float = 0.92
) -> Tuple[List[Dict], List[Dict]]:
    """
    Deduplicate candidates against existing ones.
    
    Returns: (accepted, rejected)
    """
    # Normalize existing candidates
    existing_normalized = {}
    for cand in existing_candidates:
        normalized = normalize_text(cand.get('snippet_text', ''))
        existing_normalized[normalized] = cand
    
    accepted = []
    rejected = []
    
    for new_cand in new_candidates:
        new_text = new_cand.get('snippet_text', '')
        new_normalized = normalize_text(new_text)
        
        # Check exact match
        if new_normalized in existing_normalized:
            rejected.append({
                **new_cand,
                'reject_reason': 'exact_duplicate',
                'existing_candidate_id': existing_normalized[new_normalized].get('candidate_id')
            })
            continue
        
        # Check near-duplicate using simple word overlap (simplified cosine similarity)
        # In production, use proper TF-IDF + cosine similarity
        new_words = set(new_normalized.split())
        is_duplicate = False
        
        for existing_normalized_text, existing_cand in existing_normalized.items():
            existing_words = set(existing_normalized_text.split())
            
            if len(new_words) == 0 or len(existing_words) == 0:
                continue
            
            # Simple Jaccard similarity
            intersection = len(new_words & existing_words)
            union = len(new_words | existing_words)
            similarity = intersection / union if union > 0 else 0
            
            if similarity >= similarity_threshold:
                rejected.append({
                    **new_cand,
                    'reject_reason': 'near_duplicate',
                    'similarity': similarity,
                    'existing_candidate_id': existing_normalized[existing_normalized_text].get('candidate_id')
                })
                is_duplicate = True
                break
        
        if not is_duplicate:
            accepted.append(new_cand)
    
    return accepted, rejected

def main():
    parser = argparse.ArgumentParser(description='Mine OFC candidates from CORPUS (V3)')
    parser.add_argument('--limit_subtypes', type=int, default=25, help='Limit subtypes to mine')
    parser.add_argument('--max_per_subtype', type=int, default=30, help='Max candidates per subtype')
    parser.add_argument('--min_confidence', type=float, default=0.75, help='Min confidence for subtype binding')
    parser.add_argument('--dry_run', action='store_true', help='Dry run (no database writes)')
    parser.add_argument('--run_id', type=str, default=None, help='Run ID (default: timestamp)')
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("[DRY RUN] No database writes will be performed")
    
    # Generate run ID
    run_id = args.run_id or datetime.now().strftime('%Y%m%d_%H%M%S')
    
    print(f"[MINER V3] Starting mining run: {run_id}")
    print(f"[MINER V3] Limit subtypes: {args.limit_subtypes}")
    print(f"[MINER V3] Max per subtype: {args.max_per_subtype}")
    
    # Load coverage report to get under-covered subtypes
    coverage_path = Path('analytics/reports/ofc_candidate_undercovered_subtypes.json')
    if not coverage_path.exists():
        print("[ERROR] Coverage report not found. Run report_ofc_candidate_coverage_by_subtype.py first.")
        sys.exit(1)
    
    with open(coverage_path) as f:
        coverage_data = json.load(f)
    
    subtypes_to_mine = coverage_data['subtypes'][:args.limit_subtypes]
    print(f"[MINER V3] Mining {len(subtypes_to_mine)} subtypes")
    
    # Connect to databases
    runtime_conn = get_runtime_db_connection()
    corpus_conn = get_corpus_db_connection()
    
    runtime_cur = runtime_conn.cursor()
    corpus_cur = corpus_conn.cursor()
    
    # Load existing corpus candidates for deduplication
    print("[MINER V3] Loading existing corpus candidates...")
    corpus_cur.execute("""
        SELECT candidate_id, snippet_text, discipline_subtype_id
        FROM public.ofc_candidate_queue
        WHERE ofc_origin = 'CORPUS'
    """)
    
    existing_candidates = []
    for row in corpus_cur.fetchall():
        existing_candidates.append({
            'candidate_id': str(row[0]),
            'snippet_text': row[1],
            'discipline_subtype_id': str(row[2]) if row[2] else None
        })
    
    print(f"[MINER V3] Found {len(existing_candidates)} existing corpus candidates")
    
    # Mine candidates
    all_new_candidates = []
    all_rejected = []
    
    for subtype_info in subtypes_to_mine:
        subtype_id = subtype_info['subtype_id']
        subtype_code = subtype_info['subtype_code']
        subtype_name = subtype_info['subtype_name']
        
        print(f"\n[MINER V3] Processing subtype: {subtype_code} ({subtype_name})")
        
        # Find relevant chunks
        chunks = find_relevant_chunks(corpus_cur, subtype_info, max_chunks=100)
        print(f"  Found {len(chunks)} relevant chunks")
        
        if not chunks:
            continue
        
        # Mine candidates from chunks
        subtype_candidates = []
        for chunk in chunks[:args.max_per_subtype * 2]:  # Process more, filter later
            candidate_text = author_ofc_candidate(chunk['chunk_text'], subtype_info)
            
            if not candidate_text:
                continue
            
            # Validate candidate
            validation = validate_candidate(candidate_text, subtype_id)
            
            if not validation['ok']:
                all_rejected.append({
                    'subtype_id': subtype_id,
                    'subtype_code': subtype_code,
                    'candidate_text': candidate_text,
                    'reject_reason': 'validation_failed',
                    'validation_reasons': validation['reasons'],
                    'chunk_id': chunk['chunk_id'],
                    'document_id': chunk['document_id']
                })
                continue
            
            # Create candidate record
            candidate = {
                'snippet_text': candidate_text,
                'discipline_subtype_id': subtype_id,
                'source_id': chunk['source_id'],
                'document_id': chunk['document_id'],
                'chunk_id': chunk['chunk_id'],
                'page_number': chunk.get('page_number'),
                'section_heading': chunk.get('section_heading'),
                'document_title': chunk.get('document_title'),
                'subtype_code': subtype_code,
                'subtype_name': subtype_name
            }
            
            subtype_candidates.append(candidate)
        
        # Deduplicate against existing
        accepted, rejected = deduplicate_candidates(subtype_candidates, existing_candidates)
        
        # Limit to max_per_subtype
        accepted = accepted[:args.max_per_subtype]
        
        print(f"  Generated {len(subtype_candidates)} candidates")
        print(f"  Accepted {len(accepted)} (after dedup)")
        print(f"  Rejected {len(rejected)} (duplicates)")
        
        all_new_candidates.extend(accepted)
        all_rejected.extend(rejected)
    
    # Insert accepted candidates (if not dry run)
    if not args.dry_run:
        print(f"\n[MINER V3] Inserting {len(all_new_candidates)} candidates...")
        
        for cand in all_new_candidates:
            corpus_cur.execute("""
                INSERT INTO public.ofc_candidate_queue (
                    snippet_text,
                    source_id,
                    discipline_subtype_id,
                    status,
                    ofc_origin,
                    document_chunk_id,
                    page_locator,
                    section_heading,
                    created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING candidate_id
            """, (
                cand['snippet_text'],
                cand['source_id'],
                cand['discipline_subtype_id'],
                'PENDING',
                'CORPUS',
                cand['chunk_id'],
                f"Page {cand['page_number']}" if cand.get('page_number') else None,
                cand.get('section_heading'),
            ))
            
            cand['candidate_id'] = str(corpus_cur.fetchone()[0])
        
        corpus_conn.commit()
        print("[MINER V3] Insertion complete")
    else:
        print(f"\n[MINER V3] DRY RUN: Would insert {len(all_new_candidates)} candidates")
    
    # Write reports
    reports_dir = Path('analytics/reports')
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    summary = {
        'run_id': run_id,
        'generated_at': datetime.now().isoformat(),
        'total_candidates_generated': len(all_new_candidates) + len(all_rejected),
        'accepted': len(all_new_candidates),
        'rejected': len(all_rejected),
        'subtypes_processed': len(subtypes_to_mine)
    }
    
    summary_path = reports_dir / f'ofc_v3_run_{run_id}_summary.json'
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2)
    print(f"[MINER V3] Wrote summary to {summary_path}")
    
    accepted_path = reports_dir / f'ofc_v3_run_{run_id}_accepted.json'
    with open(accepted_path, 'w') as f:
        json.dump(all_new_candidates, f, indent=2)
    print(f"[MINER V3] Wrote accepted candidates to {accepted_path}")
    
    rejected_path = reports_dir / f'ofc_v3_run_{run_id}_rejected.json'
    with open(rejected_path, 'w') as f:
        json.dump(all_rejected, f, indent=2)
    print(f"[MINER V3] Wrote rejected candidates to {rejected_path}")
    
    # Cleanup
    runtime_cur.close()
    corpus_cur.close()
    runtime_conn.close()
    corpus_conn.close()
    
    print(f"\n[MINER V3] Complete: {len(all_new_candidates)} accepted, {len(all_rejected)} rejected")

if __name__ == '__main__':
    main()
