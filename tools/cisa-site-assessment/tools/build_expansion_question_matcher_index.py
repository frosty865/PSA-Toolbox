#!/usr/bin/env python3
"""
Build Expansion Question Matcher Index

Builds a matcher index for expansion questions based on active overlay selections.
Only includes questions matching the selected overlays.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.corpus.overlay_control import (
    get_corpus_db_connection,
    get_overlay_control
)

def load_synonyms() -> Dict:
    """Load question synonyms for matching."""
    synonyms_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'question_synonyms.json'
    if synonyms_path.exists():
        with open(synonyms_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def normalize_text(text: str) -> str:
    """Normalize text for keyword extraction."""
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_keywords(text: str, synonyms: Dict) -> List[str]:
    """Extract keywords from question text, applying synonyms."""
    normalized = normalize_text(text)
    words = set(normalized.split())
    
    # Apply synonyms
    for key, synonym_list in synonyms.items():
        if key.lower() in normalized:
            words.update(s.lower() for s in synonym_list)
    
    # Remove common stop words
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
        'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'
    }
    words = words - stop_words
    
    return sorted(list(words))

def build_expansion_index() -> Dict:
    """Build expansion question matcher index."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active overlay selections
        overlay_control = get_overlay_control(conn)
        active_sectors = overlay_control['active_sector_codes']
        active_subsectors = overlay_control['active_subsector_codes']
        active_technologies = overlay_control['active_technology_codes']
        
        # Check if any overlays are selected
        has_overlays = bool(active_sectors or active_subsectors or active_technologies)
        
        if not has_overlays:
            print("EXPANSION overlays not selected; index empty")
            return {
                'expansion_questions': [],
                'total_count': 0,
                'by_scope_type': {},
                'overlay_snapshot': overlay_control
            }
        
        # Build WHERE clause for selected overlays
        conditions = []
        params = []
        
        if active_sectors:
            conditions.append("(scope_type = 'SECTOR' AND scope_code = ANY(%s))")
            params.append(active_sectors)
        
        if active_subsectors:
            conditions.append("(scope_type = 'SUBSECTOR' AND scope_code = ANY(%s))")
            params.append(active_subsectors)
        
        if active_technologies:
            conditions.append("(scope_type = 'TECHNOLOGY' AND scope_code = ANY(%s))")
            params.append(active_technologies)
        
        where_clause = " OR ".join(conditions)
        
        # Query expansion questions
        query = f"""
            SELECT 
                question_code,
                question_text,
                scope_type,
                scope_code,
                expansion_version
            FROM public.expansion_questions
            WHERE is_active = true
                AND ({where_clause})
            ORDER BY scope_type, scope_code, question_code
        """
        
        cur.execute(query, params)
        questions = cur.fetchall()
        
        if not questions:
            print("EXPANSION overlays selected but no matching questions found; index empty")
            return {
                'expansion_questions': [],
                'total_count': 0,
                'by_scope_type': {},
                'overlay_snapshot': overlay_control
            }
        
        # Load synonyms
        synonyms = load_synonyms()
        
        # Build index
        index_questions = []
        by_scope_type = {}
        
        for row in questions:
            question_code, question_text, scope_type, scope_code, expansion_version = row
            
            keywords = extract_keywords(question_text, synonyms)
            
            question_entry = {
                'question_code': question_code,
                'question_text': question_text,
                'scope_type': scope_type,
                'scope_code': scope_code,
                'expansion_version': expansion_version,
                'keywords': keywords
            }
            
            index_questions.append(question_entry)
            
            # Count by scope_type
            by_scope_type[scope_type] = by_scope_type.get(scope_type, 0) + 1
        
        return {
            'expansion_questions': index_questions,
            'total_count': len(index_questions),
            'by_scope_type': by_scope_type,
            'overlay_snapshot': overlay_control
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    try:
        index = build_expansion_index()
        
        # Save index
        output_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'expansion_question_matcher_index.json'
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)
        
        print(f"✓ Index saved: {output_path}")
        print()
        print("Summary:")
        print(f"  Total expansion questions: {index['total_count']}")
        
        if index['by_scope_type']:
            print("  By scope type:")
            for scope_type, count in sorted(index['by_scope_type'].items()):
                print(f"    {scope_type}: {count}")
        else:
            print("  (No questions in index)")
        
        print()
        print(f"  Overlay snapshot:")
        snapshot = index['overlay_snapshot']
        print(f"    Sectors:      {snapshot['active_sector_codes']}")
        print(f"    Subsectors:   {snapshot['active_subsector_codes']}")
        print(f"    Technologies: {snapshot['active_technology_codes']}")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

