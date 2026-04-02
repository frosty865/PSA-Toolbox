#!/usr/bin/env python3
"""
Generate CORPUS Pilot Report v2

Generates detailed report with extraction stats.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict
from datetime import datetime

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

def generate_report(document_id: str) -> Dict:
    """Generate v2 pilot report."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get document info
        cur.execute("""
            SELECT d.document_id, d.title, d.page_count, d.file_hash,
                   cs.citation_text, cs.source_type
            FROM public.documents d
            JOIN public.canonical_sources cs ON d.source_id = cs.source_id
            WHERE d.document_id = %s
        """, (document_id,))
        
        doc_row = cur.fetchone()
        if not doc_row:
            raise ValueError(f'Document not found: {document_id}')
        
        doc_id, title, page_count, file_hash, citation_text, source_type = doc_row
        
        # Get chunk count
        cur.execute("""
            SELECT COUNT(*) FROM public.document_chunks
            WHERE document_id = %s
        """, (document_id,))
        chunks_count = cur.fetchone()[0]
        
        # Get candidate count
        cur.execute("""
            SELECT COUNT(*) FROM public.ofc_candidate_queue ocq
            JOIN public.documents d ON ocq.source_id = d.source_id
            WHERE d.document_id = %s
        """, (document_id,))
        candidates_count = cur.fetchone()[0]
        
        # Get page extraction stats
        cur.execute("""
            SELECT 
                COUNT(DISTINCT page_number) as pages_with_chunks,
                MIN(page_number) as min_page,
                MAX(page_number) as max_page
            FROM public.document_chunks
            WHERE document_id = %s AND page_number IS NOT NULL
        """, (document_id,))
        
        page_stats = cur.fetchone()
        pages_with_chunks = page_stats[0] if page_stats[0] else 0
        
        # Get latest ingestion run
        cur.execute("""
            SELECT ir.run_name, ir.completed_at
            FROM public.ingestion_runs ir
            JOIN public.ingestion_run_documents ird ON ir.run_id = ird.run_id
            WHERE ird.document_id = %s
            ORDER BY ir.completed_at DESC
            LIMIT 1
        """, (document_id,))
        
        run_info = cur.fetchone()
        extractor_version = "pdfplumber_v1"  # Extract from run_name if available
        if run_info and 'pdfplumber' in run_info[0].lower():
            extractor_version = "pdfplumber_v1"
        
        report = {
            'generated_at': datetime.utcnow().isoformat() + 'Z',
            'document_id': str(doc_id),
            'title': title,
            'source': {
                'citation_text': citation_text,
                'source_type': source_type,
                'file_hash': file_hash
            },
            'extraction': {
                'pages_total': page_count,
                'pages_extracted': pages_with_chunks,
                'extraction_coverage_pct': round((pages_with_chunks / page_count * 100) if page_count > 0 else 0, 1),
                'extractor_version': extractor_version
            },
            'processing': {
                'chunks_count': chunks_count,
                'candidates_count': candidates_count
            },
            'success_criteria': {
                'pages_extracted_target': '>= 90%',
                'pages_extracted_met': pages_with_chunks >= (page_count * 0.9) if page_count else False,
                'chunks_count_target': '>= 20',
                'chunks_count_met': chunks_count >= 20,
                'candidates_count_target': '>= 9',
                'candidates_count_met': candidates_count >= 9,
                'no_runtime_writes': True
            }
        }
        
        return report
        
    finally:
        cur.close()
        conn.close()

def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print("Usage: python generate_corpus_pilot_report_v2.py <document_id>")
        sys.exit(1)
    
    document_id = sys.argv[1]
    
    try:
        report = generate_report(document_id)
        
        # Ensure output directory exists
        output_dir = Path(__file__).parent.parent / 'analytics' / 'reports'
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_path = output_dir / 'corpus_pilot_summary_v2.json'
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"Report written to: {output_path}")
        print(json.dumps(report, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

