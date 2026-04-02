#!/usr/bin/env python3
"""
Run Phase 6 reviews table migration.

This script executes the SQL migration to create the phase6_reviews table.
"""

import os
import sys
import psycopg2
from pathlib import Path

def get_db_connection():
    """Get database connection from environment variables."""
    db_url = (
        os.getenv("DATABASE_URL") or
        os.getenv("SUPABASE_DB_URL") or
        os.getenv("POSTGRES_URL")
    )
    
    if not db_url:
        print("ERROR: DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_URL must be set")
        sys.exit(1)
    
    # Determine SSL settings
    ssl_mode = None
    if 'supabase' in db_url.lower() or 'amazonaws.com' in db_url.lower() or 'azure' in db_url.lower():
        ssl_mode = {'sslmode': 'require'}
    
    try:
        conn = psycopg2.connect(db_url, sslmode='require' if ssl_mode else None)
        return conn
    except Exception as e:
        print(f"ERROR: Failed to connect to database: {e}")
        sys.exit(1)

def run_migration():
    """Run the Phase 6 migration."""
    migration_file = Path(__file__).parent.parent / "migrations" / "20251221_create_phase6_reviews.sql"
    
    if not migration_file.exists():
        print(f"ERROR: Migration file not found: {migration_file}")
        sys.exit(1)
    
    print(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Connecting to database...")
    conn = get_db_connection()
    
    try:
        with conn.cursor() as cur:
            print("Executing migration...")
            cur.execute(sql_content)
            conn.commit()
            print("✅ Migration completed successfully!")
            
            # Verify table was created
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'phase6_reviews'
                )
            """)
            exists = cur.fetchone()[0]
            
            if exists:
                print("✅ Verified: phase6_reviews table exists")
                
                # Check indexes
                cur.execute("""
                    SELECT indexname 
                    FROM pg_indexes 
                    WHERE tablename = 'phase6_reviews'
                """)
                indexes = [row[0] for row in cur.fetchall()]
                print(f"✅ Found {len(indexes)} indexes: {', '.join(indexes)}")
            else:
                print("⚠️  WARNING: Table verification failed")
                
    except Exception as e:
        conn.rollback()
        print(f"❌ ERROR: Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Phase 6 Reviews Table Migration")
    print("=" * 60)
    print()
    run_migration()

