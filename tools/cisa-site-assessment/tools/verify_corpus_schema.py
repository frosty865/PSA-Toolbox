#!/usr/bin/env python3
"""Verify CORPUS schema tables exist."""

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
    """Verify required tables exist."""
    required_tables = [
        'canonical_sources',
        'documents',
        'document_chunks',
        'ingestion_runs',
        'ingestion_run_documents',
        'ofc_candidate_queue',
        'ofc_candidate_targets'
    ]
    
    try:
        conn = get_corpus_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ANY(%s)
            ORDER BY table_name
        """, (required_tables,))
        
        existing = {row[0] for row in cur.fetchall()}
        missing = set(required_tables) - existing
        
        if missing:
            print(f"❌ Missing tables: {sorted(missing)}")
            sys.exit(1)
        
        print(f"✅ All {len(required_tables)} required tables exist")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

