#!/usr/bin/env python3
"""Verify CORPUS pilot document state."""

import os
import sys
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

def main():
    """Verify pilot document state."""
    document_id = 'd523bcbe-60db-47bf-8487-80b533673d29'
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Get source_id
        cur.execute("SELECT source_id FROM documents WHERE document_id = %s", (document_id,))
        source_id = cur.fetchone()[0]
        
        # Count candidates
        cur.execute("SELECT COUNT(*) FROM ofc_candidate_queue WHERE source_id = %s", (source_id,))
        candidate_count = cur.fetchone()[0]
        
        # Count target links
        cur.execute("""
            SELECT COUNT(*) FROM ofc_candidate_targets oct
            JOIN ofc_candidate_queue ocq ON oct.candidate_id = ocq.candidate_id
            WHERE ocq.source_id = %s
        """, (source_id,))
        target_count = cur.fetchone()[0]
        
        print(f"✅ CORPUS Pilot Document State:")
        print(f"   Document ID: {document_id}")
        print(f"   Candidates: {candidate_count}")
        print(f"   Target links: {target_count}")
        
        if candidate_count == 12:
            print(f"   ✅ Candidate count matches expected (12)")
        else:
            print(f"   ⚠️  Candidate count mismatch (expected 12, got {candidate_count})")
        
        if target_count > 0:
            print(f"   ✅ Target links created: {target_count}")
        else:
            print(f"   ⚠️  No target links (index may be incomplete)")
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()

