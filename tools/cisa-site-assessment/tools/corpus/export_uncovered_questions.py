#!/usr/bin/env python3
"""
CORPUS: Export Uncovered Questions

Exports lists of BASE and EXPANSION questions that have no OFC candidate links.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

SOURCE_SET = "CISA_MASS_GATHERING"
SCOPE_CODE = "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES"
EXPANSION_VERSION = "EXPANSION_QUESTIONS_V1"
OUT_PATH = "analytics/reports/uncovered_questions_cisa_mass_gathering.json"

def load_base_questions():
    """Load BASE questions from matcher index."""
    index_path = Path(__file__).parent.parent.parent / "analytics" / "runtime" / "question_matcher_index.json"
    if not index_path.exists():
        return []
    
    with open(index_path, 'r', encoding='utf-8') as f:
        index_data = json.load(f)
    
    base_questions = index_data.get('base_questions', [])
    return [(q.get('target_key'), q.get('question_text', '')) for q in base_questions]

def main():
    """Export uncovered questions."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # BASE: Get covered question codes
        cur.execute("""
            SELECT DISTINCT question_code
            FROM public.corpus_candidate_question_links
            WHERE source_set = %s AND universe = 'BASE'
        """, (SOURCE_SET,))
        base_covered = {row[0] for row in cur.fetchall()}
        
        # Load all BASE questions from index
        base_all = load_base_questions()
        
        base_uncovered = [
            {"question_code": qc, "question_text": qt}
            for (qc, qt) in base_all
            if qc not in base_covered
        ]
        
        # EXPANSION: Get covered question codes
        cur.execute("""
            SELECT DISTINCT question_code
            FROM public.corpus_candidate_question_links
            WHERE source_set = %s AND universe = 'EXPANSION'
        """, (SOURCE_SET,))
        exp_covered = {row[0] for row in cur.fetchall()}
        
        # Load all EXPANSION questions from database
        cur.execute("""
            SELECT question_code, question_text
            FROM public.expansion_questions
            WHERE scope_code = %s AND expansion_version = %s AND is_active = TRUE
            ORDER BY question_code
        """, (SCOPE_CODE, EXPANSION_VERSION))
        exp_all = cur.fetchall()
        
        exp_uncovered = [
            {"question_code": qc, "question_text": qt}
            for (qc, qt) in exp_all
            if qc not in exp_covered
        ]
        
        payload = {
            "source_set": SOURCE_SET,
            "scope_code": SCOPE_CODE,
            "expansion_version": EXPANSION_VERSION,
            "base": {
                "total": len(base_all),
                "covered": len(base_all) - len(base_uncovered),
                "uncovered": len(base_uncovered),
                "uncovered_list": base_uncovered
            },
            "expansion": {
                "total": len(exp_all),
                "covered": len(exp_all) - len(exp_uncovered),
                "uncovered": len(exp_uncovered),
                "uncovered_list": exp_uncovered
            }
        }
        
        output_path = Path(OUT_PATH)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        
        print(json.dumps({
            "out": str(output_path),
            "base_uncovered": len(base_uncovered),
            "expansion_uncovered": len(exp_uncovered)
        }, indent=2))
        
        return payload
        
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()


