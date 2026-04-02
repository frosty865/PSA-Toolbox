#!/usr/bin/env python3
"""
Copy schema from postgres database to psa_runtime database
Uses PostgreSQL's pg_get_tabledef() equivalent via information_schema
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

def copy_schema():
    """Copy schema from postgres to psa_runtime using pg_dump approach"""
    
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
    conn_postgres.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    
    # Get full CREATE TABLE statements using a query that generates proper DDL
    cur = conn_postgres.cursor()
    
    # Get all CREATE TABLE statements
    cur.execute("""
        SELECT 
            'CREATE TABLE IF NOT EXISTS public.' || quote_ident(table_name) || ' (' || 
            string_agg(
                quote_ident(column_name) || ' ' || 
                CASE 
                    WHEN data_type = 'ARRAY' THEN udt_name || '[]'
                    WHEN data_type = 'USER-DEFINED' THEN udt_name
                    ELSE 
                        CASE 
                            WHEN character_maximum_length IS NOT NULL 
                            THEN data_type || '(' || character_maximum_length || ')'
                            WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
                            THEN data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
                            ELSE data_type
                        END
                END ||
                CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
                CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
                ', '
                ORDER BY ordinal_position
            ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name NOT LIKE 'pg_%'
        GROUP BY table_name
        ORDER BY table_name
    """)
    
    create_statements = cur.fetchall()
    cur.close()
    
    print(f"Found {len(create_statements)} tables to create")
    
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
    
    # Execute CREATE TABLE statements
    print("Step 3: Creating tables...")
    success_count = 0
    error_count = 0
    
    for (create_stmt,) in create_statements:
        # Extract table name for logging
        table_name = create_stmt.split('public.')[1].split('(')[0].strip()
        print(f"  Creating: {table_name}")
        
        try:
            cur_runtime.execute(create_stmt)
            success_count += 1
            print(f"    ✓ {table_name}")
        except Exception as e:
            error_count += 1
            error_msg = str(e).split('\n')[0]  # First line only
            print(f"    ✗ {table_name} - {error_msg}")
    
    cur_runtime.close()
    conn_psa_runtime.close()
    conn_postgres.close()
    
    print(f"\n✓ Schema copy complete! ({success_count} succeeded, {error_count} had errors)")
    print("\nNote: Some tables may need sequences, indexes, or constraints.")
    print("The critical 'assessments' table should now exist.")
    print("\nNext steps:")
    print("1. Verify: SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    print("2. Run migrations: db/migrations/20260116_add_source_key_to_citations.sql")

if __name__ == '__main__':
    copy_schema()
