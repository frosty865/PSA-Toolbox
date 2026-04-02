#!/usr/bin/env python3
"""
CORPUS: Promote Expansion Questions from Approved Candidates

Promotes approved question candidates into expansion_questions table.
Requires human-edited approval file.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
import re
import argparse
from pathlib import Path
from typing import Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.overlay_control import (
    get_corpus_db_connection,
    forbid_deprecated_sources
)

def normalize_whitespace(text: str) -> str:
    """Normalize whitespace for comparison."""
    return re.sub(r'\s+', ' ', text.strip())

def validate_promotion(promotion: Dict, candidate_text: str) -> None:
    """Validate a promotion entry against candidate text."""
    required_fields = ['candidate_id', 'expansion_version', 'scope_type', 'scope_code', 'question_code', 'question_text']
    for field in required_fields:
        if field not in promotion:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate scope_type
    if promotion['scope_type'] not in ['SECTOR', 'SUBSECTOR', 'TECHNOLOGY']:
        raise ValueError(f"scope_type must be SECTOR, SUBSECTOR, or TECHNOLOGY, got: {promotion['scope_type']}")
    
    # Forbid SAFE
    forbid_deprecated_sources(promotion['scope_code'])
    forbid_deprecated_sources(promotion['question_code'])
    
    # Validate question_text matches candidate (whitespace normalization and bullet/number removal allowed)
    # Remove leading numbers/bullets from both for comparison
    import re
    def clean_for_comparison(text):
        text = re.sub(r'^[\d\.\-\•\*\s]+', '', text)  # Remove leading numbers/bullets
        return normalize_whitespace(text)
    
    normalized_promotion = clean_for_comparison(promotion['question_text'])
    normalized_candidate = clean_for_comparison(candidate_text)
    
    if normalized_promotion != normalized_candidate:
        raise ValueError(
            f"question_text does not match candidate text:\n"
            f"  Promotion: '{normalized_promotion}'\n"
            f"  Candidate:  '{normalized_candidate}'"
        )

def promote_questions(approval_file: str, dry_run: bool = False) -> Dict:
    """Promote approved candidates to expansion_questions."""
    # Load approval file
    with open(approval_file, 'r', encoding='utf-8') as f:
        approvals = json.load(f)
    
    if not isinstance(approvals, list):
        raise ValueError("Approval file must contain an array of promotion objects")
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get candidate texts for validation
        candidate_ids = [a['candidate_id'] for a in approvals]
        
        # Cast to UUID array for PostgreSQL
        cur.execute("""
            SELECT id, question_text
            FROM public.question_candidate_queue
            WHERE id = ANY(%s::uuid[])
        """, (candidate_ids,))
        
        candidate_map = {str(row[0]): row[1] for row in cur.fetchall()}
        
        # Validate and promote
        promoted = 0
        errors = []
        
        for i, approval in enumerate(approvals):
            try:
                candidate_id = approval['candidate_id']
                
                if candidate_id not in candidate_map:
                    errors.append({
                        'index': i,
                        'candidate_id': candidate_id,
                        'error': 'Candidate ID not found in question_candidate_queue'
                    })
                    continue
                
                candidate_text = candidate_map[candidate_id]
                
                # Validate promotion
                validate_promotion(approval, candidate_text)
                
                if dry_run:
                    print(f"Would promote: {approval['question_code']}")
                    promoted += 1
                    continue
                
                # HARD GUARDRAIL: Never write to baseline_questions
                # This script ONLY promotes to expansion_questions
                if 'baseline_questions' in str(approval).lower():
                    raise RuntimeError(
                        "FORBIDDEN: This script cannot write to baseline_questions. "
                        "Baseline questions are protected and can only be modified through "
                        "explicit baseline governance processes."
                    )
                
                # Upsert into expansion_questions ONLY
                cur.execute("""
                    INSERT INTO public.expansion_questions (
                        expansion_version, scope_type, scope_code, question_code,
                        question_text, response_enum, is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, true)
                    ON CONFLICT (expansion_version, question_code) DO UPDATE SET
                        scope_type = EXCLUDED.scope_type,
                        scope_code = EXCLUDED.scope_code,
                        question_text = EXCLUDED.question_text,
                        updated_at = now()
                    RETURNING id
                """, (
                    approval['expansion_version'],
                    approval['scope_type'],
                    approval['scope_code'],
                    approval['question_code'],
                    approval['question_text'],
                    json.dumps(["YES", "NO", "N_A"])
                ))
                
                promoted += 1
                
            except Exception as e:
                errors.append({
                    'index': i,
                    'candidate_id': approval.get('candidate_id', 'UNKNOWN'),
                    'error': str(e)
                })
        
        if not dry_run:
            conn.commit()
        
        return {
            'status': 'completed',
            'total_approvals': len(approvals),
            'promoted': promoted,
            'errors': errors
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description='Promote approved question candidates to expansion_questions')
    parser.add_argument('--in', dest='approval_file', required=True, help='Path to approval JSON file')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without writing to database')
    
    args = parser.parse_args()
    
    try:
        result = promote_questions(args.approval_file, dry_run=args.dry_run)
        
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            if args.dry_run:
                print(f"\n✅ Dry run complete: Would promote {result['promoted']} questions")
            else:
                print(f"\n✅ Promotion complete: {result['promoted']} questions promoted")
                if result['errors']:
                    print(f"⚠️  {len(result['errors'])} errors occurred")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

