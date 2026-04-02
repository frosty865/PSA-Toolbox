#!/usr/bin/env python3
"""
CORPUS: Audit VOFC Library Locators

Audits that candidate locators match their source chunk locators.
Fails if any locator contains row numbers that don't match the chunk's locator.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import re
from pathlib import Path
from typing import List, Dict, Tuple

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)

def extract_row_number(locator: str) -> int:
    """Extract row number from locator string like 'sheet=Name;row=42'."""
    if not locator:
        return None
    match = re.search(r'row=(\d+)', locator)
    return int(match.group(1)) if match else None

def audit_vofc_library_locators(sample_size: int = 20) -> Dict:
    """
    Audit VOFC Library candidate locators against their source chunks.
    
    Returns audit results dict.
    """
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Confirm active source set
        active_set = require_active_source_set(conn, expected='VOFC_LIBRARY')
        print(f"✅ Active source set: {active_set}")
        print()
        
        # Get random sample of VOFC_LIBRARY candidates
        cur.execute("""
            SELECT 
                ocq.candidate_id,
                ocq.locator as candidate_locator,
                ocq.locator_type as candidate_locator_type,
                ocq.snippet_text,
                ocq.document_id,
                dc.locator as chunk_locator,
                dc.locator_type as chunk_locator_type,
                dc.chunk_index
            FROM public.ofc_candidate_queue ocq
            LEFT JOIN public.document_chunks dc 
                ON ocq.document_id = dc.document_id
                AND ocq.locator = dc.locator
            WHERE ocq.source_set = 'VOFC_LIBRARY'
            ORDER BY RANDOM()
            LIMIT %s
        """, (sample_size,))
        
        candidates = cur.fetchall()
        
        if not candidates:
            print("⚠️  No VOFC_LIBRARY candidates found")
            return {
                'status': 'no_candidates',
                'sample_size': 0,
                'mismatches': []
            }
        
        print(f"Auditing {len(candidates)} random VOFC_LIBRARY candidates...")
        print()
        
        mismatches = []
        matches = []
        
        for row in candidates:
            candidate_id, cand_locator, cand_loc_type, snippet_text, doc_id, chunk_locator, chunk_loc_type, chunk_index = row
            
            # Extract row numbers
            cand_row = extract_row_number(cand_locator) if cand_locator else None
            chunk_row = extract_row_number(chunk_locator) if chunk_locator else None
            
            # Check for mismatches
            mismatch_reasons = []
            
            if cand_loc_type != 'XLSX':
                mismatch_reasons.append(f"candidate locator_type={cand_loc_type}, expected XLSX")
            
            if not cand_locator or 'sheet=' not in cand_locator or 'row=' not in cand_locator:
                mismatch_reasons.append(f"candidate locator format invalid: '{cand_locator}'")
            
            if chunk_locator and cand_locator != chunk_locator:
                mismatch_reasons.append(f"locator mismatch: candidate='{cand_locator}' vs chunk='{chunk_locator}'")
            
            if chunk_row and cand_row and chunk_row != cand_row:
                mismatch_reasons.append(f"row number mismatch: candidate row={cand_row} vs chunk row={chunk_row}")
            
            # Check if candidate row matches chunk_index (should NOT if chunk has proper locator)
            if chunk_locator and chunk_row and cand_row == chunk_index and cand_row != chunk_row:
                mismatch_reasons.append(
                    f"candidate row={cand_row} matches chunk_index={chunk_index} but chunk locator has row={chunk_row}"
                )
            
            if mismatch_reasons:
                mismatches.append({
                    'candidate_id': str(candidate_id),
                    'document_id': str(doc_id) if doc_id else None,
                    'candidate_locator': cand_locator,
                    'chunk_locator': chunk_locator,
                    'candidate_row': cand_row,
                    'chunk_row': chunk_row,
                    'chunk_index': chunk_index,
                    'reasons': mismatch_reasons,
                    'snippet_excerpt': snippet_text[:100] if snippet_text else None
                })
            else:
                matches.append({
                    'candidate_id': str(candidate_id),
                    'locator': cand_locator,
                    'row': cand_row
                })
        
        # Print results
        print("=" * 80)
        print("AUDIT RESULTS")
        print("=" * 80)
        print(f"Total sampled: {len(candidates)}")
        print(f"Matches: {len(matches)}")
        print(f"Mismatches: {len(mismatches)}")
        print()
        
        if matches:
            print("✅ MATCHING LOCATORS (sample):")
            for match in matches[:5]:
                print(f"  Candidate {match['candidate_id'][:8]}...: {match['locator']} (row={match['row']})")
            if len(matches) > 5:
                print(f"  ... and {len(matches) - 5} more")
            print()
        
        if mismatches:
            print("❌ MISMATCHES FOUND:")
            for mismatch in mismatches:
                print(f"  Candidate {mismatch['candidate_id'][:8]}...")
                print(f"    Candidate locator: {mismatch['candidate_locator']}")
                print(f"    Chunk locator:     {mismatch['chunk_locator']}")
                print(f"    Candidate row:    {mismatch['candidate_row']}")
                print(f"    Chunk row:        {mismatch['chunk_row']}")
                print(f"    Chunk index:      {mismatch['chunk_index']}")
                print(f"    Reasons:          {', '.join(mismatch['reasons'])}")
                print(f"    Snippet:           {mismatch['snippet_excerpt']}")
                print()
        
        return {
            'status': 'completed',
            'sample_size': len(candidates),
            'matches': len(matches),
            'mismatches': len(mismatches),
            'mismatch_details': mismatches
        }
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Audit VOFC Library candidate locators')
    parser.add_argument('--sample_size', type=int, default=20, help='Number of candidates to sample (default: 20)')
    
    args = parser.parse_args()
    
    try:
        result = audit_vofc_library_locators(sample_size=args.sample_size)
        
        if result['status'] == 'completed':
            if result['mismatches'] > 0:
                print(f"❌ Audit FAILED: {result['mismatches']} mismatches found")
                sys.exit(1)
            else:
                print(f"✅ Audit PASSED: All {result['matches']} sampled candidates have correct locators")
        else:
            print(f"⚠️  Audit incomplete: {result['status']}")
            sys.exit(1)
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

