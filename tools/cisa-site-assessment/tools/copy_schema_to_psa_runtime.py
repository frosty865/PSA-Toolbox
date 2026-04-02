#!/usr/bin/env python3
"""
Copy schema from postgres database to psa_runtime database
Uses psycopg2 to programmatically copy table structures
"""

import os
import sys
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Get connection details
RUNTIME_HOST = os.getenv('RUNTIME_DB_HOST', 'db.wivohgbuuwxoyfyzntsd.supabase.co')
RUNTIME_PORT = os.getenv('RUNTIME_DB_PORT', '5432')
RUNTIME_USER = os.getenv('RUNTIME_DB_USER', 'postgres')
RUNTIME_PASSWORD = os.getenv('RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')

if not RUNTIME_PASSWORD:
    print("Error: RUNTIME_DB_PASSWORD or SUPABASE_RUNTIME_DB_PASSWORD environment variable not set")
    sys.exit(1)

def get_table_ddl(conn, table_name):
    """Get CREATE TABLE statement for a table"""
    cur = conn.cursor()
    
    # Get table structure
    cur.execute("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """, (table_name,))
    
    columns = cur.fetchall()
    if not columns:
        return None
    
    # Build CREATE TABLE statement
    col_defs = []
    for col in columns:
        col_name, data_type, max_length, is_nullable, default = col
        
        col_def = f'"{col_name}" {data_type}'
        if max_length:
            col_def += f'({max_length})'
        if is_nullable == 'NO':
            col_def += ' NOT NULL'
        if default:
            col_def += f' DEFAULT {default}'
        
        col_defs.append(col_def)
    
    # Get constraints (primary keys, foreign keys, etc.)
    cur.execute("""
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_schema = 'public' AND table_name = %s
    """, (table_name,))
    
    constraints = cur.fetchall()
    
    ddl = f'CREATE TABLE IF NOT EXISTS public."{table_name}" (\n'
    ddl += ',\n'.join('  ' + col for col in col_defs)
    
    # Add primary key constraint
    pk_constraints = [c[0] for c in constraints if c[1] == 'PRIMARY KEY']
    if pk_constraints:
        cur.execute("""
            SELECT column_name
            FROM information_schema.key_column_usage
            WHERE constraint_name = %s
            ORDER BY ordinal_position
        """, (pk_constraints[0],))
        pk_cols = [row[0] for row in cur.fetchall()]
        pk_cols_quoted = [f'"{col}"' for col in pk_cols]
        ddl += f',\n  PRIMARY KEY ({", ".join(pk_cols_quoted)})'
    
    ddl += '\n);'
    
    cur.close()
    return ddl

def copy_schema():
    """Copy schema from postgres to psa_runtime"""
    
    # Connect to postgres database
    print("Step 1: Connecting to postgres database...")
    conn_postgres = psycopg2.connect(
        host=RUNTIME_HOST,
        port=RUNTIME_PORT,
        user=RUNTIME_USER,
        password=RUNTIME_PASSWORD,
        database='postgres',
        sslmode='require'
    )
    
    # Get list of tables
    cur = conn_postgres.cursor()
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    
    tables = [row[0] for row in cur.fetchall()]
    cur.close()
    
    print(f"Found {len(tables)} tables to copy")
    
    # Connect to psa_runtime database
    print("Step 2: Connecting to psa_runtime database...")
    conn_psa_runtime = psycopg2.connect(
        host=RUNTIME_HOST,
        port=RUNTIME_PORT,
        user=RUNTIME_USER,
        password=RUNTIME_PASSWORD,
        database='psa_runtime',
        sslmode='require'
    )
    conn_psa_runtime.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    cur_runtime = conn_psa_runtime.cursor()
    
    # Copy each table
    print("Step 3: Copying table structures...")
    for table_name in tables:
        print(f"  Creating table: {table_name}")
        try:
            ddl = get_table_ddl(conn_postgres, table_name)
            if ddl:
                cur_runtime.execute(ddl)
                print(f"    ✓ {table_name}")
            else:
                print(f"    ⚠ {table_name} - no columns found")
        except Exception as e:
            print(f"    ✗ {table_name} - Error: {e}")
    
    cur_runtime.close()
    conn_psa_runtime.close()
    conn_postgres.close()
    
    print("\n✓ Schema copy complete!")
    print("\nNote: This script copies basic table structures.")
    print("You may need to run additional migrations for:")
    print("  - Indexes")
    print("  - Foreign key constraints")
    print("  - Triggers")
    print("  - Functions")
    print("\nRun: db/migrations/20260116_add_source_key_to_citations.sql")

if __name__ == '__main__':
    copy_schema()
