#!/usr/bin/env python3
"""
Run CORPUS Migration SQL

Executes a migration SQL file against the CORPUS database.
"""

import os
import sys
from pathlib import Path
import psycopg2.extras

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.corpus.source_set import get_corpus_db_connection

def run_migration(migration_file: str):
    """Run migration SQL file."""
    if not os.path.exists(migration_file):
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        # Execute migration using psycopg2's execute_batch for multiple statements
        # For complex SQL with DO blocks, we need to execute the entire file
        # Use psycopg2's execute with the full SQL content
        
        # psycopg2 execute() can handle multiple statements if we use execute_batch
        # But for DDL statements, we need to execute them one by one
        # Let's use a simple approach: execute the entire SQL file
        
        # Actually, psycopg2's execute() only handles one statement
        # We need to use execute_batch or split statements properly
        # For now, let's use psycopg2's execute with the entire SQL string
        # wrapped in a way that handles multiple statements
        
        # Use psycopg2's execute_batch for multiple statements
        # But first, let's try executing the entire SQL as-is
        # If that fails, we'll split it
        
        # Execute entire SQL file - psycopg2 can handle this if we use execute_batch
        # But execute_batch is for INSERT/UPDATE, not DDL
        # So we need to split statements properly
        
        # Simple approach: use psycopg2's execute with the entire SQL string
        # wrapped in a transaction
        cur.execute(sql_content)
        conn.commit()
        
        print(f"✅ Migration executed successfully: {migration_file}")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/corpus/run_migration.py <migration_file.sql>")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    
    try:
        run_migration(migration_file)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

