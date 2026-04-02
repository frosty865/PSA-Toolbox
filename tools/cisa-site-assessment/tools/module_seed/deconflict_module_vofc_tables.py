#!/usr/bin/env python3
"""
Deconflict module VOFC tables between CORPUS and RUNTIME databases.

These tables should ONLY exist in RUNTIME:
- module_ofc_library
- module_ofc_citations

This script:
1. Checks if they exist in CORPUS
2. Checks if CORPUS versions have any data
3. Optionally drops them from CORPUS (with confirmation)

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

def check_table_data(conn, table_name):
    """Check if table exists and has data."""
    cur = conn.cursor()
    
    # Check if table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = %s
        )
    """, (table_name,))
    exists = cur.fetchone()[0]
    
    if not exists:
        return {'exists': False, 'row_count': 0}
    
    # Count rows
    try:
        cur.execute(f"SELECT COUNT(*) FROM public.{table_name}")
        row_count = cur.fetchone()[0]
    except Exception as e:
        cur.close()
        return {'exists': True, 'row_count': None, 'error': str(e)}
    
    cur.close()
    return {'exists': True, 'row_count': row_count}

def main():
    runtime_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
    corpus_url = os.environ.get("CORPUS_DATABASE_URL")
    
    if not runtime_url:
        print("ERROR: RUNTIME_DATABASE_URL or DATABASE_URL not set")
        sys.exit(1)
    if not corpus_url:
        print("ERROR: CORPUS_DATABASE_URL not set")
        sys.exit(1)
    
    print("=" * 60)
    print("Module VOFC Table Deconfliction")
    print("=" * 60)
    print("\nThese tables should ONLY exist in RUNTIME:")
    print("  - module_ofc_library")
    print("  - module_ofc_citations")
    print()
    
    # Connect to both databases
    try:
        runtime_conn = psycopg2.connect(runtime_url)
        corpus_conn = psycopg2.connect(corpus_url)
    except Exception as e:
        print(f"ERROR: Failed to connect to databases: {e}")
        sys.exit(1)
    
    tables_to_check = ['module_ofc_library', 'module_ofc_citations']
    issues_found = []
    
    print("[Checking CORPUS database for duplicate tables...]")
    print()
    
    for table in tables_to_check:
        corpus_data = check_table_data(corpus_conn, table)
        runtime_data = check_table_data(runtime_conn, table)
        
        print(f"Table: {table}")
        print(f"  RUNTIME: {'EXISTS' if runtime_data['exists'] else 'MISSING'} "
              f"({runtime_data['row_count']} rows)" if runtime_data['exists'] and runtime_data['row_count'] is not None else "")
        print(f"  CORPUS:  {'EXISTS' if corpus_data['exists'] else 'MISSING'} "
              f"({corpus_data['row_count']} rows)" if corpus_data['exists'] and corpus_data['row_count'] is not None else "")
        
        if corpus_data['exists']:
            if corpus_data['row_count'] == 0:
                issues_found.append({
                    'table': table,
                    'database': 'CORPUS',
                    'action': 'DROP',
                    'reason': 'Empty table in wrong database'
                })
                print(f"  ⚠️  ISSUE: Empty table exists in CORPUS (should be dropped)")
            else:
                issues_found.append({
                    'table': table,
                    'database': 'CORPUS',
                    'action': 'MIGRATE_OR_DROP',
                    'reason': f'Table has {corpus_data["row_count"]} rows in CORPUS',
                    'row_count': corpus_data['row_count']
                })
                print(f"  ⚠️  ISSUE: Table has {corpus_data['row_count']} rows in CORPUS!")
                print(f"      → Need to migrate data to RUNTIME or verify it's safe to drop")
        
        if not runtime_data['exists']:
            issues_found.append({
                'table': table,
                'database': 'RUNTIME',
                'action': 'CREATE',
                'reason': 'Missing in RUNTIME (required)'
            })
            print(f"  ⚠️  ISSUE: Missing in RUNTIME (required)")
        
        print()
    
    runtime_conn.close()
    corpus_conn.close()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    if not issues_found:
        print("✓ No issues found. Tables are correctly located.")
        return
    
    print(f"\n⚠️  Found {len(issues_found)} issue(s):\n")
    for issue in issues_found:
        print(f"  - {issue['table']} in {issue['database']}: {issue['reason']}")
        print(f"    Action needed: {issue['action']}")
    
    print("\n" + "=" * 60)
    print("Recommended Actions")
    print("=" * 60)
    
    drop_needed = [i for i in issues_found if i['action'] == 'DROP']
    migrate_needed = [i for i in issues_found if i['action'] == 'MIGRATE_OR_DROP']
    create_needed = [i for i in issues_found if i['database'] == 'RUNTIME' and i['action'] == 'CREATE']
    
    if create_needed:
        print("\n1. CREATE missing tables in RUNTIME:")
        for issue in create_needed:
            print(f"   → Run migration: db/migrations/runtime/20260126_1200_module_vofc_library.sql")
    
    if drop_needed:
        print("\n2. DROP empty tables from CORPUS:")
        print("   Run this SQL in CORPUS database:")
        for issue in drop_needed:
            print(f"   DROP TABLE IF EXISTS public.{issue['table']} CASCADE;")
    
    if migrate_needed:
        print("\n3. MIGRATE data from CORPUS to RUNTIME (if needed):")
        print("   ⚠️  WARNING: Tables in CORPUS have data. Review before dropping!")
        for issue in migrate_needed:
            print(f"   → {issue['table']}: {issue['row_count']} rows in CORPUS")
            print(f"     Check if this data should be migrated to RUNTIME or if it's safe to drop.")
    
    print("\n" + "=" * 60)
    print("\nTo automatically drop empty tables from CORPUS, run:")
    print("  python tools/module_seed/deconflict_module_vofc_tables.py --drop-empty")

if __name__ == "__main__":
    drop_empty = '--drop-empty' in sys.argv
    
    if drop_empty:
        # Re-connect and drop empty tables
        runtime_url = os.environ.get("RUNTIME_DATABASE_URL") or os.environ.get("DATABASE_URL")
        corpus_url = os.environ.get("CORPUS_DATABASE_URL")
        
        if not corpus_url:
            print("ERROR: CORPUS_DATABASE_URL not set")
            sys.exit(1)
        
        corpus_conn = psycopg2.connect(corpus_url)
        corpus_conn.autocommit = False
        cur = corpus_conn.cursor()
        
        try:
            for table in ['module_ofc_library', 'module_ofc_citations']:
                # Check if exists and empty
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = %s
                    )
                """, (table,))
                exists = cur.fetchone()[0]
                
                if exists:
                    cur.execute(f"SELECT COUNT(*) FROM public.{table}")
                    row_count = cur.fetchone()[0]
                    
                    if row_count == 0:
                        print(f"Dropping empty table: {table}")
                        cur.execute(f"DROP TABLE IF EXISTS public.{table} CASCADE")
                        print(f"✓ Dropped {table}")
                    else:
                        print(f"⚠️  Skipping {table} (has {row_count} rows)")
            
            corpus_conn.commit()
            print("\n✓ Cleanup complete")
        except Exception as e:
            corpus_conn.rollback()
            print(f"ERROR: {e}")
            sys.exit(1)
        finally:
            cur.close()
            corpus_conn.close()
    else:
        main()
