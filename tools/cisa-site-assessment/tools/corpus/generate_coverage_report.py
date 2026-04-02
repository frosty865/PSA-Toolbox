#!/usr/bin/env python3
"""
CORPUS Coverage Report Generator

Generates a coverage snapshot report from CORPUS tables.
Outputs: analytics/reports/corpus_discovery_smoke_test.json
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List
from datetime import datetime

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

def generate_coverage_report() -> Dict:
    """Generate coverage report from CORPUS tables."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get counts
        cur.execute("SELECT COUNT(*) FROM public.documents")
        documents_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.document_chunks")
        chunks_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_queue")
        candidates_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.ofc_candidate_targets")
        targets_count = cur.fetchone()[0]
        
        # Get top 10 targets by count
        cur.execute("""
            SELECT target_type, target_key, COUNT(*) as match_count
            FROM public.ofc_candidate_targets
            GROUP BY target_type, target_key
            ORDER BY match_count DESC
            LIMIT 10
        """)
        
        top_targets = []
        for row in cur.fetchall():
            top_targets.append({
                'target_type': row[0],
                'target_key': row[1],
                'match_count': row[2]
            })
        
        # Get document summary
        cur.execute("""
            SELECT d.document_id, d.title, d.page_count, 
                   COUNT(DISTINCT dc.chunk_id) as chunk_count,
                   COUNT(DISTINCT ocq.candidate_id) as candidate_count
            FROM public.documents d
            LEFT JOIN public.document_chunks dc ON d.document_id = dc.document_id
            LEFT JOIN public.ofc_candidate_queue ocq ON d.source_id = ocq.source_id
            GROUP BY d.document_id, d.title, d.page_count
            ORDER BY d.created_at DESC
        """)
        
        documents = []
        for row in cur.fetchall():
            documents.append({
                'document_id': str(row[0]),
                'title': row[1],
                'page_count': row[2],
                'chunk_count': row[3],
                'candidate_count': row[4]
            })
        
        report = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'summary': {
                'documents_count': documents_count,
                'chunks_count': chunks_count,
                'candidates_count': candidates_count,
                'targets_count': targets_count
            },
            'top_targets': top_targets,
            'documents': documents
        }
        
        return report
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    try:
        report = generate_coverage_report()
        
        # Ensure output directory exists
        output_dir = Path(__file__).parent.parent.parent / 'analytics' / 'reports'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / 'corpus_discovery_smoke_test.json'
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"Coverage report written to: {output_path}")
        print(json.dumps(report, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

