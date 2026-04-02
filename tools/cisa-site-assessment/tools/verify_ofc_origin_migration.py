#!/usr/bin/env python3
"""
Verify ofc_origin migration status and data integrity.

Checks:
1. Column exists
2. NOT NULL constraint exists
3. CHECK constraint exists
4. Data integrity (only CORPUS and MODULE values)
5. Indexes exist
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

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
    load_env_file('.env.local')
    
    # Try direct CORPUS_DATABASE_URL first
    dsn = os.environ.get("CORPUS_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_CORPUS_URL + password pattern
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        from urllib.parse import urlparse
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = corpus_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            raise SystemExit(f"Could not parse project_ref from CORPUS_URL: {corpus_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def main():
    conn = get_corpus_db()
    cur = conn.cursor()
    
    print("=" * 70)
    print("ofc_origin Migration Verification")
    print("=" * 70)
    print()
    
    # 1. Check if column exists
    print("1. Checking if ofc_origin column exists...")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ofc_candidate_queue'
          AND column_name = 'ofc_origin'
    """)
    col_info = cur.fetchone()
    if col_info:
        print(f"   ✓ Column exists: {col_info[0]} ({col_info[1]}, nullable: {col_info[2]})")
    else:
        print("   ✗ Column does NOT exist - migration needed!")
        cur.close()
        conn.close()
        return
    
    # 2. Check NOT NULL constraint
    print("\n2. Checking NOT NULL constraint...")
    cur.execute("""
        SELECT is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ofc_candidate_queue'
          AND column_name = 'ofc_origin'
    """)
    is_nullable = cur.fetchone()[0]
    if is_nullable == 'NO':
        print("   ✓ NOT NULL constraint exists")
    else:
        print("   ✗ NOT NULL constraint missing - migration needed!")
    
    # 3. Check CHECK constraint
    print("\n3. Checking CHECK constraint...")
    cur.execute("""
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'public.ofc_candidate_queue'::regclass
          AND conname = 'chk_ofc_candidate_queue_ofc_origin'
    """)
    check_constraint = cur.fetchone()
    if check_constraint:
        print(f"   ✓ CHECK constraint exists: {check_constraint[1]}")
    else:
        print("   ✗ CHECK constraint missing - migration needed!")
    
    # 4. Check indexes
    print("\n4. Checking indexes...")
    cur.execute("""
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'ofc_candidate_queue'
          AND indexname LIKE '%ofc_origin%'
        ORDER BY indexname
    """)
    indexes = cur.fetchall()
    if indexes:
        print(f"   ✓ Found {len(indexes)} index(es):")
        for idx_name, idx_def in indexes:
            print(f"     - {idx_name}")
    else:
        print("   ⚠ No indexes found (may be created by migration)")
    
    # 5. Check data integrity
    print("\n5. Checking data integrity...")
    cur.execute("""
        SELECT 
            ofc_origin,
            COUNT(*) as count
        FROM public.ofc_candidate_queue
        GROUP BY ofc_origin
        ORDER BY ofc_origin
    """)
    counts = cur.fetchall()
    
    print("   Current distribution:")
    total = 0
    has_other = False
    has_null = False
    
    for origin, count in counts:
        total += count
        if origin is None:
            has_null = True
            print(f"     NULL: {count}")
        elif origin.upper() not in ('CORPUS', 'MODULE'):
            has_other = True
            print(f"     {origin}: {count} ⚠ (unexpected value)")
        else:
            print(f"     {origin}: {count}")
    
    print(f"\n   Total rows: {total}")
    
    # Check for NULL values
    cur.execute("""
        SELECT COUNT(*) 
        FROM public.ofc_candidate_queue 
        WHERE ofc_origin IS NULL
    """)
    null_count = cur.fetchone()[0]
    if null_count > 0:
        print(f"   ✗ Found {null_count} NULL values - migration needed!")
        has_null = True
    
    # Summary
    print("\n" + "=" * 70)
    print("Summary")
    print("=" * 70)
    
    if not col_info:
        print("❌ Migration REQUIRED: Column does not exist")
    elif is_nullable == 'YES':
        print("❌ Migration REQUIRED: NOT NULL constraint missing")
    elif not check_constraint:
        print("❌ Migration REQUIRED: CHECK constraint missing")
    elif has_null:
        print("❌ Migration REQUIRED: NULL values found")
    elif has_other:
        print("⚠️  Migration RECOMMENDED: Unexpected values found (will be normalized to CORPUS)")
    else:
        print("✅ Migration status: COMPLETE")
        print("   All constraints in place, data is clean")
    
    print("\nTo run migration:")
    print("  psql $CORPUS_DATABASE_URL -f db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql")
    print("\nOr if using environment variables:")
    print("  python -c \"import os; from pathlib import Path; exec(open('.env.local').read()) if Path('.env.local').exists() else None; import subprocess; subprocess.run(['psql', os.environ['CORPUS_DATABASE_URL'], '-f', 'db/migrations/20260124_0007_lock_ofc_origin_on_candidates.sql'])\"")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
