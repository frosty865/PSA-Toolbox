#!/usr/bin/env python3
"""
Generate CORPUS Pilot Coverage Snapshot Report

Generates coverage snapshot for a specific pilot document.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent))

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

def load_question_index(index_path: str) -> Dict:
    """Load question matcher index."""
    if not os.path.exists(index_path):
        return {'base_questions': [], 'expansion_questions': []}
    
    with open(index_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def generate_coverage_report(document_id: str) -> Dict:
    """Generate coverage snapshot report for pilot document."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get document info
        cur.execute("""
            SELECT d.document_id, d.title, d.source_id
            FROM public.documents d
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        doc_id, title, source_id = doc_row
        
        # Get candidate count
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue
            WHERE source_id = %s
        """, (source_id,))
        candidate_count = cur.fetchone()[0]
        
        # Get target link count
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_targets oct
            JOIN public.ofc_candidate_queue ocq ON oct.candidate_id = ocq.candidate_id
            WHERE ocq.source_id = %s
        """, (source_id,))
        target_link_count = cur.fetchone()[0]
        
        # Get candidates with zero targets
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue ocq
            LEFT JOIN public.ofc_candidate_targets oct ON ocq.candidate_id = oct.candidate_id
            WHERE ocq.source_id = %s AND oct.candidate_id IS NULL
        """, (source_id,))
        candidates_with_zero_targets = cur.fetchone()[0]
        
        # Get top 10 targets
        cur.execute("""
            SELECT 
                oct.target_type,
                oct.target_key,
                COUNT(*) as link_count,
                AVG(oct.match_score) as avg_score
            FROM public.ofc_candidate_targets oct
            JOIN public.ofc_candidate_queue ocq ON oct.candidate_id = ocq.candidate_id
            WHERE ocq.source_id = %s
            GROUP BY oct.target_type, oct.target_key
            ORDER BY link_count DESC, avg_score DESC
            LIMIT 10
        """, (source_id,))
        
        top_targets = []
        for row in cur.fetchall():
            top_targets.append({
                'target_type': row[0],
                'target_key': row[1],
                'count': row[2],
                'avg_score': round(float(row[3]), 3)
            })
        
        # Load question index to get counts
        index_path = Path(__file__).parent.parent / 'analytics' / 'runtime' / 'question_matcher_index.json'
        question_index = load_question_index(str(index_path))
        
        base_index_count = len(question_index.get('base_questions', []))
        expansion_index_count = len(question_index.get('expansion_questions', []))
        
        # Build notes
        notes = []
        if base_index_count < 36:
            notes.append(f"Index incomplete: BASE count is {base_index_count} (expected >= 36)")
        if expansion_index_count == 0:
            notes.append("No expansion questions in index")
        if candidates_with_zero_targets > 0:
            notes.append(f"{candidates_with_zero_targets} candidates have no target matches")
        
        report = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'document_id': str(doc_id),
            'document_title': title,
            'candidate_count': candidate_count,
            'target_link_count': target_link_count,
            'base_index_count': base_index_count,
            'expansion_index_count': expansion_index_count,
            'candidates_with_zero_targets': candidates_with_zero_targets,
            'top_10_targets': top_targets,
            'notes': notes if notes else ['All checks passed']
        }
        
        return report
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate CORPUS coverage report (BASE + EXPANSION)')
    parser.add_argument('--document_id', help='Document ID (UUID) - optional, generates report for active source set if omitted')
    
    args = parser.parse_args()
    document_id = args.document_id
    
    try:
        # If no document_id, use new coverage report generator
        if not document_id:
            from tools.generate_coverage_report import generate_coverage_report as generate_full_report
            report, overlay_hash = generate_full_report()
            
            # Generate filename with timestamp and overlay hash
            from datetime import datetime
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            source_set = report['active_source_set']
            filename = f'corpus_coverage_{source_set}_{timestamp}_{overlay_hash}.json'
            
            output_dir = Path(__file__).parent.parent / 'analytics' / 'reports'
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / filename
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            print(f"Coverage report written to: {output_path}")
            print()
            print(json.dumps(report, indent=2))
        else:
            # Legacy document-specific report
            report = generate_coverage_report(document_id)
            
            # Ensure output directory exists
            output_dir = Path(__file__).parent.parent / 'analytics' / 'reports'
            output_dir.mkdir(parents=True, exist_ok=True)
            
            output_path = output_dir / 'corpus_pilot_coverage_snapshot.json'
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            
            print(f"Coverage snapshot written to: {output_path}")
            print(json.dumps(report, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

