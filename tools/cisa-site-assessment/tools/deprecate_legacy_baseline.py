#!/usr/bin/env python3
"""
Deprecate Legacy Baseline Questions

Non-destructively flags legacy baseline questions (BASE-### pattern) as deprecated.
Preserves historical assessments and answers.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
import psycopg2

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import guard_write, require_target_from_cli_or_env
from app.db.db_targets import normalize_target
from app.importers.baseline_canon_mapping_lock import load_lock


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


def get_db_connection():
    """Get database connection from DATABASE_URL."""
    load_env_file('.env.local')
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment')
    
    if 'supabase' in database_url:
        if '?sslmode=' not in database_url:
            database_url += '?sslmode=require'
    
    return psycopg2.connect(database_url)


def get_mapping_from_lock_or_detect(conn) -> Dict[str, Any]:
    """Get mapping from lock file if available, otherwise detect from schema."""
    lock_doc = load_lock()
    if lock_doc:
        return lock_doc['mapping']
    
    # Fallback: detect from schema
    from app.importers.baseline_canon_mapper import probe_question_tables, detect_question_text_column, detect_code_column
    
    tables = probe_question_tables(conn)
    
    # Try baseline_questions table first
    baseline_table = None
    for table in tables:
        if 'baseline' in table['name'].lower() and 'question' in table['name'].lower():
            baseline_table = table
            break
    
    if baseline_table:
        text_col = detect_question_text_column(baseline_table['columns'])
        code_col = detect_code_column(baseline_table['columns'])
        
        if text_col and code_col:
            return {
                'pattern': 'BASELINE_QUESTIONS',
                'table': baseline_table['name'],
                'columns': {
                    'code': code_col,
                    'text': text_col
                }
            }
    
    # Try single questions table
    for table in tables:
        text_col = detect_question_text_column(table['columns'])
        code_col = detect_code_column(table['columns'])
        
        if text_col and code_col:
            return {
                'pattern': 'SINGLE_QUESTIONS_TABLE',
                'table': table['name'],
                'columns': {
                    'code': code_col,
                    'text': text_col
                }
            }
    
    raise RuntimeError("Cannot detect question table mapping. Run import_baseline_canon to create lock.")


def detect_deprecation_field(conn, table: str) -> Optional[str]:
    """
    Detect deprecation field in table.
    
    Returns:
        Column name if found, None otherwise
    """
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = %s
            AND (
                column_name ILIKE '%deprecated%' 
                OR column_name ILIKE '%is_active%'
                OR column_name ILIKE '%status%'
            )
            ORDER BY 
                CASE 
                    WHEN column_name ILIKE '%deprecated%' THEN 1
                    WHEN column_name ILIKE '%is_active%' THEN 2
                    WHEN column_name ILIKE '%status%' THEN 3
                END
            LIMIT 1
        """, (table,))
        
        row = cur.fetchone()
        if row:
            return row[0]
        return None
    finally:
        cur.close()


def find_legacy_questions(conn, mapping: Dict) -> List[Dict[str, Any]]:
    """
    Find legacy baseline questions matching BASE-### pattern.
    
    Returns:
        List of question dictionaries with code and text
    """
    table = mapping['table']
    code_col = mapping['columns']['code']
    text_col = mapping['columns']['text']
    
    cur = conn.cursor()
    try:
        # Legacy pattern: BASE- followed by digits
        legacy_pattern = r'^BASE-\d+$'
        
        cur.execute(f"""
            SELECT {code_col}, {text_col}
            FROM {table}
            WHERE {code_col} ~ %s
            ORDER BY {code_col}
        """, (legacy_pattern,))
        
        questions = []
        for row in cur.fetchall():
            questions.append({
                'code': row[0],
                'text': row[1]
            })
        
        return questions
    finally:
        cur.close()


def build_deprecation_plan(conn, mapping: Dict, deprecation_field: str) -> Dict[str, Any]:
    """
    Build deprecation plan.
    
    Returns:
        Plan dictionary with candidates and operations
    """
    legacy_questions = find_legacy_questions(conn, mapping)
    
    plan = {
        'detected_table': mapping['table'],
        'deprecation_field': deprecation_field,
        'total_candidates': len(legacy_questions),
        'would_deprecate': legacy_questions[:50],  # Sample of first 50
        'all_candidates': legacy_questions if len(legacy_questions) <= 100 else None
    }
    
    return plan


def execute_deprecation(conn, plan: Dict, mapping: Dict) -> Dict[str, Any]:
    """
    Execute deprecation (only if --apply).
    
    Returns:
        Result dictionary with counts
    """
    table = mapping['table']
    code_col = mapping['columns']['code']
    deprecation_field = plan['deprecation_field']
    
    cur = conn.cursor()
    try:
        # Determine update value based on field type
        cur.execute("""
            SELECT data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = %s
            AND column_name = %s
        """, (table, deprecation_field))
        
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"Deprecation field {deprecation_field} not found in table {table}")
        
        data_type = row[0]
        
        # Build update query
        if 'is_active' in deprecation_field.lower():
            # Boolean field: set to FALSE
            update_value = False
        elif 'deprecated' in deprecation_field.lower():
            # Boolean field: set to TRUE
            update_value = True
        elif 'status' in deprecation_field.lower():
            # Text field: set to 'deprecated'
            update_value = 'deprecated'
        else:
            # Default: assume boolean, set to TRUE for deprecated
            update_value = True
        
        # Get all legacy question codes
        legacy_pattern = r'^BASE-\d+$'
        cur.execute(f"""
            SELECT {code_col}
            FROM {table}
            WHERE {code_col} ~ %s
        """, (legacy_pattern,))
        
        codes = [row[0] for row in cur.fetchall()]
        
        if not codes:
            return {
                'deprecated': 0,
                'errors': []
            }
        
        # Update in batches
        deprecated = 0
        errors = []
        
        for code in codes:
            try:
                if isinstance(update_value, bool):
                    cur.execute(f"""
                        UPDATE {table}
                        SET {deprecation_field} = %s
                        WHERE {code_col} = %s
                    """, (update_value, code))
                else:
                    cur.execute(f"""
                        UPDATE {table}
                        SET {deprecation_field} = %s
                        WHERE {code_col} = %s
                    """, (update_value, code))
                
                deprecated += 1
            except Exception as e:
                errors.append({
                    'code': code,
                    'error': str(e)
                })
        
        conn.commit()
        
        return {
            'deprecated': deprecated,
            'errors': errors
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()


def main():
    parser = argparse.ArgumentParser(
        description="Deprecate Legacy Baseline Questions (RUNTIME database only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This tool flags legacy baseline questions (BASE-### pattern) as deprecated.
Preserves historical assessments and answers.

Examples:
  python tools/deprecate_legacy_baseline.py --target runtime --dry-run
  python tools/deprecate_legacy_baseline.py --target runtime --apply
        """
    )
    
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (must be "runtime" for this tool). Can also be set via PSA_DB_TARGET env var.'
    )
    
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply deprecation to database (default: dry-run only, no writes)'
    )
    
    parser.add_argument(
        '--i-understand-this-writes',
        action='store_true',
        help='Explicit confirmation flag required when using --apply'
    )
    
    parser.add_argument(
        '--plan-out',
        type=str,
        default='analytics/reports/legacy_deprecation_plan.json',
        help='Output path for deprecation plan JSON (default: analytics/reports/legacy_deprecation_plan.json)'
    )
    
    args = parser.parse_args()
    
    # Require explicit confirmation flag for apply
    if args.apply and not args.i_understand_this_writes:
        print("ERROR: --apply requires --i-understand-this-writes flag", file=sys.stderr)
        print("This is a safety guard to prevent accidental writes.", file=sys.stderr)
        sys.exit(2)
    
    # Resolve and validate target
    target = require_target_from_cli_or_env(args.target)
    if target != 'runtime':
        print("ERROR: This tool MUST target the RUNTIME database only.", file=sys.stderr)
        print(f"Received target: {target}", file=sys.stderr)
        sys.exit(2)
    
    # Guard write (validates RUNTIME connection)
    guard_write(target)
    
    # Determine dry-run mode
    dry_run = not args.apply
    
    print("="*80)
    print("Legacy Baseline Deprecation Tool")
    print("="*80)
    print()
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"Target: {target}")
    print()
    
    # Connect to database
    print("Connecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Resolve mapping
    print("Resolving schema mapping...")
    try:
        mapping = get_mapping_from_lock_or_detect(conn)
        print(f"✓ Detected table: {mapping['table']}")
    except Exception as e:
        print(f"ERROR: Failed to resolve schema mapping: {e}", file=sys.stderr)
        conn.close()
        sys.exit(1)
    
    # Detect deprecation field
    print("Detecting deprecation field...")
    deprecation_field = detect_deprecation_field(conn, mapping['table'])
    
    if not deprecation_field:
        print("ERROR: No deprecation field found in table.", file=sys.stderr)
        print("  Expected one of: deprecated, is_active, status", file=sys.stderr)
        print("  Add schema support before proceeding.", file=sys.stderr)
        conn.close()
        sys.exit(1)
    
    print(f"✓ Using deprecation field: {deprecation_field}")
    
    # Build deprecation plan
    print("Building deprecation plan...")
    plan = build_deprecation_plan(conn, mapping, deprecation_field)
    
    print(f"✓ Found {plan['total_candidates']} legacy questions")
    
    # Print summary
    print()
    print("Deprecation Plan Summary:")
    print(f"  Total candidates: {plan['total_candidates']}")
    print(f"  Deprecation field: {plan['deprecation_field']}")
    
    if plan['total_candidates'] > 0:
        print()
        print("Sample candidates (first 10):")
        for q in plan['would_deprecate'][:10]:
            print(f"  - {q['code']}: {q['text'][:60]}...")
    
    # Write plan JSON
    plan_path = Path(args.plan_out)
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    
    plan_output = {
        'generated_at': datetime.now().isoformat(),
        'dry_run': dry_run,
        'detected_table': plan['detected_table'],
        'deprecation_field': plan['deprecation_field'],
        'total_candidates': plan['total_candidates'],
        'sample_candidates': plan['would_deprecate'],
        'all_candidates': plan['all_candidates']
    }
    
    with open(plan_path, 'w', encoding='utf-8') as f:
        json.dump(plan_output, f, indent=2)
    
    print()
    print(f"✓ Plan written to: {plan_path}")
    
    # Execute deprecation if --apply
    if args.apply:
        print()
        print("="*80)
        print("EXECUTING DEPRECATION")
        print("="*80)
        
        try:
            result = execute_deprecation(conn, plan, mapping)
            print(f"✓ Deprecation complete:")
            print(f"  Deprecated: {result['deprecated']}")
            if result['errors']:
                print(f"  Errors: {len(result['errors'])}")
                for err in result['errors'][:10]:
                    print(f"    - {err['code']}: {err['error']}")
        except Exception as e:
            print(f"ERROR: Deprecation failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            conn.close()
            sys.exit(1)
    else:
        print()
        print("⚠️  DRY RUN complete. Use --apply to write changes to database.")
    
    conn.close()
    print()
    print("✅ Complete")


if __name__ == '__main__':
    main()
