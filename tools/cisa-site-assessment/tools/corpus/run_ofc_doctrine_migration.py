#!/usr/bin/env python3
"""
Run OFC Doctrine Guardrails Migration

Executes migrations/20260203_ofc_doctrine_guardrails.sql against CORPUS database.
This migration adds the 'approved' column and enforces doctrine constraints.
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

def run_migration():
    """Run the OFC doctrine guardrails migration."""
    migration_file = Path(__file__).parent.parent.parent / "migrations" / "20260203_ofc_doctrine_guardrails.sql"
    
    if not migration_file.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    print("=" * 70)
    print("OFC DOCTRINE GUARDRAILS MIGRATION")
    print("=" * 70)
    print(f"\nMigration file: {migration_file}")
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    conn = get_corpus_db()
    cur = conn.cursor()
    
    try:
        print("\n[INFO] Executing migration...")
        cur.execute(sql_content)
        conn.commit()
        
        print("✅ Migration executed successfully!")
        
        # Verify migration
        print("\n[VERIFY] Checking migration results...")
        
        # Check if approved column exists
        cur.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND table_name = 'ofc_candidate_queue' 
              AND column_name = 'approved'
        """)
        approved_col = cur.fetchone()
        if approved_col:
            print(f"  ✓ approved column exists: {approved_col[1]} (default: {approved_col[2]})")
        else:
            print("  ✗ approved column not found!")
        
        # Check constraint exists
        cur.execute("""
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'ofc_candidate_queue'
              AND constraint_name = 'ofc_candidate_queue_approved_status_consistency'
        """)
        constraint = cur.fetchone()
        if constraint:
            print(f"  ✓ Constraint exists: {constraint[0]}")
        else:
            print("  ⚠ Constraint not found (may already exist or failed)")
        
        # Check index exists
        cur.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'ofc_candidate_queue'
              AND indexname = 'idx_ofc_candidate_queue_approved'
        """)
        index = cur.fetchone()
        if index:
            print(f"  ✓ Index exists: {index[0]}")
        else:
            print("  ⚠ Index not found")
        
        # Count approved OFCs
        cur.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE approved = TRUE) as approved_count,
                COUNT(*) FILTER (WHERE status = 'PROMOTED') as promoted_count,
                COUNT(*) as total_count
            FROM public.ofc_candidate_queue
        """)
        counts = cur.fetchone()
        print(f"\n[STATS] OFC counts:")
        print(f"  Total OFCs: {counts[2]}")
        print(f"  Approved (approved=TRUE): {counts[0]}")
        print(f"  Promoted (status='PROMOTED'): {counts[1]}")
        
        if counts[0] != counts[1]:
            print(f"\n  ⚠ WARNING: Approved count ({counts[0]}) != Promoted count ({counts[1]})")
            print(f"     This may indicate data inconsistency. Review manually.")
        else:
            print(f"  ✓ Approved count matches Promoted count")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
