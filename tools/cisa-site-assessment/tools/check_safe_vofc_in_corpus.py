#!/usr/bin/env python3
"""Check if SAFE VOFC Library is in CORPUS."""

import os
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
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Check for SAFE VOFC Library
        cur.execute("""
            SELECT d.document_id, d.title, d.source_id, COUNT(dc.chunk_id) as chunk_count
            FROM documents d
            LEFT JOIN document_chunks dc ON d.document_id = dc.document_id
            WHERE d.title ILIKE %s
            GROUP BY d.document_id, d.title, d.source_id
        """, ('%SAFE VOFC%',))
        
        rows = cur.fetchall()
        
        if rows:
            print("✅ SAFE VOFC Library found in CORPUS:")
            for row in rows:
                print(f"   Document ID: {row[0]}")
                print(f"   Title: {row[1]}")
                print(f"   Source ID: {row[2]}")
                print(f"   Chunks: {row[3]}")
        else:
            print("❌ SAFE VOFC Library NOT found in CORPUS")
            # Use PSA_SYSTEM_ROOT environment variable or default to D:\PSA_System
            psa_root = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
            pdf_path = psa_root / "data" / "incoming" / "SAFE VOFC Library.pdf"
            print(f"   Need to ingest: {pdf_path}")
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()

