#!/usr/bin/env python3
"""
Run SQL file against CORPUS database

Executes a SQL file against the CORPUS database.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

def run_sql_file(sql_file: str):
    """Run SQL file against CORPUS database."""
    if not os.path.exists(sql_file):
        raise FileNotFoundError(f"SQL file not found: {sql_file}")
    
    print(f"Reading SQL file: {sql_file}")
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Connecting to CORPUS database...")
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        print("Executing SQL...")
        # Split by semicolons and execute each statement
        import re
        
        # Extract dollar-quoted blocks first
        dollar_quoted_pattern = r'\$[a-zA-Z_]*\$.*?\$[a-zA-Z_]*\$'
        dollar_blocks = []
        def replace_dollar_block(match):
            block_id = len(dollar_blocks)
            dollar_blocks.append(match.group(0))
            return f'__DOLLAR_BLOCK_{block_id}__'
        
        sql_with_placeholders = re.sub(dollar_quoted_pattern, replace_dollar_block, sql_content, flags=re.DOTALL)
        
        # Split by semicolons
        statements = re.split(r';\s*\n', sql_with_placeholders)
        
        # Restore dollar-quoted blocks
        for i, stmt in enumerate(statements):
            for j, block in enumerate(dollar_blocks):
                stmt = stmt.replace(f'__DOLLAR_BLOCK_{j}__', block)
            statements[i] = stmt.strip()
        
        # Execute each statement
        for i, stmt in enumerate(statements, 1):
            stmt = stmt.strip()
            if not stmt or stmt.startswith('--'):
                continue
            
            try:
                is_select = stmt.strip().upper().startswith('SELECT')
                cur.execute(stmt)
                
                # For SELECT statements, fetch and print results BEFORE commit
                if is_select:
                    rows = cur.fetchall()
                    if rows:
                        # Get column names
                        colnames = [desc[0] for desc in cur.description]
                        print(f"\n📊 Query {i} results ({len(rows)} rows):")
                        # Print header
                        header = " | ".join(f"{c:20}" for c in colnames)
                        print("  " + header)
                        print("  " + "-" * len(header))
                        # Print rows
                        for row in rows[:10]:  # Show first 10 rows
                            row_str = " | ".join(f"{str(v)[:20] if v is not None else 'NULL':20}" for v in row)
                            print("  " + row_str)
                        if len(rows) > 10:
                            print(f"  ... and {len(rows) - 10} more rows")
                    else:
                        print(f"\n📊 Query {i}: No rows returned")
                else:
                    # For non-SELECT, commit the transaction
                    conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"❌ Error executing statement {i}: {e}")
                print(f"  Statement: {stmt[:200]}...")
                raise
        
        print("\n✅ SQL executed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ SQL execution failed: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python tools/run_corpus_sql.py <sql_file.sql>")
        sys.exit(1)
    
    sql_file = sys.argv[1]
    try:
        run_sql_file(sql_file)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
