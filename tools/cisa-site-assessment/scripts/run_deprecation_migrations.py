#!/usr/bin/env python3
"""
Run deprecation migrations if they haven't been applied yet.

This script:
1. Checks if migrations have been applied
2. Runs them if needed
3. Verifies the results
"""

import os
import sys
import psycopg2
from pathlib import Path

def get_db_connection():
    """Get database connection from environment variables."""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'psa'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )

def check_column_exists(conn, column_name: str) -> bool:
    """Check if a column exists in required_elements table."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'required_elements'
              AND column_name = %s
        """, (column_name,))
        return cur.fetchone() is not None

def run_migration_file(conn, file_path: Path):
    """Run a SQL migration file."""
    print(f"Running: {file_path.name}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    with conn.cursor() as cur:
        try:
            cur.execute(sql_content)
            conn.commit()
            print(f"✅ Successfully applied: {file_path.name}")
            return True
        except Exception as e:
            conn.rollback()
            print(f"❌ Error applying {file_path.name}: {e}")
            return False

def main():
    """Main function."""
    print("=" * 60)
    print("Deprecation Migration Runner")
    print("=" * 60)
    print()
    
    # Find migration files
    script_dir = Path(__file__).parent.parent
    migrations_dir = script_dir / 'migrations'
    
    migration1 = migrations_dir / '20250127_add_required_elements_deprecation.sql'
    migration2 = migrations_dir / '20250127_deprecate_base_0xx_video_surveillance.sql'
    
    if not migration1.exists():
        print(f"❌ Migration file not found: {migration1}")
        print(f"   Expected location: {migrations_dir}")
        sys.exit(1)
    
    if not migration2.exists():
        print(f"❌ Migration file not found: {migration2}")
        print(f"   Expected location: {migrations_dir}")
        sys.exit(1)
    
    try:
        conn = get_db_connection()
        
        # Check current status
        print("Checking current migration status...")
        status_col_exists = check_column_exists(conn, 'status')
        print(f"   Status column exists: {status_col_exists}")
        print()
        
        # Run Migration 1 if needed
        if not status_col_exists:
            print("Migration 1 needed: Adding deprecation columns...")
            if run_migration_file(conn, migration1):
                print()
            else:
                print("❌ Failed to apply migration 1")
                sys.exit(1)
        else:
            print("✅ Migration 1 already applied (columns exist)")
            print()
        
        # Check if elements are deprecated
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) 
                FROM required_elements
                WHERE element_code IN ('BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071')
                  AND discipline_name = 'Video Surveillance Systems'
                  AND status = 'deprecated'
            """)
            deprecated_count = cur.fetchone()[0]
        
        # Run Migration 2 if needed
        if deprecated_count < 8:
            print(f"Migration 2 needed: Deprecating elements ({deprecated_count}/8 currently deprecated)...")
            if run_migration_file(conn, migration2):
                print()
            else:
                print("❌ Failed to apply migration 2")
                sys.exit(1)
        else:
            print("✅ Migration 2 already applied (all elements deprecated)")
            print()
        
        # Verify final status
        print("Verifying final status...")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    element_code,
                    status,
                    deprecated_at IS NOT NULL as has_deprecated_at
                FROM required_elements
                WHERE element_code IN ('BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071')
                  AND discipline_name = 'Video Surveillance Systems'
                ORDER BY element_code
            """)
            results = cur.fetchall()
            
            all_deprecated = all(row[1] == 'deprecated' for row in results)
            all_have_timestamp = all(row[2] for row in results)
            
            if all_deprecated and all_have_timestamp:
                print("✅ All migrations applied successfully!")
                print()
                print("Deprecated elements:")
                for row in results:
                    print(f"   - {row[0]}: {row[1]} (deprecated_at: {'✓' if row[2] else '✗'})")
            else:
                print("⚠️  Some elements may not be fully deprecated")
                for row in results:
                    status_icon = "✅" if row[1] == 'deprecated' else "❌"
                    timestamp_icon = "✅" if row[2] else "❌"
                    print(f"   {status_icon} {row[0]}: status={row[1]}, timestamp={timestamp_icon}")
        
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        print("\nMake sure your database connection environment variables are set:")
        print("  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

