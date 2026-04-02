#!/usr/bin/env python3
"""
Verify Runtime Baseline Selection

Verifies that new assessments use ONLY canon baseline questions (not BASE-###).
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


def get_most_recent_assessment(conn) -> Optional[str]:
    """Get the most recently created assessment ID."""
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id
            FROM public.assessments
            ORDER BY created_at DESC
            LIMIT 1
        """)
        row = cur.fetchone()
        if row:
            return row[0]
        return None
    finally:
        cur.close()


def get_assessment_question_universe(conn, assessment_id: str, mapping: Dict) -> List[Dict[str, Any]]:
    """
    Get question universe for an assessment.
    Joins to questions table to get codes.
    """
    cur = conn.cursor()
    
    try:
        # Check if assessment_question_universe table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'assessment_question_universe'
            )
        """)
        universe_exists = cur.fetchone()[0]
        
        if not universe_exists:
            return []
        
        # Get question codes from universe
        cur.execute("""
            SELECT question_code, layer, order_index
            FROM public.assessment_question_universe
            WHERE assessment_id = %s
            AND layer = 'BASELINE_CORE'
            ORDER BY order_index
        """, (assessment_id,))
        
        question_codes = [row[0] for row in cur.fetchall()]
        
        if not question_codes:
            return []
        
        # Join to questions table to get full question info
        table = mapping['table']
        code_col = mapping['columns']['code']
        text_col = mapping['columns']['text']
        
        # Build IN clause safely
        placeholders = ','.join(['%s'] * len(question_codes))
        cur.execute(f"""
            SELECT {code_col}, {text_col}
            FROM {table}
            WHERE {code_col} IN ({placeholders})
        """, question_codes)
        
        questions = []
        for row in cur.fetchall():
            questions.append({
                'code': row[0],
                'text': row[1]
            })
        
        return questions
        
    finally:
        cur.close()


def verify_baseline_selection(conn, assessment_id: str, mapping: Dict) -> Dict[str, Any]:
    """
    Verify baseline selection for an assessment.
    
    Returns:
        Verification report dictionary
    """
    # Get baseline questions from universe
    baseline_questions = get_assessment_question_universe(conn, assessment_id, mapping)
    
    total_baseline = len(baseline_questions)
    
    # Count legacy BASE-### questions (must be 0)
    legacy_pattern = r'^BASE-\d+$'
    legacy_count = 0
    legacy_codes = []
    for q in baseline_questions:
        if re.match(legacy_pattern, q['code']):
            legacy_count += 1
            legacy_codes.append(q['code'])
    
    # Count canon questions (pattern: 3-4 letter prefix, dash, number)
    canon_pattern = r'^[A-Z]{3,4}-\d+$'
    canon_count = 0
    canon_codes = []
    for q in baseline_questions:
        if re.match(canon_pattern, q['code']):
            canon_count += 1
            canon_codes.append(q['code'])
    
    # Verify pass conditions
    verify_pass = (
        legacy_count == 0 and
        canon_count > 0 and
        total_baseline > 0
    )
    
    return {
        'verify_pass': verify_pass,
        'assessment_id': assessment_id,
        'total_baseline_questions': total_baseline,
        'legacy_count': legacy_count,
        'legacy_codes': legacy_codes,
        'canon_count': canon_count,
        'canon_codes_sample': canon_codes[:20],  # Sample of first 20
        'mapping_used': mapping
    }


def main():
    parser = argparse.ArgumentParser(
        description="Verify Runtime Baseline Selection (RUNTIME database only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This tool verifies that new assessments use ONLY canon baseline questions.

Examples:
  python tools/verify_runtime_baseline_selection.py --target runtime
  python tools/verify_runtime_baseline_selection.py --target runtime --assessment-id <uuid>
        """
    )
    
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (must be "runtime" for this tool). Can also be set via PSA_DB_TARGET env var.'
    )
    
    parser.add_argument(
        '--assessment-id',
        type=str,
        help='Assessment ID to verify (default: most recently created)'
    )
    
    parser.add_argument(
        '--report-out',
        type=str,
        default='analytics/reports/runtime_baseline_selection_verify.json',
        help='Output path for verification report JSON'
    )
    
    args = parser.parse_args()
    
    # Resolve and validate target
    target = require_target_from_cli_or_env(args.target)
    if target != 'runtime':
        print("ERROR: This tool MUST target the RUNTIME database only.", file=sys.stderr)
        print(f"Received target: {target}", file=sys.stderr)
        sys.exit(2)
    
    # Guard write (validates RUNTIME connection)
    guard_write(target)
    
    print("="*80)
    print("Runtime Baseline Selection Verification")
    print("="*80)
    print()
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
    
    # Get assessment ID
    if args.assessment_id:
        assessment_id = args.assessment_id
        print(f"Using provided assessment ID: {assessment_id}")
    else:
        print("Finding most recent assessment...")
        assessment_id = get_most_recent_assessment(conn)
        if not assessment_id:
            print("ERROR: No assessments found in database.", file=sys.stderr)
            conn.close()
            sys.exit(1)
        print(f"✓ Found assessment: {assessment_id}")
    
    # Verify baseline selection
    print()
    print("Verifying baseline selection...")
    verify_report = verify_baseline_selection(conn, assessment_id, mapping)
    
    # Print summary
    print()
    print("Verification Summary:")
    print(f"  Assessment ID: {verify_report['assessment_id']}")
    print(f"  Total baseline questions: {verify_report['total_baseline_questions']}")
    print(f"  Legacy BASE-### count: {verify_report['legacy_count']} (must be 0)")
    print(f"  Canon questions count: {verify_report['canon_count']} (must be >0)")
    
    if verify_report['legacy_codes']:
        print(f"  Legacy codes found: {verify_report['legacy_codes'][:10]}")
        if len(verify_report['legacy_codes']) > 10:
            print(f"  ... and {len(verify_report['legacy_codes']) - 10} more")
    
    if verify_report['canon_codes_sample']:
        print(f"  Canon codes sample: {verify_report['canon_codes_sample'][:10]}")
    
    # Write report
    report_path = Path(args.report_out)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    report_output = {
        'generated_at': datetime.now().isoformat(),
        'verify_pass': verify_report['verify_pass'],
        'assessment_id': verify_report['assessment_id'],
        'total_baseline_questions': verify_report['total_baseline_questions'],
        'legacy_count': verify_report['legacy_count'],
        'legacy_codes': verify_report['legacy_codes'],
        'canon_count': verify_report['canon_count'],
        'canon_codes_sample': verify_report['canon_codes_sample'],
        'mapping_used': verify_report['mapping_used']
    }
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report_output, f, indent=2)
    
    print()
    print(f"✓ Report written to: {report_path}")
    
    # Print final result
    print()
    if verify_report['verify_pass']:
        print("✅ VERIFY PASS")
        print("  New assessments are using canon baseline only.")
    else:
        print("❌ VERIFY FAIL")
        if verify_report['legacy_count'] > 0:
            print(f"  Found {verify_report['legacy_count']} legacy BASE-### questions (must be 0)")
        if verify_report['canon_count'] == 0:
            print("  Found 0 canon questions (must be >0)")
        sys.exit(1)
    
    conn.close()
    print()
    print("✅ Complete")


if __name__ == '__main__':
    main()
