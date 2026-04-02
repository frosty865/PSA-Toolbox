#!/usr/bin/env python3
"""
CORPUS: Mine Question Candidates from Chunks

Extracts workbook-style question prompts from document chunks.
These are potential expansion questions, NOT baseline questions.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)

STRICT_EXTRACTION_V3: Uses strict question classifier for Phase 1 autoextraction reset.
"""

import os
import sys
import re
import json
import hashlib
from pathlib import Path
from typing import List, Dict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)
from tools.corpus.strict_question_classifier import classify

def normalize_text(text: str) -> str:
    """Normalize text for deduplication."""
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def sha256_hash(text: str) -> str:
    """Calculate SHA256 hash."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def extract_question_candidates(chunk_text: str, page_num: int) -> List[Dict]:
    """
    Extract question-like prompts from chunk text.
    Looks for patterns like:
    - Numbered questions (1., 2., Q1, etc.)
    - Questions ending with "?"
    - Bullet points that look like questions
    """
    candidates = []
    
    # Split into lines
    lines = chunk_text.split('\n')
    
    # Pattern for numbered questions
    numbered_pattern = re.compile(r'^\s*(\d+[\.\)]|Q\d+|Question\s+\d+)\s+(.+)$', re.IGNORECASE)
    
    # Pattern for questions ending with "?"
    question_pattern = re.compile(r'^(.+\?)\s*$')
    
    for line in lines:
        line = line.strip()
        if len(line) < 10:  # Too short
            continue
        
        # Check for numbered question
        match = numbered_pattern.match(line)
        if match:
            question_text = match.group(2).strip()
            if len(question_text) > 10 and '?' in question_text:
                candidates.append({
                    'question_text': question_text,
                    'context': line[:200]
                })
            continue
        
        # Check for standalone question
        match = question_pattern.match(line)
        if match:
            question_text = match.group(1).strip()
            if len(question_text) > 10:
                candidates.append({
                    'question_text': question_text,
                    'context': line[:200]
                })
    
    return candidates

def mine_question_candidates() -> Dict:
    """Mine question candidates from active source set chunks."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        print(f"Active source set: {active_source_set}")
        
        # Get all chunks for active source set
        cur.execute("""
            SELECT 
                dc.chunk_id,
                dc.document_id,
                dc.chunk_text,
                dc.page_number,
                dc.locator,
                d.title as document_title
            FROM public.document_chunks dc
            JOIN public.documents d ON dc.document_id = d.document_id
            WHERE dc.source_set = %s
            ORDER BY d.title, dc.page_number
        """, (active_source_set,))
        
        chunks = cur.fetchall()
        
        if not chunks:
            print(f"⚠️  No chunks found for source_set='{active_source_set}'")
            return {
                'status': 'no_chunks',
                'active_source_set': active_source_set,
                'candidates_extracted': 0,
                'candidates_inserted': 0
            }
        
        print(f"Processing {len(chunks)} chunks...")
        
        # Check if question_candidate_queue table exists (create if needed)
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'question_candidate_queue'
            )
        """)
        
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            # Create table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public.question_candidate_queue (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    source_set TEXT NOT NULL,
                    document_id UUID NOT NULL REFERENCES public.documents(document_id) ON DELETE CASCADE,
                    chunk_id UUID NOT NULL REFERENCES public.document_chunks(chunk_id) ON DELETE CASCADE,
                    question_text TEXT NOT NULL,
                    context TEXT NULL,
                    locator TEXT NULL,
                    question_hash TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE(source_set, question_hash)
                )
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_question_candidate_queue_source_set 
                ON public.question_candidate_queue(source_set, document_id)
            """)
            
            conn.commit()
            print("Created question_candidate_queue table")
        
        # Clear existing candidates for this source_set
        cur.execute("""
            DELETE FROM public.question_candidate_queue
            WHERE source_set = %s
        """, (active_source_set,))
        
        deleted_count = cur.rowcount
        if deleted_count > 0:
            print(f"Cleared {deleted_count} previous question candidates")
        
        # Extract and insert candidates
        candidates_inserted = 0
        candidates_skipped = 0
        
        for chunk_row in chunks:
            chunk_id, document_id, chunk_text, page_number, locator, document_title = chunk_row
            
            # Extract question candidates
            candidates = extract_question_candidates(chunk_text, page_number or 0)
            
            for candidate in candidates:
                question_text = candidate['question_text']
                normalized = normalize_text(question_text)
                question_hash = sha256_hash(normalized)
                
                # STRICT_EXTRACTION_V3: Classify question
                methodology_type, is_promotable = classify(question_text)
                psa_scope_ok = methodology_type not in ("NON_PHYSICAL", "CONTEXT_ONLY")
                
                # Determine initial promotion bucket (will be updated by OFC linkage)
                # PROMOTABLE requires both classification AND citable OFC (set by linkage script)
                promotion_bucket = "CONTEXT_ONLY"
                
                # Insert candidate
                try:
                    # Check which schema columns exist
                    cur.execute("""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'question_candidate_queue'
                        AND column_name IN ('methodology_type', 'chunk_id', 'question_hash', 'locator_type')
                    """)
                    existing_cols = {row[0] for row in cur.fetchall()}
                    has_strict_columns = 'methodology_type' in existing_cols
                    has_old_schema = 'chunk_id' in existing_cols and 'question_hash' in existing_cols
                    has_new_schema = 'locator_type' in existing_cols
                    
                    # Determine locator_type from locator
                    locator_type = 'UNKNOWN'
                    if locator:
                        if 'Page' in locator or 'page' in locator.lower():
                            locator_type = 'PDF'
                        elif 'Row' in locator or 'sheet' in locator.lower():
                            locator_type = 'XLSX'
                    
                    if has_strict_columns:
                        # New strict schema with classification
                        if has_new_schema and not has_old_schema:
                            # Pure new schema (no chunk_id, no question_hash)
                            cur.execute("""
                                INSERT INTO public.question_candidate_queue (
                                    source_set, document_id,
                                    question_text, context, locator_type, locator,
                                    methodology_type, psa_scope_ok, promotion_bucket
                                )
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """, (
                                active_source_set,
                                document_id,
                                question_text,
                                candidate.get('context', ''),
                                locator_type,
                                locator or '',
                                methodology_type,
                                psa_scope_ok,
                                promotion_bucket
                            ))
                        else:
                            # Hybrid: has strict columns but also old columns
                            cur.execute("""
                                INSERT INTO public.question_candidate_queue (
                                    source_set, document_id, chunk_id,
                                    question_text, context, locator, question_hash,
                                    methodology_type, psa_scope_ok, promotion_bucket
                                )
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (source_set, question_hash) DO NOTHING
                            """, (
                                active_source_set,
                                document_id,
                                chunk_id,
                                question_text,
                                candidate.get('context', ''),
                                locator or '',
                                question_hash,
                                methodology_type,
                                psa_scope_ok,
                                promotion_bucket
                            ))
                    else:
                        # Old schema (backward compatibility)
                        cur.execute("""
                            INSERT INTO public.question_candidate_queue (
                                source_set, document_id, chunk_id,
                                question_text, context, locator, question_hash
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (source_set, question_hash) DO NOTHING
                        """, (
                            active_source_set,
                            document_id,
                            chunk_id,
                            question_text,
                            candidate.get('context'),
                            locator,
                            question_hash
                        ))
                    
                    if cur.rowcount > 0:
                        candidates_inserted += 1
                    else:
                        candidates_skipped += 1
                except Exception as e:
                    print(f"⚠️  Error inserting candidate: {e}", file=sys.stderr)
                    candidates_skipped += 1
        
        conn.commit()
        
        return {
            'status': 'completed',
            'active_source_set': active_source_set,
            'chunks_processed': len(chunks),
            'candidates_extracted': candidates_inserted + candidates_skipped,
            'candidates_inserted': candidates_inserted,
            'candidates_skipped': candidates_skipped
        }
        
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
    try:
        result = mine_question_candidates()
        print()
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            print()
            print(f"✅ Question candidate mining complete: {result['candidates_inserted']} inserted, {result['candidates_skipped']} skipped")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

