#!/usr/bin/env python3
"""
Run Corpus Documents Migration

Executes the corpus_documents migration SQL file.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

def run_migration():
    """Run the corpus_documents migration."""
    migration_file = Path(__file__).parent.parent / 'db' / 'migrations' / '20260118_create_corpus_documents.sql'
    
    if not migration_file.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_file}")
    
    print(f"Reading migration file: {migration_file}")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Connecting to CORPUS database...")
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        print("Executing migration...")
        # Use psycopg2's execute_batch for multiple statements
        # But first, let's try a simpler approach: execute the entire SQL as-is
        # psycopg2 execute() can handle multiple statements if we use execute_batch
        # But for DDL, we need to execute them one by one
        
        # Extract DO block manually by reading lines
        # The DO block spans from line with "DO $$" to line with "END $$;"
        lines = sql_content.split('\n')
        do_start_line = None
        do_end_line = None
        
        for i, line in enumerate(lines):
            stripped = line.strip().upper()
            if 'DO $$' in stripped and do_start_line is None:
                do_start_line = i
            if do_start_line is not None and 'END $$' in stripped and ';' in line:
                do_end_line = i
                break
        
        do_block = None
        sql_without_do = sql_content
        
        if do_start_line is not None and do_end_line is not None:
            # Extract DO block (including the END $$; line) - preserve original line endings
            do_block_lines = lines[do_start_line:do_end_line + 1]
            do_block = ''.join(do_block_lines)  # Preserve original line endings
            
            print(f"  Extracted DO block: lines {do_start_line+1}-{do_end_line+1}, length {len(do_block)} chars")
            print(f"  DO block ends with: {do_block[-50:]}")
            
            # Remove DO block from SQL
            before_do = ''.join(lines[:do_start_line])
            after_do = ''.join(lines[do_end_line + 1:])
            sql_without_do = before_do + after_do
        
        # Split remaining SQL by semicolons (safe now that DO block is removed)
        # But preserve dollar-quoted strings ($func$, etc.)
        import re
        
        # First, extract dollar-quoted blocks and replace with placeholders
        dollar_quoted_pattern = r'\$[a-zA-Z_]*\$.*?\$[a-zA-Z_]*\$'
        dollar_blocks = []
        def replace_dollar_block(match):
            block_id = len(dollar_blocks)
            dollar_blocks.append(match.group(0))
            return f'__DOLLAR_BLOCK_{block_id}__'
        
        sql_with_placeholders = re.sub(dollar_quoted_pattern, replace_dollar_block, sql_without_do, flags=re.DOTALL)
        
        # Now split by semicolons
        statements = re.split(r';\s*(?=\n)', sql_with_placeholders)
        
        # Restore dollar-quoted blocks
        for i, stmt in enumerate(statements):
            for j, block in enumerate(dollar_blocks):
                stmt = stmt.replace(f'__DOLLAR_BLOCK_{j}__', block)
            statements[i] = stmt.strip()
        
        statements = [s + ';' if s and not s.endswith(';') else s for s in statements if s.strip()]
        
        # Filter: keep only statements with SQL keywords
        filtered_statements = []
        for s in statements:
            if any(kw in s.upper() for kw in ['CREATE', 'COMMENT', 'INDEX', 'VIEW', 'ALTER', 'DROP']):
                filtered_statements.append(s.rstrip(';'))  # Remove trailing semicolon
        
        # Insert DO block before the view creation (or at end)
        # Make sure DO block is complete and not split
        if do_block:
            # Verify DO block is complete
            if not do_block.rstrip().endswith('END $$;'):
                # Try to get complete block from original SQL
                do_start_pos = sql_content.find('DO $$')
                if do_start_pos != -1:
                    # Find the last END $$; (should be the one closing DO $$)
                    all_ends = []
                    pos = do_start_pos
                    while True:
                        end_pos = sql_content.find('END $$;', pos)
                        if end_pos == -1:
                            break
                        all_ends.append(end_pos)
                        pos = end_pos + 7
                    
                    if all_ends:
                        # Use the last END $$; (closes the DO block)
                        final_end = all_ends[-1]
                        complete_do = sql_content[do_start_pos:final_end + 7]
                        if len(complete_do) > len(do_block):
                            do_block = complete_do
                            print(f"  Fixed DO block: now {len(do_block)} chars")
            
            # Find where to insert (before CREATE VIEW or at end)
            insert_idx = len(filtered_statements)
            for i, stmt in enumerate(filtered_statements):
                if 'CREATE' in stmt.upper() and 'VIEW' in stmt.upper():
                    insert_idx = i
                    break
            filtered_statements.insert(insert_idx, do_block)
        
        statements = filtered_statements
        
        # Execute each statement
        print(f"Found {len(statements)} statements to execute")
        for i, stmt in enumerate(statements, 1):
            stmt = stmt.strip()
            # Skip empty statements
            if not stmt:
                continue
                
            try:
                # Print first 100 chars for debugging
                stmt_preview = stmt[:100].replace('\n', ' ')
                if 'CREATE' in stmt.upper() or 'DO' in stmt.upper() or 'COMMENT' in stmt.upper() or 'INDEX' in stmt.upper() or 'VIEW' in stmt.upper():
                    print(f"  [{i}/{len(statements)}] Executing: {stmt_preview}...")
                
                # For DO blocks, use the extracted complete block
                if stmt.strip().startswith('DO $$') and do_block:
                    # Always use the complete DO block we extracted
                    stmt = do_block
                    print(f"  Using complete DO block ({len(stmt)} chars)")
                
                cur.execute(stmt)
                conn.commit()
                if 'CREATE' in stmt.upper() or 'DO' in stmt.upper() or 'COMMENT' in stmt.upper() or 'INDEX' in stmt.upper() or 'VIEW' in stmt.upper():
                    print(f"  ✓ Statement {i} executed successfully")
            except Exception as e:
                error_msg = str(e).lower()
                conn.rollback()
                # Skip if already exists
                if 'already exists' in error_msg or 'duplicate' in error_msg:
                    print(f"  ⚠️  Statement {i} already executed (skipping)")
                    conn.commit()
                else:
                    print(f"  ❌ Error executing statement {i}: {e}")
                    print(f"  Statement length: {len(stmt)}")
                    print(f"  Statement preview: {stmt[:500]}")
                    if stmt.strip().startswith('DO $$'):
                        print(f"  DO block ends with: {stmt[-100:]}")
                    raise
        
        conn.commit()
        print("✅ Migration executed successfully!")
        
        # Verify table exists
        cur.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'corpus_documents'
        """)
        if cur.fetchone()[0] > 0:
            print("  ✓ corpus_documents table exists")
        else:
            print("  ✗ corpus_documents table not found")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    try:
        run_migration()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
