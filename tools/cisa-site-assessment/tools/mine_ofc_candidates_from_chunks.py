#!/usr/bin/env python3
"""
CORPUS OFC Candidate Mining Script

Mines OFC candidates from document chunks using heuristic patterns.
Discovery only - no generation, no auto-promotion.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import hashlib
import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional

import psycopg2
from urllib.parse import urlparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection as get_conn,
    require_active_source_set
)

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

# Use source_set module's connection function
get_corpus_db_connection = get_conn

def sha256_hash(text: str) -> str:
    """Calculate SHA256 hash of text."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def normalize_candidate_text(text: str) -> str:
    """Normalize candidate text for deduplication."""
    # Remove extra whitespace, lowercase
    text = re.sub(r'\s+', ' ', text)
    text = text.strip().lower()
    return text

def is_actionable_security_guidance(text: str) -> bool:
    """
    Heuristic detector for actionable security guidance.
    
    Looks for:
    - Bulleted lists
    - Sentences beginning with action verbs
    - Prescriptive phrases
    - Action-oriented language
    """
    text_lower = text.lower().strip()
    
    # Skip very short text
    if len(text_lower) < 30:
        return False
    
    # Skip questions
    if text_lower.strip().endswith('?'):
        return False
    
    # Action verbs at sentence start
    action_verbs = [
        'establish', 'coordinate', 'train', 'implement', 'restrict', 
        'monitor', 'protect', 'develop', 'create', 'install', 'deploy',
        'configure', 'enable', 'ensure', 'provide', 'maintain', 'review',
        'test', 'verify', 'validate', 'document', 'educate', 'conduct',
        'assess', 'evaluate', 'identify', 'analyze', 'design', 'plan'
    ]
    
    # Check for action verb patterns
    for verb in action_verbs:
        # At start of sentence
        if re.match(rf'^{verb}\s+', text_lower):
            return True
        # After bullet or number
        if re.search(rf'[•\-\d+\.]\s+{verb}\s+', text_lower):
            return True
    
    # Prescriptive phrases
    prescriptive_patterns = [
        r'consider the following',
        r'recommended actions?',
        r'protective measures?',
        r'encouraged to',
        r'should consider',
        r'should implement',
        r'should establish',
        r'must (establish|implement|ensure|provide)',
        r'organizations? should',
        r'facilities? should',
        r'systems? should',
        r'best practice',
        r'recommended practice'
    ]
    
    for pattern in prescriptive_patterns:
        if re.search(pattern, text_lower):
            return True
    
    # Bulleted list indicators
    if re.search(r'^[•\-\*]\s+', text_lower, re.MULTILINE):
        return True
    
    return False

def exclude_non_actionable(text: str) -> bool:
    """
    Exclude non-actionable text:
    - Descriptive-only narrative
    - Cyber or regulatory language
    - Non-actionable background text
    """
    text_lower = text.lower()
    
    # Cyber language (exclude)
    cyber_keywords = [
        'cyber', 'malware', 'ransomware', 'phishing', 'firewall',
        'encryption', 'ssl', 'tls', 'certificate', 'vulnerability scan',
        'penetration test', 'network security', 'intrusion detection'
    ]
    
    if any(keyword in text_lower for keyword in cyber_keywords):
        return True
    
    # Regulatory language (exclude)
    regulatory_keywords = [
        'compliance', 'regulation', 'regulatory', 'audit', 'inspection',
        'violation', 'penalty', 'fine', 'license', 'permit'
    ]
    
    if any(keyword in text_lower for keyword in regulatory_keywords):
        return True
    
    # Descriptive-only patterns (exclude)
    descriptive_patterns = [
        r'^this (document|guide|report)',
        r'^the purpose of',
        r'^introduction',
        r'^background',
        r'^overview',
        r'^summary'
    ]
    
    for pattern in descriptive_patterns:
        if re.match(pattern, text_lower):
            return True
    
    return False

def extract_candidates_from_chunk(chunk_text: str, page_num: Optional[int] = None) -> List[Dict]:
    """Extract OFC candidates from a chunk."""
    # OFC_MINER_V2: Try v2 extractor first, fallback to original logic
    try:
        from tools.corpus.ofc_extractor_v2 import extract_ofc_snippets
        snippets = extract_ofc_snippets(chunk_text, max_len=500)
        if snippets:
            return [{'candidate_text': s, 'page_num': page_num} for s in snippets]
    except ImportError:
        pass  # Fallback to original logic
    
    # Original extraction logic (fallback)
    candidates = []
    
    # Split into sentences
    sentences = re.split(r'[.!?]+\s+', chunk_text)
    
    # Also check for bulleted items
    bullet_items = re.split(r'[•\-\*]\s+', chunk_text)
    
    all_items = sentences + bullet_items
    
    for item in all_items:
        item = item.strip()
        
        # Skip if too short
        if len(item) < 30:
            continue
        
        # Limit to 500 chars
        if len(item) > 500:
            item = item[:500].rsplit(' ', 1)[0] + '...'
        
        # Check if actionable
        if not is_actionable_security_guidance(item):
            continue
        
        # Check if should be excluded
        if exclude_non_actionable(item):
            continue
        
        candidates.append({
            'candidate_text': item,
            'page_num': page_num
        })
    
    return candidates

def mine_candidates(
    document_id: str,
    authority_scope: str,
    max_candidates: int = 250
) -> Dict:
    """Mine OFC candidates from document chunks."""
    conn = get_corpus_db_connection()
    
    # Enforce active source set
    active_source_set = require_active_source_set(conn)
    print(f"[Source Set] Active: {active_source_set}")
    
    cur = conn.cursor()
    
    try:
        # Get document and source info
        cur.execute("""
            SELECT d.document_id, d.source_id, d.title, d.source_set
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        doc_id, source_id, doc_title, doc_source_set = doc_row
        
        # Warn if document source_set doesn't match active
        if doc_source_set != active_source_set:
            print(
                f"⚠️  Warning: Document source_set '{doc_source_set}' != active '{active_source_set}'",
                file=sys.stderr
            )
        
        # Clear old candidates for this document in active source_set (safe re-mining)
        cur.execute("""
            DELETE FROM public.ofc_candidate_queue
            WHERE document_id = %s
                AND source_set = %s
        """, (doc_id, active_source_set))
        
        deleted_count = cur.rowcount
        if deleted_count > 0:
            print(f"Cleared {deleted_count} previous candidates for this document")
        
        # Get all chunks for this document (filtered by active source_set)
        # Include locator_type, locator, and section_heading for direct copying
        cur.execute("""
            SELECT dc.chunk_id, dc.chunk_index, dc.page_number, dc.chunk_text, dc.source_set,
                   dc.locator_type, dc.locator, dc.section_heading
            FROM public.document_chunks dc
            WHERE dc.document_id = %s
                AND dc.source_set = %s
            ORDER BY dc.chunk_index
        """, (document_id, active_source_set))
        
        chunks = cur.fetchall()
        
        # Check for UNSPECIFIED chunks (should not process)
        unspecified_chunks = [c for c in chunks if len(c) > 4 and c[4] == 'UNSPECIFIED']
        if unspecified_chunks:
            print(
                f"⚠️  Warning: Found {len(unspecified_chunks)} chunks with source_set='UNSPECIFIED'. Skipping.",
                file=sys.stderr
            )
            chunks = [c for c in chunks if len(c) <= 4 or c[4] != 'UNSPECIFIED']
        
        if not chunks:
            raise ValueError(
                f'No chunks found for document: {document_id} '
                f'with source_set={active_source_set}'
            )
        
        # Extract candidates from each chunk
        all_candidates = []
        for chunk_row in chunks:
            chunk_id = chunk_row[0]
            chunk_index = chunk_row[1]
            page_number = chunk_row[2] if len(chunk_row) > 2 else None
            chunk_text = chunk_row[3] if len(chunk_row) > 3 else chunk_row[2]  # Handle different row structures
            chunk_source_set = chunk_row[4] if len(chunk_row) > 4 else active_source_set
            chunk_locator_type = chunk_row[5] if len(chunk_row) > 5 else None
            chunk_locator = chunk_row[6] if len(chunk_row) > 6 else None
            chunk_section_heading = chunk_row[7] if len(chunk_row) > 7 else None
            
            # HARD ASSERTION: VOFC_LIBRARY chunks must have XLSX locator_type and proper locator
            if chunk_source_set == 'VOFC_LIBRARY':
                if chunk_locator_type != 'XLSX':
                    raise RuntimeError(
                        f'VOFC_LIBRARY chunk {chunk_id} has locator_type={chunk_locator_type}, expected XLSX'
                    )
                if not chunk_locator or 'sheet=' not in chunk_locator or 'row=' not in chunk_locator:
                    raise RuntimeError(
                        f'VOFC_LIBRARY chunk {chunk_id} has invalid locator="{chunk_locator}", '
                        f'expected format "sheet=<name>;row=<number>"'
                    )
            
            # For XLSX chunks (format: "Category: ...\nVulnerability: ...\nOFC: ...")
            if 'OFC:' in chunk_text and active_source_set == 'VOFC_LIBRARY':
                # XLSX format: Use the full chunk text as candidate (Category + Vulnerability + OFC)
                # The OFC number is a reference; the actual recommendation is in Vulnerability
                if len(chunk_text) > 50:  # Valid candidate (has substantial content)
                    # Copy locator directly from chunk (no parsing/reconstruction)
                    all_candidates.append({
                        'candidate_text': chunk_text[:500],  # Limit to 500 chars
                        'page_num': None,  # XLSX doesn't have pages
                        'chunk_id': chunk_id,
                        'chunk_index': chunk_index,
                        'locator': chunk_locator,  # Copy verbatim from chunk
                        'locator_type': chunk_locator_type,  # Copy verbatim from chunk
                        'field_name': 'OFC'
                    })
            else:
                # PDF format: use existing extraction
                candidates = extract_candidates_from_chunk(chunk_text, page_number)
                for candidate in candidates:
                    candidate['chunk_id'] = chunk_id
                    candidate['chunk_index'] = chunk_index
                    # Copy locator from chunk if available, otherwise construct from page_number
                    candidate['locator'] = chunk_locator or (f"Page {page_number}" if page_number else "Unknown")
                    candidate['locator_type'] = chunk_locator_type or 'PDF'
                    candidate['section_heading'] = chunk_section_heading  # Copy section heading
                    all_candidates.append(candidate)
        
        # Limit to max_candidates
        if len(all_candidates) > max_candidates:
            all_candidates = all_candidates[:max_candidates]
        
        # Insert candidates into ofc_candidate_queue (locator-aware uniqueness)
        inserted_count = 0
        skipped_count = 0
        
        for candidate in all_candidates:
            candidate_text = candidate['candidate_text']
            normalized = normalize_candidate_text(candidate_text)
            candidate_hash = sha256_hash(normalized)
            
            # Get locator info (copied directly from chunk, no fallback construction)
            locator = candidate.get('locator')
            locator_type = candidate.get('locator_type')
            field_name = candidate.get('field_name', 'OFC')
            section_heading = candidate.get('section_heading')
            
            # HARD ASSERTION: locator and locator_type must be present (copied from chunk)
            if not locator or not locator_type:
                raise RuntimeError(
                    f'Candidate from chunk {candidate.get("chunk_id")} missing locator or locator_type. '
                    f'This should have been copied from the chunk record.'
                )
            
            # Create excerpt (candidate text with context)
            excerpt = candidate_text[:200] + '...' if len(candidate_text) > 200 else candidate_text
            
            # Insert candidate with locator-aware uniqueness including candidate_hash
            # This allows multiple distinct OFCs on the same page
            # CRITICAL: Force ofc_origin='CORPUS' for all CORPUS mining operations
            # On conflict, preserve existing MODULE rows (defensive: shouldn't happen but be safe)
            cur.execute("""
                INSERT INTO public.ofc_candidate_queue
                (source_id, document_id, snippet_text, locator, excerpt, status, source_set, 
                 locator_type, field_name, candidate_hash, section_heading, ofc_origin)
                VALUES (%s, %s, %s, %s, %s, 'PENDING', %s, %s, %s, %s, %s, 'CORPUS')
                ON CONFLICT (source_set, document_id, locator_type, locator, field_name, candidate_hash)
                DO UPDATE SET
                    snippet_text = EXCLUDED.snippet_text,
                    excerpt = EXCLUDED.excerpt,
                    section_heading = EXCLUDED.section_heading,
                    ofc_origin = COALESCE(ofc_candidate_queue.ofc_origin, EXCLUDED.ofc_origin)
                RETURNING candidate_id
            """, (
                source_id,
                doc_id,  # document_id
                candidate_text,  # Store full text (≤500 chars)
                locator,
                excerpt,
                active_source_set,
                locator_type,
                field_name,
                candidate_hash,
                section_heading
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
            'candidates_skipped': skipped_count,
            'authority_scope': authority_scope,
            'active_source_set': active_source_set
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description='Mine OFC candidates from document chunks')
    parser.add_argument('--document_id', required=True, help='Document ID (UUID)')
    parser.add_argument('--authority_scope', required=True, help='Authority scope (e.g., BASELINE_AUTHORITY)')
    parser.add_argument('--max_candidates', type=int, default=250, help='Maximum candidates to extract (default: 250)')
    
    args = parser.parse_args()
    
    try:
        result = mine_candidates(
            document_id=args.document_id,
            authority_scope=args.authority_scope,
            max_candidates=args.max_candidates
        )
        
        import json
        print(json.dumps(result, indent=2))
        
        print(f"\n✅ Candidates mined: {result['candidates_inserted']} inserted, {result['candidates_skipped']} skipped")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

