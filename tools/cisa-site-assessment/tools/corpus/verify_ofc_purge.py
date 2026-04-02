#!/usr/bin/env python3
"""
Verification script to check OFC purge status.

Usage:
    # Always use venv!
    source venv/bin/activate  # Unix/Mac/Linux
    venv\Scripts\activate      # Windows
    
    python tools/corpus/verify_ofc_purge.py
    
    # Or use wrapper script (auto-activate venv):
    scripts/verify_ofc_purge.bat  # Windows
    scripts/verify_ofc_purge.sh   # Unix
"""

import os
import sys
from pathlib import Path

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

def get_corpus_db():
    """Get CORPUS database connection."""
    import psycopg2
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def table_exists(conn, table_name: str) -> bool:
    """Check if table exists."""
    cur = conn.cursor()
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    exists = cur.fetchone()[0]
    cur.close()
    return exists

def count_rows(conn, table_name: str) -> int:
    """Count rows in table."""
    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) FROM public.{table_name}")
    count = cur.fetchone()[0]
    cur.close()
    return count

def main():
    print("=" * 70)
    print("OFC PURGE VERIFICATION")
    print("=" * 70)
    print()
    
    conn = get_corpus_db()
    
    try:
        tables_to_check = [
            "ofc_candidate_queue",
            "ofc_question_links",
            "ofc_candidate_targets"
        ]
        
        all_zero = True
        
        for table_name in tables_to_check:
            if not table_exists(conn, table_name):
                print(f"[SKIP] {table_name}: Table does not exist")
                continue
            
            count = count_rows(conn, table_name)
            status = "✓" if count == 0 else "✗"
            print(f"{status} {table_name}: {count} rows")
            
            if count > 0:
                all_zero = False
        
        print()
        print("=" * 70)
        
        if all_zero:
            print("✅ VERIFICATION PASSED")
            print("All OFC tables are empty (purge successful)")
        else:
            print("❌ VERIFICATION FAILED")
            print("Some OFC tables still contain data")
            sys.exit(1)
        
    finally:
        conn.close()

if __name__ == "__main__":
    main()
