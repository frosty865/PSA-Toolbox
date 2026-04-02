#!/usr/bin/env python3
"""
Run OFC Class Migration

Executes migrations/20260203_add_ofc_class_to_ofc_candidate_queue.sql against CORPUS database.
This migration adds the 'ofc_class' column for ranking OFCs by capability nature.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

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

def main():
    """Run the migration."""
    migration_path = Path(__file__).parent.parent.parent / 'migrations' / '20260203_add_ofc_class_to_ofc_candidate_queue.sql'
    
    if not migration_path.exists():
        print(f"ERROR: Migration file not found: {migration_path}")
        return 1
    
    print(f"Loading migration from: {migration_path}")
    sql = migration_path.read_text(encoding='utf-8')
    
    print("Connecting to CORPUS database...")
    conn = get_corpus_db()
    cur = conn.cursor()
    
    try:
        print("Executing migration...")
        cur.execute(sql)
        conn.commit()
        print("✅ Migration completed successfully")
        
        # Verify column exists
        cur.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ofc_candidate_queue'
              AND column_name = 'ofc_class'
        """)
        result = cur.fetchone()
        if result:
            print(f"✅ Verified: ofc_class column exists (type: {result[1]}, default: {result[2]})")
        else:
            print("⚠️  WARNING: ofc_class column not found after migration")
            return 1
        
        return 0
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        return 1
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    sys.exit(main())
