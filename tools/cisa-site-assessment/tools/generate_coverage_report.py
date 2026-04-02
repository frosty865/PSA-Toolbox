#!/usr/bin/env python3
"""
Generate CORPUS Coverage Report (BASE + EXPANSION)

Generates coverage report separating BASE and EXPANSION question coverage.

HARD RULE: Only reads from CORPUS database (yylslokiaovdythzrbgt)
"""

import json
import os
import sys
import hashlib
from pathlib import Path
from typing import Dict, List
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.corpus.source_set import (
    get_corpus_db_connection,
    require_active_source_set
)
from tools.corpus.overlay_control import (
    get_overlay_control
)

def generate_coverage_report() -> Dict:
    """Generate coverage report for active source set."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get active source set
        active_source_set = require_active_source_set(conn)
        
        # Get overlay snapshot
        overlay_snapshot = get_overlay_control(conn)
        
        # Load question indices
        base_index_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
        expansion_index_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'expansion_question_matcher_index.json'
        
        base_index = {}
        if base_index_path.exists():
            with open(base_index_path, 'r', encoding='utf-8') as f:
                base_index = json.load(f)
        
        expansion_index = {}
        if expansion_index_path.exists():
            with open(expansion_index_path, 'r', encoding='utf-8') as f:
                expansion_index = json.load(f)
        
        base_questions = base_index.get('base_questions', [])
        expansion_questions = expansion_index.get('expansion_questions', [])
        
        # Get BASE coverage
        cur.execute("""
            SELECT 
                cql.question_code,
                COUNT(DISTINCT cql.candidate_id) as candidate_count,
                MAX(cql.score) as max_score,
                AVG(cql.score) as avg_score
            FROM public.corpus_candidate_question_links cql
            JOIN public.corpus_match_runs cmr ON cql.match_run_id = cmr.id
            WHERE cql.source_set = %s
                AND cql.universe = 'BASE'
            GROUP BY cql.question_code
        """, (active_source_set,))
        
        base_links = {row[0]: {'candidate_count': row[1], 'max_score': float(row[2]), 'avg_score': float(row[3])} 
                     for row in cur.fetchall()}
        
        # Get EXPANSION coverage
        expansion_links = {}
        expansion_by_scope = defaultdict(lambda: {'total': 0, 'with_links': 0})
        
        if expansion_questions:
            cur.execute("""
                SELECT 
                    cql.question_code,
                    COUNT(DISTINCT cql.candidate_id) as candidate_count,
                    MAX(cql.score) as max_score,
                    AVG(cql.score) as avg_score
                FROM public.corpus_candidate_question_links cql
                JOIN public.corpus_match_runs cmr ON cql.match_run_id = cmr.id
                WHERE cql.source_set = %s
                    AND cql.universe = 'EXPANSION'
                GROUP BY cql.question_code
            """, (active_source_set,))
            
            expansion_links = {row[0]: {'candidate_count': row[1], 'max_score': float(row[2]), 'avg_score': float(row[3])} 
                             for row in cur.fetchall()}
            
            # Count by scope_type and scope_code
            for q in expansion_questions:
                scope_type = q.get('scope_type')
                scope_code = q.get('scope_code')
                question_code = q.get('question_code')
                
                expansion_by_scope[scope_type]['total'] += 1
                if question_code in expansion_links:
                    expansion_by_scope[scope_type]['with_links'] += 1
        
        # Build BASE coverage section
        base_questions_with_links = len([q for q in base_questions if q.get('target_key') in base_links])
        base_questions_without_links = len(base_questions) - base_questions_with_links
        
        base_coverage = {
            'total_questions': len(base_questions),
            'questions_with_links': base_questions_with_links,
            'questions_without_links': base_questions_without_links,
            'total_links': sum(link['candidate_count'] for link in base_links.values())
        }
        
        # Build EXPANSION coverage section
        expansion_coverage = None
        if expansion_questions:
            expansion_questions_with_links = len([q for q in expansion_questions if q.get('question_code') in expansion_links])
            expansion_questions_without_links = len(expansion_questions) - expansion_questions_with_links
            
            expansion_coverage = {
                'total_questions': len(expansion_questions),
                'questions_with_links': expansion_questions_with_links,
                'questions_without_links': expansion_questions_without_links,
                'total_links': sum(link['candidate_count'] for link in expansion_links.values()),
                'by_scope_type': dict(expansion_by_scope)
            }
        
        # Generate overlay hash for filename
        overlay_str = json.dumps(overlay_snapshot, sort_keys=True)
        overlay_hash = hashlib.md5(overlay_str.encode()).hexdigest()[:8]
        
        report = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'active_source_set': active_source_set,
            'overlay_snapshot': overlay_snapshot,
            'base_coverage': base_coverage,
            'expansion_coverage': expansion_coverage if expansion_coverage else {'skipped': True, 'reason': 'No expansion questions or overlays not selected'}
        }
        
        return report, overlay_hash
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    try:
        report, overlay_hash = generate_coverage_report()
        
        # Generate filename with timestamp and overlay hash
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        source_set = report['active_source_set']
        filename = f'corpus_coverage_{source_set}_{timestamp}_{overlay_hash}.json'
        
        # Ensure output directory exists
        output_dir = Path(__file__).parent.parent / 'analytics' / 'reports'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / filename
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"Coverage report written to: {output_path}")
        print()
        print(json.dumps(report, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

