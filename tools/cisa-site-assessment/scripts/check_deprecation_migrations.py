#!/usr/bin/env python3
"""
Check if deprecation migrations have been applied to the database.

This script verifies:
1. If deprecation columns exist in required_elements table
2. If BASE-061 through BASE-071 are marked as deprecated
3. Migration status
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from typing import Dict, List, Tuple

def get_db_connection():
    """Get database connection from environment variables."""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'psa'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )

def check_deprecation_columns(conn) -> Tuple[bool, List[str]]:
    """
    Check if deprecation columns exist in required_elements table.
    
    Returns:
        (all_exist: bool, missing_columns: List[str])
    """
    required_columns = ['status', 'deprecated_at', 'deprecated_reason']
    missing = []
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'required_elements'
              AND column_name IN ('status', 'deprecated_at', 'deprecated_reason')
        """)
        existing = {row[0] for row in cur.fetchall()}
        
        for col in required_columns:
            if col not in existing:
                missing.append(col)
    
    return len(missing) == 0, missing

def check_deprecated_elements(conn) -> Tuple[int, List[Dict]]:
    """
    Check if BASE-061 through BASE-071 are marked as deprecated.
    
    Returns:
        (count: int, elements: List[Dict])
    """
    deprecated_codes = [
        'BASE-061', 'BASE-062', 'BASE-063', 'BASE-064',
        'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071'
    ]
    
    with conn.cursor() as cur:
        # First check if status column exists
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'required_elements'
              AND column_name = 'status'
        """)
        
        if not cur.fetchone():
            return 0, []
        
        # Check deprecated elements
        cur.execute("""
            SELECT 
                element_code,
                status,
                deprecated_at,
                deprecated_reason,
                discipline_name
            FROM required_elements
            WHERE element_code IN %s
              AND discipline_name = 'Video Surveillance Systems'
            ORDER BY element_code
        """, (tuple(deprecated_codes),))
        
        results = cur.fetchall()
        elements = [
            {
                'element_code': row[0],
                'status': row[1],
                'deprecated_at': row[2],
                'deprecated_reason': row[3],
                'discipline_name': row[4]
            }
            for row in results
        ]
        
        deprecated_count = sum(1 for el in elements if el['status'] == 'deprecated')
        
        return deprecated_count, elements

def check_indexes(conn) -> Tuple[bool, List[str]]:
    """
    Check if deprecation indexes exist.
    
    Returns:
        (all_exist: bool, missing_indexes: List[str])
    """
    required_indexes = [
        'idx_required_elements_status',
        'idx_required_elements_code_status'
    ]
    missing = []
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'required_elements'
              AND indexname IN ('idx_required_elements_status', 'idx_required_elements_code_status')
        """)
        existing = {row[0] for row in cur.fetchall()}
        
        for idx in required_indexes:
            if idx not in existing:
                missing.append(idx)
    
    return len(missing) == 0, missing

def main():
    """Main function to check migration status."""
    print("=" * 60)
    print("Checking Deprecation Migration Status")
    print("=" * 60)
    print()
    
    try:
        conn = get_db_connection()
        
        # Check 1: Deprecation columns
        print("1. Checking deprecation columns...")
        cols_exist, missing_cols = check_deprecation_columns(conn)
        if cols_exist:
            print("   ✅ All deprecation columns exist")
        else:
            print(f"   ❌ Missing columns: {', '.join(missing_cols)}")
            print("   → Run: migrations/20250127_add_required_elements_deprecation.sql")
        print()
        
        # Check 2: Deprecated elements
        print("2. Checking deprecated elements...")
        if not cols_exist:
            print("   ⚠️  Skipping (columns don't exist)")
        else:
            deprecated_count, elements = check_deprecated_elements(conn)
            if deprecated_count == 8:
                print(f"   ✅ All 8 elements marked as deprecated")
                print("   Deprecated elements:")
                for el in elements:
                    if el['status'] == 'deprecated':
                        print(f"      - {el['element_code']}: {el['deprecated_at']}")
            elif deprecated_count > 0:
                print(f"   ⚠️  Only {deprecated_count}/8 elements marked as deprecated")
                print("   → Run: migrations/20250127_deprecate_base_0xx_video_surveillance.sql")
            else:
                print("   ❌ No elements marked as deprecated")
                print("   → Run: migrations/20250127_deprecate_base_0xx_video_surveillance.sql")
        print()
        
        # Check 3: Indexes
        print("3. Checking indexes...")
        if not cols_exist:
            print("   ⚠️  Skipping (columns don't exist)")
        else:
            idxs_exist, missing_idxs = check_indexes(conn)
            if idxs_exist:
                print("   ✅ All deprecation indexes exist")
            else:
                print(f"   ⚠️  Missing indexes: {', '.join(missing_idxs)}")
                print("   → Run: migrations/20250127_add_required_elements_deprecation.sql")
        print()
        
        # Summary
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        
        if cols_exist and deprecated_count == 8:
            print("✅ All migrations have been applied successfully!")
        else:
            print("❌ Migrations need to be applied:")
            if not cols_exist:
                print("   1. migrations/20250127_add_required_elements_deprecation.sql")
            if cols_exist and deprecated_count < 8:
                print("   2. migrations/20250127_deprecate_base_0xx_video_surveillance.sql")
        
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

