#!/usr/bin/env python3
"""
Diagnostic script to check where tables exist (CORPUS vs RUNTIME).
Run this to verify table locations before running the loader.

IMPORTANT: This script must be run in a virtual environment (venv).
  Activate venv first:
    Windows: .venv\Scripts\activate
    Linux/Mac: source .venv/bin/activate
"""
import os
import sys
from pathlib import Path

# Check if running in a virtual environment
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    print("ERROR: This script must be run in a virtual environment (venv)")
    print("\nTo activate venv:")
    print("  Windows: .venv\\Scripts\\activate")
    print("  Linux/Mac: source .venv/bin/activate")
    print("\nOr create a venv if it doesn't exist:")
    print("  python -m venv .venv")
    sys.exit(1)

import psycopg2

# Try to load .env.local if it exists
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # dotenv not installed, try to manually parse .env.local
    env_path = Path(__file__).parent.parent.parent / '.env.local'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key in ('RUNTIME_DATABASE_URL', 'CORPUS_DATABASE_URL', 'DATABASE_URL'):
                        os.environ[key] = value

def check_tables(conn, db_name):
    """Check which tables exist in the given connection."""
    cur = conn.cursor()
    tables_to_check = ['source_registry', 'corpus_documents', 'module_ofc_library', 'module_ofc_citations']
    
    results = {}
    for table in tables_to_check:
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = %s
            )
        """, (table,))
        exists = cur.fetchone()[0]
        results[table] = exists
    
    cur.close()
    return results

def main():
    runtime_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    corpus_url = os.environ.get("CORPUS_DATABASE_URL")
    
    print("=" * 60)
    print("Table Location Diagnostic")
    print("=" * 60)
    
    # Check RUNTIME
    if runtime_url:
        try:
            runtime_conn = psycopg2.connect(runtime_url)
            runtime_results = check_tables(runtime_conn, "RUNTIME")
            runtime_conn.close()
            
            print("\n[RUNTIME Database]")
            for table, exists in runtime_results.items():
                status = "✓ EXISTS" if exists else "✗ MISSING"
                print(f"  {table:30s} {status}")
        except Exception as e:
            print(f"\n[RUNTIME Database] Connection failed: {e}")
            runtime_results = {}
    else:
        print("\n[RUNTIME Database] RUNTIME_DATABASE_URL not set")
        runtime_results = {}
    
    # Check CORPUS
    if corpus_url:
        try:
            corpus_conn = psycopg2.connect(corpus_url)
            corpus_results = check_tables(corpus_conn, "CORPUS")
            corpus_conn.close()
            
            print("\n[CORPUS Database]")
            for table, exists in corpus_results.items():
                status = "✓ EXISTS" if exists else "✗ MISSING"
                print(f"  {table:30s} {status}")
        except Exception as e:
            print(f"\n[CORPUS Database] Connection failed: {e}")
            corpus_results = {}
    else:
        print("\n[CORPUS Database] CORPUS_DATABASE_URL not set")
        corpus_results = {}
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary & Recommendations")
    print("=" * 60)
    
    if runtime_results.get('module_ofc_library'):
        print("✓ module_ofc_library exists in RUNTIME (required)")
    else:
        print("✗ module_ofc_library MISSING in RUNTIME")
        print("  → Run migration: db/migrations/runtime/20260126_1200_module_vofc_library.sql")
    
    if runtime_results.get('module_ofc_citations'):
        print("✓ module_ofc_citations exists in RUNTIME (required)")
    else:
        print("✗ module_ofc_citations MISSING in RUNTIME")
        print("  → Run migration: db/migrations/runtime/20260126_1200_module_vofc_library.sql")
    
    if runtime_results.get('source_registry'):
        print("✓ source_registry exists in RUNTIME (loader will use this)")
    elif corpus_results.get('source_registry'):
        print("✓ source_registry exists in CORPUS (loader will use CORPUS_DATABASE_URL)")
    else:
        print("✗ source_registry MISSING in both databases")
        print("  → Run migration: db/migrations/20260116_create_source_registry.sql in CORPUS")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
