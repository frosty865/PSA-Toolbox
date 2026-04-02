#!/usr/bin/env python3
"""
Database Smoketest
Tests database connectivity and required tables/views
"""

import sys
from pathlib import Path

# Add parent directories to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from model.db.db import db_select
from model.db.db_config import get_db_mode, get_db_info


def test_table_exists(table_name: str) -> bool:
    """Test if table/view exists."""
    # Try Postgres first (will auto-fallback to REST if needed)
    try:
        query = f"SELECT to_regclass('public.{table_name}') as exists"
        result = db_select(query)
        return result and result[0].get('exists') is not None
    except (ValueError, RuntimeError) as e:
        error_str = str(e).lower()
        # Check if error is about table not existing (Postgres)
        if 'does not exist' in error_str or 'relation' in error_str:
            return False
        
        # If Postgres failed, try REST API format
        if any(keyword in error_str for keyword in ['timeout', 'connection', 'unreachable', '404', 'httperror']):
            try:
                # Use REST API format - try to query the table
                db_select(table_name, select='*', limit=1)
                return True
            except Exception as rest_error:
                rest_error_str = str(rest_error).lower()
                # Check for 404 or relation not found errors
                if '404' in str(rest_error) or 'does not exist' in rest_error_str or 'not found' in rest_error_str or 'relation' in rest_error_str:
                    return False
                # Other errors (like 401/403) mean table might exist but we can't access it
                # For smoketest purposes, assume it doesn't exist if we can't query it
                return False
        else:
            # Non-connection error from Postgres, re-raise or return False
            print(f"  ERROR checking {table_name}: {e}")
            return False
    except Exception as e:
        error_str = str(e).lower()
        # Check if error is about table not existing
        if 'does not exist' in error_str or 'relation' in error_str:
            return False
        print(f"  ERROR checking {table_name}: {e}")
        return False


def test_table_count(table_name: str) -> int:
    """Get row count from table."""
    try:
        # Try Postgres first
        query = f"SELECT count(*) as cnt FROM public.{table_name}"
        result = db_select(query)
        return result[0].get('cnt', 0) if result else 0
    except (ValueError, RuntimeError) as e:
        error_str = str(e).lower()
        # If Postgres failed, try REST API format
        if any(keyword in error_str for keyword in ['timeout', 'connection', 'unreachable', '404', 'httperror']):
            try:
                # Use REST API format - can't get exact count, just verify table exists
                rows = db_select(table_name, select='*', limit=1)
                return 0  # Can't get accurate count via REST
            except Exception as rest_error:
                print(f"  ERROR counting {table_name}: {rest_error}")
                return -1
        else:
            print(f"  ERROR counting {table_name}: {e}")
            return -1
    except Exception as e:
        print(f"  ERROR counting {table_name}: {e}")
        return -1


def main():
    """Run database smoketest (hard gate with exit codes)."""
    print("=" * 80)
    print("Database Smoketest (Hard Gate)")
    print("=" * 80)
    
    # Print DB info
    info = get_db_info()
    print(f"\nDatabase Configuration:")
    print(f"  Mode: {info.get('mode', 'unknown')}")
    print(f"  Database Type: {info.get('database_type', 'unknown')}")
    print(f"  Host: {info.get('host', 'unknown')}")
    print(f"  Database: {info.get('database', 'unknown')}")
    
    if 'error' in info:
        print(f"\n❌ Configuration Error: {info['error']}")
        print("\nRequired environment variables for CORPUS database (corpus_documents):")
        print("  - SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD (preferred)")
        print("  - OR DATABASE_URL pointing to CORPUS project")
        print("\nFor RUNTIME database:")
        print("  - SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD")
        print("  - OR DATABASE_URL pointing to RUNTIME project")
        print("\nFor REST API fallback:")
        print("  - SUPABASE_CORPUS_URL + SUPABASE_CORPUS_SERVICE_ROLE_KEY")
        print("  - OR SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
        print("\n❌ DB unreachable; pipeline cannot run.")
        sys.exit(2)
    
    # CRITICAL TEST: Must be able to query corpus_documents
    print("\n[CRITICAL] Testing corpus_documents query (must succeed)...")
    try:
        # Try Postgres first (will auto-fallback to REST if needed)
        try:
            query = "SELECT count(*) as cnt FROM public.corpus_documents"
            result = db_select(query)
            count = result[0].get('cnt', 0) if result else 0
            print(f"   ✓ corpus_documents query succeeded via Postgres (rows: {count})")
        except (ValueError, RuntimeError) as pg_error:
            # Postgres failed, try REST API format
            error_msg = str(pg_error).lower()
            if any(keyword in error_msg for keyword in ['timeout', 'connection', 'unreachable', '404']):
                # Use REST API format
                result = db_select('corpus_documents', select='id', limit=1)
                count = len(result) if result else 0
                print(f"   ✓ corpus_documents table accessible via REST API")
            else:
                raise
    except Exception as e:
        error_class = type(e).__name__
        error_msg = str(e)
        print(f"   ❌ corpus_documents query FAILED")
        print(f"   Exception: {error_class}: {error_msg}")
        print("\n❌ DB unreachable; pipeline cannot run.")
        sys.exit(2)
    
    print("\nTesting required tables/views...")
    
    missing_objects = []
    
    # Test corpus_documents table exists
    print("\n1. Testing public.corpus_documents table...")
    if test_table_exists('corpus_documents'):
        count = test_table_count('corpus_documents')
        if count >= 0:
            print(f"   ✓ Table exists (rows: {count})")
        else:
            print(f"   ✓ Table exists (count unavailable)")
    else:
        print("   ❌ Table does not exist")
        missing_objects.append("public.corpus_documents (run: db/migrations/20260118_create_corpus_documents.sql)")
    
    # Test citation_ready_statements view
    print("\n2. Testing public.citation_ready_statements view...")
    if test_table_exists('citation_ready_statements'):
        count = test_table_count('citation_ready_statements')
        if count >= 0:
            print(f"   ✓ View exists (rows: {count})")
        else:
            print(f"   ✓ View exists (count unavailable)")
    else:
        print("   ❌ View does not exist")
        missing_objects.append("public.citation_ready_statements (create: db/sql/create_citation_ready_statements_view.sql)")
    
    # Test question_meaning table
    print("\n3. Testing public.question_meaning table...")
    if test_table_exists('question_meaning'):
        count = test_table_count('question_meaning')
        if count >= 0:
            print(f"   ✓ Table exists (rows: {count})")
        else:
            print(f"   ✓ Table exists (count unavailable)")
    else:
        print("   ❌ Table does not exist")
        missing_objects.append("public.question_meaning (run: db/migrations/20260118_create_question_meaning.sql)")
    
    # Test baseline_spines_runtime (for loading questions)
    print("\n4. Testing public.baseline_spines_runtime table...")
    if test_table_exists('baseline_spines_runtime'):
        count = test_table_count('baseline_spines_runtime')
        if count >= 0:
            print(f"   ✓ Table exists (rows: {count})")
        else:
            print(f"   ✓ Table exists (count unavailable)")
    else:
        print("   ⚠ Table does not exist (may be in different schema)")
    
    # Exit with error if objects missing
    if missing_objects:
        print("\n" + "=" * 80)
        print("❌ Missing required database objects:")
        for obj in missing_objects:
            print(f"  - {obj}")
        print("=" * 80)
        sys.exit(3)
    
    print("\n" + "=" * 80)
    print("✓ All required tables/views exist and DB is reachable")
    print("=" * 80)
    sys.exit(0)


if __name__ == '__main__':
    main()
