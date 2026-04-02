#!/usr/bin/env python3
"""
CORPUS OFC Candidate Extraction

Extracts recommendation sentences from document chunks and inserts into ofc_candidate_queue.

Uses deterministic "recommendation sentence detector" patterns:
- Imperative verbs (should, must, recommend, consider, implement, etc.)
- Prescriptive language patterns
- Action-oriented phrases

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import hashlib
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

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

def sha256_hash(text: str) -> str:
    """Calculate SHA256 hash of text."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def is_recommendation_sentence(text: str) -> bool:
    """
    Deterministic recommendation sentence detector.
    
    Looks for:
    - Imperative verbs (should, must, recommend, consider, implement, etc.)
    - Prescriptive language patterns
    - Action-oriented phrases
    """
    text_lower = text.lower().strip()
    
    # Skip very short sentences
    if len(text_lower) < 30:
        return False
    
    # Skip questions
    if text_lower.strip().endswith('?'):
        return False
    
    # Imperative verb patterns (at start of sentence or after comma)
    imperative_patterns = [
        r'^(should|must|shall|recommend|consider|implement|establish|develop|create|install|deploy|configure|enable|ensure|provide|maintain|monitor|review|test|verify|validate|document|train|educate)',
        r'[.,;]\s+(should|must|shall|recommend|consider|implement|establish|develop|create|install|deploy|configure|enable|ensure|provide|maintain|monitor|review|test|verify|validate|document|train|educate)',
        r'^(it is (recommended|suggested|advisable|essential|critical|important|necessary))',
        r'^(organizations? (should|must|shall))',
        r'^(facilities? (should|must|shall))',
        r'^(systems? (should|must|shall))',
    ]
    
    for pattern in imperative_patterns:
        if re.search(pattern, text_lower):
            return True
    
    # Prescriptive phrases
    prescriptive_phrases = [
        'best practice',
        'recommended practice',
        'should be',
        'must be',
        'shall be',
        'is recommended',
        'is suggested',
        'is advisable',
        'is essential',
        'is critical',
        'is important',
        'is necessary',
        'consider implementing',
        'consider using',
        'consider deploying',
        'it is recommended that',
        'it is suggested that',
        'it is advisable to',
    ]
    
    for phrase in prescriptive_phrases:
        if phrase in text_lower:
            return True
    
    return False

def extract_sentences(text: str) -> List[str]:
    """Extract sentences from text."""
    # Split on sentence boundaries
    sentences = re.split(r'[.!?]+\s+', text)
    
    # Clean and filter
    cleaned = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) > 20:  # Minimum sentence length
            cleaned.append(sent)
    
    return cleaned

def extract_candidates_from_chunk(chunk_text: str, page_number: Optional[int] = None) -> List[Dict]:
    """Extract recommendation candidates from a chunk."""
    candidates = []
    sentences = extract_sentences(chunk_text)
    
    for sentence in sentences:
        if is_recommendation_sentence(sentence):
            # Create locator
            locator = f"Page {page_number}" if page_number else "Unknown"
            
            # Create excerpt (sentence + context)
            sentence_idx = chunk_text.find(sentence)
            if sentence_idx > 0:
                # Get 100 chars before and after
                start = max(0, sentence_idx - 100)
                end = min(len(chunk_text), sentence_idx + len(sentence) + 100)
                excerpt = chunk_text[start:end].strip()
            else:
                excerpt = sentence
            
            snippet_hash = sha256_hash(sentence)
            
            candidates.append({
                'snippet_text': sentence,
                'page_locator': locator,
                'excerpt': excerpt,
                'snippet_hash': snippet_hash
            })
    
    return candidates

def extract_candidates_for_document(document_id: str) -> Dict:
    """Extract candidates from all chunks of a document."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get document and source info
        cur.execute("""
            SELECT d.document_id, d.source_id, d.sector, d.subsector
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        doc_id, source_id, sector, subsector = doc_row
        
        # Get all chunks for this document
        cur.execute("""
            SELECT chunk_id, chunk_index, page_number, chunk_text
            FROM public.document_chunks
            WHERE document_id = %s
            ORDER BY chunk_index
        """, (document_id,))
        
        chunks = cur.fetchall()
        
        if not chunks:
            raise ValueError(f'No chunks found for document: {document_id}')
        
        # Extract candidates from each chunk
        all_candidates = []
        for chunk_id, chunk_index, page_number, chunk_text in chunks:
            candidates = extract_candidates_from_chunk(chunk_text, page_number)
            for candidate in candidates:
                candidate['chunk_id'] = chunk_id
                candidate['chunk_index'] = chunk_index
                all_candidates.append(candidate)
        
        # Insert candidates into ofc_candidate_queue
        inserted_count = 0
        for candidate in all_candidates:
            # Check if candidate already exists (by snippet_hash)
            cur.execute("""
                SELECT candidate_id FROM public.ofc_candidate_queue
                WHERE snippet_text = %s
                LIMIT 1
            """, (candidate['snippet_text'],))
            
            if cur.fetchone():
                continue  # Skip duplicates
            
            cur.execute("""
                INSERT INTO public.ofc_candidate_queue
                (source_id, snippet_text, page_locator, excerpt, sector, subsector, status, ofc_origin)
                VALUES (%s, %s, %s, %s, %s, %s, 'PENDING', 'CORPUS')
                RETURNING candidate_id
            """, (
                source_id,
                candidate['snippet_text'],
                candidate['page_locator'],
                candidate['excerpt'],
                sector,
                subsector
            ))
            
            candidate_id = cur.fetchone()[0]
            candidate['candidate_id'] = str(candidate_id)
            inserted_count += 1
        
        conn.commit()
        
        return {
            'document_id': str(document_id),
            'source_id': str(source_id),
            'chunks_processed': len(chunks),
            'candidates_extracted': len(all_candidates),
            'candidates_inserted': inserted_count,
            'candidates_skipped': len(all_candidates) - inserted_count
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python extract_ofc_candidates.py <document_id>")
        print("  document_id: UUID of document in CORPUS database")
        sys.exit(1)
    
    document_id = sys.argv[1]
    
    try:
        result = extract_candidates_for_document(document_id)
        import json
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

