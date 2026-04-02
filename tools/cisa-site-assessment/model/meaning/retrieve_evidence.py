"""
Retrieval function for corpus evidence (RAG)
Deterministic retrieval based on question text and discipline frame
"""

import os
import re
import json
from typing import List, Dict, Optional, Set
import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from model.db.db import db_select
from model.db.db_config import get_db_mode


def load_discipline_frames() -> Dict[str, Dict]:
    """Load discipline frames from JSON file."""
    import os
    from pathlib import Path
    
    frames_file = Path(__file__).parent.parent.parent / "model" / "meaning" / "discipline_frames.v1.json"
    if not frames_file.exists():
        raise FileNotFoundError(f"Discipline frames file not found: {frames_file}")
    
    with open(frames_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Convert to dict keyed by discipline code
    frames = {}
    for frame in data.get('frames', []):
        frames[frame['discipline']] = frame
    
    return frames


def extract_keywords(question_text: str) -> List[str]:
    """Extract keywords from question text for retrieval."""
    # Remove common question words
    stop_words = {'is', 'are', 'do', 'does', 'have', 'has', 'a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'at', 'by', 'with'}
    
    # Extract words (alphanumeric, at least 3 chars)
    words = re.findall(r'\b[a-zA-Z]{3,}\b', question_text.lower())
    
    # Filter stop words and return unique
    keywords = [w for w in words if w not in stop_words]
    return list(set(keywords))


def matches_allowed_concepts(text: str, allowed_concepts: List[str]) -> bool:
    """Check if text matches at least one allowed concept."""
    text_lower = text.lower()
    for concept in allowed_concepts:
        if concept.lower() in text_lower:
            return True
    return False


def contains_forbidden_concepts(text: str, forbidden_concepts: List[str]) -> bool:
    """Check if text contains any forbidden concepts."""
    text_lower = text.lower()
    for concept in forbidden_concepts:
        if concept.lower() in text_lower:
            return True
    return False


def retrieve_evidence(
    canon_id: str,
    question_text: str,
    discipline: str,
    debug_report: bool = False
) -> tuple[List[Dict], List[str], Dict]:
    """
    Retrieve evidence from corpus for question meaning generation.
    
    Args:
        canon_id: Question canon_id
        question_text: Question text
        discipline: Discipline code (e.g., ACS, CPTED)
        debug_report: If True, return detailed debug info
    
    Returns:
        Tuple of (evidence_list, warnings, debug_info)
        evidence_list: List of evidence dicts with chunk_id, corpus_document_id, page_number, text
        warnings: List of warning strings
        debug_info: Dict with retrieval stats and pass/fail status
    """
    warnings = []
    debug_info = {
        'canon_id': canon_id,
        'discipline': discipline,
        'question_text': question_text,
        'retrieval_passed': False,
        'evidence_count': 0,
        'distinct_documents': 0,
        'keywords_extracted': [],
        'evidence_before_filtering': 0,
        'evidence_after_filtering': 0,
        'filter_reasons': []
    }
    
    # Load discipline frame
    frames = load_discipline_frames()
    if discipline not in frames:
        warnings.append(f"No discipline frame found for {discipline}")
        debug_info['failure_reason'] = f"No discipline frame found for {discipline}"
        return [], warnings, debug_info
    
    frame = frames[discipline]
    allowed_concepts = frame.get('allowed_concepts', [])
    forbidden_concepts = frame.get('forbidden_concepts', [])
    
    # Extract keywords from question
    keywords = extract_keywords(question_text)
    debug_info['keywords_extracted'] = keywords
    if not keywords:
        warnings.append("No keywords extracted from question text")
        debug_info['failure_reason'] = "No keywords extracted from question text"
        return [], warnings, debug_info
    
    # Build keyword search query (OR logic)
    keyword_pattern = '|'.join(keywords[:10])  # Limit to 10 keywords
    
    # Query citation_ready_statements using db adapter
    mode = get_db_mode()
    
    try:
        if mode == "postgres":
            # Build ILIKE patterns for SQL
            patterns = [f'%{kw}%' for kw in keywords[:10]]
            pattern_array = "ARRAY[" + ",".join([f"'{p}'" for p in patterns]) + "]"
            
            query = f"""
            SELECT 
                chunk_id,
                corpus_document_id,
                page_number,
                chunk_text as text
            FROM public.citation_ready_statements
            WHERE chunk_text ILIKE ANY({pattern_array})
            LIMIT 50
            """
            
            rows = db_select(query)
        else:
            # Supabase REST mode - use PostgREST filters
            # Build OR filter for keywords
            filters = {}
            # PostgREST doesn't support ILIKE ANY directly, so we'll use textSearch
            # For now, query with first keyword and let filtering happen in Python
            rows = db_select(
                'citation_ready_statements',
                select='chunk_id,corpus_document_id,page_number,chunk_text',
                filters={'chunk_text.ilike': f'%{keywords[0]}%'} if keywords else {},
                limit=50
            )
            # Filter by remaining keywords in Python
            if len(keywords) > 1:
                filtered_rows = []
                for row in rows:
                    text = (row.get('chunk_text') or '').lower()
                    if any(kw.lower() in text for kw in keywords[:10]):
                        filtered_rows.append(row)
                rows = filtered_rows
        
        debug_info['evidence_before_filtering'] = len(rows)
        
        # Filter evidence by discipline frame
        evidence = []
        seen_doc_ids: Set[str] = set()
        filtered_out_forbidden = 0
        filtered_out_not_allowed = 0
        
        for row in rows:
            # Handle both dict keys: 'text' (from SQL) or 'chunk_text' (from REST)
            chunk_text = row.get('text') or row.get('chunk_text') or ''
            
            # Check forbidden concepts first
            if contains_forbidden_concepts(chunk_text, forbidden_concepts):
                filtered_out_forbidden += 1
                continue
            
            # Check allowed concepts
            if not matches_allowed_concepts(chunk_text, allowed_concepts):
                filtered_out_not_allowed += 1
                continue
            
            # Add to evidence
            evidence.append({
                'chunk_id': str(row.get('chunk_id', '')),
                'corpus_document_id': str(row.get('corpus_document_id', '')),
                'page_number': row.get('page_number'),
                'text': chunk_text[:500]  # Limit text length
            })
            
            doc_id = str(row.get('corpus_document_id', ''))
            if doc_id:
                seen_doc_ids.add(doc_id)
        
        debug_info['evidence_after_filtering'] = len(evidence)
        debug_info['distinct_documents'] = len(seen_doc_ids)
        debug_info['filter_reasons'] = {
            'filtered_forbidden_concepts': filtered_out_forbidden,
            'filtered_not_allowed': filtered_out_not_allowed
        }
        
        # Gate: Ensure diversity - at least 3 distinct corpus_document_id
        if len(seen_doc_ids) < 3:
            failure_reason = f"Insufficient document diversity: only {len(seen_doc_ids)} distinct documents (required: 3)"
            warnings.append(failure_reason)
            debug_info['failure_reason'] = failure_reason
            # Still check evidence count - if we have enough evidence items, allow it
            if len(evidence) < 6:
                return [], warnings + ["Insufficient evidence after filtering"], debug_info
            # If we have enough evidence but not enough docs, still fail (diversity requirement)
            return [], warnings, debug_info
        
        # Gate: Ensure minimum evidence count - at least 6 items
        if len(evidence) < 6:
            failure_reason = f"Insufficient evidence: only {len(evidence)} items after filtering (required: 6)"
            warnings.append(failure_reason)
            debug_info['failure_reason'] = failure_reason
            return [], warnings, debug_info
        
        # Limit to 6-12 evidence items
        evidence = evidence[:12]
        debug_info['evidence_count'] = len(evidence)
        debug_info['retrieval_passed'] = True
        
        return evidence, warnings, debug_info
        
    except Exception as e:
        error_msg = f"Database error during retrieval: {str(e)}"
        warnings.append(error_msg)
        debug_info['failure_reason'] = error_msg
        return [], warnings, debug_info


if __name__ == '__main__':
    # Test retrieval
    test_canon_id = "BASE-ACS"
    test_question = "Is a Biometric Access capability implemented?"
    test_discipline = "ACS"
    
    evidence, warnings, debug_info = retrieve_evidence(test_canon_id, test_question, test_discipline, debug_report=True)
    
    print(f"Retrieved {len(evidence)} evidence items")
    print(f"Warnings: {warnings}")
    print(f"Debug info: {json.dumps(debug_info, indent=2)}")
    if evidence:
        print(f"\nFirst evidence item:")
        print(json.dumps(evidence[0], indent=2))
