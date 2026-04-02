#!/usr/bin/env python3
"""
Run RUNTIME Migration SQL

Executes a migration SQL file against the RUNTIME database.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from tools.runtime.compose_assessment_universe import get_runtime_db_connection

def run_migration(migration_file: str):
    """Run migration SQL file."""
    if not os.path.exists(migration_file):
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    conn = get_runtime_db_connection()
    cur = conn.cursor()
    
    try:
        # Execute migration (SQL file may contain multiple statements)
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
        print("Usage: python tools/runtime/run_migration.py <migration_file.sql>")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    
    try:
        run_migration(migration_file)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()


