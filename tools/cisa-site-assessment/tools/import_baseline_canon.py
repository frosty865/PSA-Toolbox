#!/usr/bin/env python3
"""
Import Baseline Canonical Data

This tool imports baseline canonical spines from psa_engine into the RUNTIME database.
This tool MUST target the RUNTIME database only.

Imports baseline SPINE questions only (components are out of scope).
"""

import argparse
import json
import os
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
from app.importers.baseline_canon_mapper import (
    load_canon_spines,
    resolve_mapping,
    get_db_connection
)
from app.importers.baseline_canon_mapping_lock import (
    load_lock,
    save_lock,
    LOCK_PATH
)


def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()


def validate_canon_question(question: Dict) -> tuple[bool, Optional[str]]:
    """Validate a canon question has required fields and correct response_enum."""
    # Required fields
    if 'canon_id' not in question or not question['canon_id']:
        return False, "Missing required field: canon_id"
    
    if 'text' not in question or not question['text']:
        return False, "Missing required field: text"
    
    # Validate response_enum
    response_enum = question.get('response_enum', ["YES", "NO", "N_A"])
    if response_enum != ["YES", "NO", "N_A"]:
        return False, f"Invalid response_enum: {response_enum}. Must be ['YES', 'NO', 'N_A']"
    
    return True, None


def check_existing_question(conn, mapping: Dict, canon_id: str) -> Optional[Dict]:
    """Check if a question already exists in the database."""
    cur = conn.cursor()
    
    try:
        table = mapping['table']
        code_col = mapping['columns']['code']
        
        cur.execute(f"""
            SELECT {code_col}, {mapping['columns']['text']}
            FROM {table}
            WHERE {code_col} = %s
            LIMIT 1
        """, (canon_id,))
        
        row = cur.fetchone()
        if row:
            return {
                'code': row[0],
                'text': row[1]
            }
        return None
        
    finally:
        cur.close()


def build_import_plan(canon_spines: List[Dict], mapping: Dict, conn) -> Dict[str, Any]:
    """Build import plan by checking what exists and what would change."""
    plan = {
        'detected_table': mapping['table'],
        'mapping': mapping,
        'operations': [],
        'counts': {
            'total': 0,
            'inserts': 0,
            'updates': 0,
            'unchanged': 0,
            'errors': 0
        },
        'errors': []
    }
    
    # Validate all questions first
    for question in canon_spines:
        is_valid, error_msg = validate_canon_question(question)
        if not is_valid:
            plan['counts']['errors'] += 1
            plan['errors'].append({
                'canon_id': question.get('canon_id', 'UNKNOWN'),
                'error': error_msg
            })
            continue
        
        plan['counts']['total'] += 1
        canon_id = question['canon_id']
        canon_text = question['text']
        
        # Check if exists
        existing = check_existing_question(conn, mapping, canon_id)
        
        # Extract optional fields
        discipline_code = question.get('discipline_code')
        subtype_code = question.get('subtype_code')
        
        if existing:
            if existing['text'] != canon_text:
                # Would update
                plan['counts']['updates'] += 1
                plan['operations'].append({
                    'canon_id': canon_id,
                    'action': 'UPDATE',
                    'current_text': existing['text'],
                    'new_text': canon_text,
                    'discipline_code': discipline_code,
                    'subtype_code': subtype_code
                })
            else:
                # Unchanged
                plan['counts']['unchanged'] += 1
                plan['operations'].append({
                    'canon_id': canon_id,
                    'action': 'UNCHANGED',
                    'text': canon_text,
                    'discipline_code': discipline_code,
                    'subtype_code': subtype_code
                })
        else:
            # Would insert
            plan['counts']['inserts'] += 1
            plan['operations'].append({
                'canon_id': canon_id,
                'action': 'INSERT',
                'text': canon_text,
                'discipline_code': discipline_code,
                'subtype_code': subtype_code
            })
    
    return plan


def validate_plan(plan: Dict) -> tuple[bool, List[str]]:
    """Validate import plan for sanity checks."""
    errors = []
    
    # Check 1: No duplicate canon_id in plan
    canon_ids = [op['canon_id'] for op in plan['operations']]
    duplicates = [cid for cid in canon_ids if canon_ids.count(cid) > 1]
    if duplicates:
        errors.append(f"Duplicate canon_id found in plan: {set(duplicates)}")
    
    # Check 2: All operations should have valid canon_id
    for op in plan['operations']:
        if not op.get('canon_id'):
            errors.append(f"Operation missing canon_id: {op}")
    
    return len(errors) == 0, errors


def execute_import(conn, plan: Dict, mapping: Dict) -> Dict[str, Any]:
    """
    Execute the import plan (only called when --apply is set).
    All writes are wrapped in a single transaction.
    """
    cur = conn.cursor()
    
    try:
        # Transaction is automatically started by psycopg2 (autocommit=False)
        # All operations will be in a single transaction
        
        table = mapping['table']
        code_col = mapping['columns']['code']
        text_col = mapping['columns']['text']
        response_enum_col = mapping['columns'].get('response_enum')
        discipline_code_col = mapping['columns'].get('discipline_code')
        subtype_code_col = mapping['columns'].get('subtype_code')
        
        # Check for discipline and subdiscipline columns (required for baseline_questions table)
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
        """, (table,))
        table_columns = [row[0] for row in cur.fetchall()]
        has_discipline_col = 'discipline' in table_columns
        has_subdiscipline_col = 'subdiscipline' in table_columns
        has_question_order_col = 'question_order' in table_columns
        
        inserted = 0
        updated = 0
        errors = []
        order_index = 1  # Sequential order for question_order column
        
        for op in plan['operations']:
            if op['action'] == 'ERROR':
                continue
            
            canon_id = op['canon_id']
            text = op.get('new_text') or op.get('text')
            
            # Build column list and values
            columns = [code_col, text_col]
            values = [canon_id, text]
            placeholders = ['%s', '%s']
            
            # Add discipline column (required for baseline_questions table)
            # Only add if not already included via discipline_code_col mapping
            if has_discipline_col and 'discipline' not in columns:
                discipline_value = op.get('discipline_code') or 'UNKNOWN'
                columns.append('discipline')
                values.append(discipline_value)
                placeholders.append('%s')
            
            # Add subdiscipline column (required for baseline_questions table)
            # Only add if not already included via subtype_code_col mapping
            if has_subdiscipline_col and 'subdiscipline' not in columns:
                subdiscipline_value = op.get('subtype_code') or 'UNKNOWN'
                columns.append('subdiscipline')
                values.append(subdiscipline_value)
                placeholders.append('%s')
            
            # Add question_order column if it exists (required for baseline_questions table)
            if has_question_order_col:
                columns.append('question_order')
                values.append(order_index)
                placeholders.append('%s')
                order_index += 1
            
            # Add response_enum if column exists
            if response_enum_col:
                columns.append(response_enum_col)
                values.append(mapping['fixed_values'].get('response_enum') or ["YES", "NO", "N_A"])
                placeholders.append('%s')
            
            # Add discipline_code if column exists and available (separate from discipline)
            if discipline_code_col and op.get('discipline_code') and 'discipline_code' in table_columns and not has_discipline_col:
                columns.append(discipline_code_col)
                values.append(op['discipline_code'])
                placeholders.append('%s')
            
            # Add subtype_code if column exists and available (separate from subdiscipline)
            if subtype_code_col and op.get('subtype_code') and 'subtype_code' in table_columns and not has_subdiscipline_col:
                columns.append(subtype_code_col)
                values.append(op['subtype_code'])
                placeholders.append('%s')
            
            try:
                if op['action'] == 'INSERT':
                    # Insert
                    query = f"""
                        INSERT INTO {table} ({', '.join(columns)})
                        VALUES ({', '.join(placeholders)})
                    """
                    cur.execute(query, values)
                    inserted += 1
                    
                elif op['action'] == 'UPDATE':
                    # Update
                    set_clauses = [f"{text_col} = %s"]
                    update_values = [text]
                    
                    if response_enum_col:
                        set_clauses.append(f"{response_enum_col} = %s")
                        update_values.append(mapping['fixed_values'].get('response_enum') or ["YES", "NO", "N_A"])
                    
                    update_values.append(canon_id)  # For WHERE clause
                    
                    query = f"""
                        UPDATE {table}
                        SET {', '.join(set_clauses)}
                        WHERE {code_col} = %s
                    """
                    cur.execute(query, update_values)
                    updated += 1
                
            except Exception as e:
                errors.append({
                    'canon_id': canon_id,
                    'action': op['action'],
                    'error': str(e)
                })
        
        # Commit transaction
        conn.commit()
        
        return {
            'inserted': inserted,
            'updated': updated,
            'errors': errors
        }
        
    except Exception as e:
        # Rollback on any error
        conn.rollback()
        raise
    finally:
        cur.close()


def verify_post_apply(conn, canon_spines: List[Dict], mapping: Dict, result: Dict) -> Dict[str, Any]:
    """
    Post-apply verification: check that all canon questions are present.
    
    Returns:
        Verification report dictionary
    """
    table = mapping['table']
    code_col = mapping['columns']['code']
    text_col = mapping['columns']['text']
    response_enum_col = mapping['columns'].get('response_enum')
    
    cur = conn.cursor()
    
    try:
        # Get expected canon IDs
        expected_canon_ids = [q['canon_id'] for q in canon_spines]
        expected_count = len(expected_canon_ids)
        
        # Count canon questions in DB (pattern: 3-5 letter prefix, dash, number, e.g., PER-1, ACS-1, CPTED-1)
        canon_pattern = r'^[A-Z]{3,5}-\d+$'
        cur.execute(f"""
            SELECT COUNT(*)
            FROM {table}
            WHERE {code_col} ~ %s
        """, (canon_pattern,))
        found_count = cur.fetchone()[0]
        
        # Check first 20 canon IDs exist
        sample_ids = expected_canon_ids[:20]
        missing_ids = []
        
        for canon_id in sample_ids:
            cur.execute(f"""
                SELECT COUNT(*)
                FROM {table}
                WHERE {code_col} = %s
            """, (canon_id,))
            if cur.fetchone()[0] == 0:
                missing_ids.append(canon_id)
        
        # Check all canon IDs exist
        all_missing = []
        for canon_id in expected_canon_ids:
            cur.execute(f"""
                SELECT COUNT(*)
                FROM {table}
                WHERE {code_col} = %s
            """, (canon_id,))
            if cur.fetchone()[0] == 0:
                all_missing.append(canon_id)
        
        # Check response_enum if column exists
        response_enum_status = None
        if response_enum_col:
            # Sample check: verify first 10 have correct response_enum
            sample_checked = 0
            sample_correct = 0
            for canon_id in expected_canon_ids[:10]:
                cur.execute(f"""
                    SELECT {response_enum_col}
                    FROM {table}
                    WHERE {code_col} = %s
                    LIMIT 1
                """, (canon_id,))
                row = cur.fetchone()
                if row:
                    sample_checked += 1
                    enum_value = row[0]
                    # Check if it's the expected array (could be JSONB or array)
                    if enum_value == ["YES", "NO", "N_A"] or enum_value == '["YES","NO","N_A"]':
                        sample_correct += 1
            
            response_enum_status = {
                'column_exists': True,
                'sample_checked': sample_checked,
                'sample_correct': sample_correct
            }
        else:
            response_enum_status = {
                'column_exists': False,
                'note': 'response_enum column not present; using fixed values in app logic'
            }
        
        # Build verification report
        verify_pass = (
            found_count >= expected_count and
            len(missing_ids) == 0 and
            len(all_missing) == 0
        )
        
        return {
            'verify_pass': verify_pass,
            'mapping': mapping,
            'expected_count': expected_count,
            'found_count': found_count,
            'sample_checked': len(sample_ids),
            'sample_missing': missing_ids,
            'all_missing': all_missing,
            'response_enum_status': response_enum_status,
            'inserted': result['inserted'],
            'updated': result['updated'],
            'errors': result['errors']
        }
        
    finally:
        cur.close()


def main():
    parser = argparse.ArgumentParser(
        description="Import Baseline Canonical Data (RUNTIME database only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This tool imports baseline canonical spines and MUST target the RUNTIME database.

Examples:
  python tools/import_baseline_canon.py --target runtime --dry-run
  python tools/import_baseline_canon.py --target runtime --apply
        """
    )
    
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (must be "runtime" for this tool). Can also be set via PSA_DB_TARGET env var.'
    )
    
    # Use PSA_SYSTEM_ROOT or default to PSA System location
    default_engine_root = os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System')
    if default_engine_root:
        default_engine_root = str(Path(default_engine_root) / 'psa_rebuild' / 'psa_engine')
    else:
        # Fallback to PSA System default
        default_engine_root = str(Path(r'D:\PSA_System') / 'psa_rebuild' / 'psa_engine')
    
    parser.add_argument(
        '--engine-root',
        type=str,
        default=default_engine_root,
        help='Path to psa_engine directory (default: derived from PSA_SYSTEM_ROOT, typically D:\\PSA_System\\psa_rebuild\\psa_engine)'
    )
    
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply changes to database (default: dry-run only, no writes)'
    )
    
    parser.add_argument(
        '--plan-out',
        type=str,
        default='analytics/reports/baseline_canon_import_plan.json',
        help='Output path for import plan JSON (default: analytics/reports/baseline_canon_import_plan.json)'
    )
    
    parser.add_argument(
        '--lock',
        action='store_true',
        help='Create/update lock file from resolved mapping (DRY-RUN ONLY, requires --dry-run)'
    )
    
    parser.add_argument(
        '--no-lock-prefer',
        action='store_true',
        help='Do NOT prefer lock; auto-detect and require it matches lock (drift check mode)'
    )
    
    parser.add_argument(
        '--print-mapping',
        action='store_true',
        help='Print resolved mapping to console (safe, no secrets)'
    )
    
    parser.add_argument(
        '--i-understand-this-writes',
        action='store_true',
        help='Explicit confirmation flag required when using --apply'
    )
    
    args = parser.parse_args()
    
    # Resolve and validate target
    target = require_target_from_cli_or_env(args.target)
    if target != 'runtime':
        print("ERROR: This tool MUST target the RUNTIME database only.", file=sys.stderr)
        print(f"Received target: {target}", file=sys.stderr)
        sys.exit(2)
    
    # Guard write (validates RUNTIME connection)
    guard_write(target)  # Hard-fails if mismatch detected
    
    # Determine dry-run mode (default: True, only False if --apply is set)
    dry_run = not args.apply
    
    # Require explicit confirmation flag for apply
    if args.apply and not args.i_understand_this_writes:
        print("ERROR: --apply requires --i-understand-this-writes flag", file=sys.stderr)
        print("This is a safety guard to prevent accidental writes.", file=sys.stderr)
        sys.exit(2)
    
    # Validate --lock can only be used in dry-run
    if args.lock and args.apply:
        print("ERROR: --lock can only be used in DRY-RUN mode (without --apply)", file=sys.stderr)
        sys.exit(2)
    
    print("="*80)
    print("Baseline Canon Import Tool")
    print("="*80)
    print()
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY'}")
    print(f"Target: {target}")
    print()
    
    # Load canon spines
    engine_root = Path(args.engine_root)
    canon_path = engine_root / 'doctrine' / 'baseline_canon' / 'baseline_spines.v1.json'
    
    if not canon_path.exists():
        print(f"ERROR: Canon file not found: {canon_path}", file=sys.stderr)
        print(f"Expected path: {canon_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Loading canon spines from: {canon_path}")
    try:
        canon_spines = load_canon_spines(canon_path)
        print(f"✓ Loaded {len(canon_spines)} canon questions")
    except Exception as e:
        print(f"ERROR: Failed to load canon spines: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Validate all questions have correct response_enum
    print("Validating canon questions...")
    validation_errors = []
    for question in canon_spines:
        is_valid, error_msg = validate_canon_question(question)
        if not is_valid:
            validation_errors.append({
                'canon_id': question.get('canon_id', 'UNKNOWN'),
                'error': error_msg
            })
    
    if validation_errors:
        print(f"ERROR: {len(validation_errors)} validation errors found:", file=sys.stderr)
        for err in validation_errors[:10]:
            print(f"  - {err['canon_id']}: {err['error']}", file=sys.stderr)
        sys.exit(1)
    
    print("✓ All questions validated")
    
    # Resolve schema mapping
    print("Resolving schema mapping...")
    prefer_lock = not args.no_lock_prefer
    lock_doc = load_lock()
    mapping_source = "lock" if (prefer_lock and lock_doc) else "auto"
    
    # Enforce lock usage on apply
    if args.apply:
        if not lock_doc:
            print("ERROR: Lock file required for --apply", file=sys.stderr)
            print(f"  Lock file not found: {LOCK_PATH}", file=sys.stderr)
            print("  Run with --lock first to create lock file.", file=sys.stderr)
            sys.exit(2)
        
        if mapping_source != "lock":
            print("ERROR: Must use lock file mapping for --apply", file=sys.stderr)
            print(f"  Mapping source: {mapping_source} (expected: lock)", file=sys.stderr)
            print("  Use default lock preference (do not use --no-lock-prefer).", file=sys.stderr)
            sys.exit(2)
    
    if lock_doc:
        if prefer_lock:
            print(f"  Using lock file: {LOCK_PATH}")
        else:
            print(f"  Drift detection mode: auto-detect and validate against lock")
    
    try:
        mapping = resolve_mapping(use_live_schema=True, prefer_lock=prefer_lock)
        print(f"✓ Detected pattern: {mapping['pattern']}")
        print(f"  Table: {mapping['table']}")
        print(f"  Code column: {mapping['columns']['code']}")
        print(f"  Text column: {mapping['columns']['text']}")
        print(f"  Mapping source: {mapping_source}")
    except Exception as e:
        print(f"ERROR: Failed to resolve schema mapping: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Print mapping if requested
    if args.print_mapping:
        print()
        print("Resolved Mapping:")
        print(f"  Pattern: {mapping['pattern']}")
        print(f"  Table: {mapping['table']}")
        print("  Columns:")
        for key, value in mapping['columns'].items():
            if value:
                print(f"    {key}: {value}")
        if mapping.get('fixed_values'):
            print("  Fixed Values:")
            for key, value in mapping['fixed_values'].items():
                if value:
                    print(f"    {key}: {value}")
        print()
    
    # Create/update lock if requested
    if args.lock:
        if not dry_run:
            print("ERROR: --lock can only be used in DRY-RUN mode", file=sys.stderr)
            sys.exit(2)
        
        try:
            save_lock(mapping, target=target, supabase_project_ref="wivohgbuuwxoyfyzntsd")
            print(f"✓ LOCK WRITTEN: {LOCK_PATH}")
        except Exception as e:
            print(f"ERROR: Failed to write lock file: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Connect to database
    print("Connecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    # Build import plan
    print("Building import plan...")
    plan = build_import_plan(canon_spines, mapping, conn)
    
    # Validate plan
    is_valid, plan_errors = validate_plan(plan)
    if not is_valid:
        print("ERROR: Import plan validation failed:", file=sys.stderr)
        for err in plan_errors:
            print(f"  - {err}", file=sys.stderr)
        conn.close()
        sys.exit(1)
    
    print("✓ Plan validated")
    
    # Print summary
    print()
    print("Import Plan Summary:")
    print(f"  Total questions: {plan['counts']['total']}")
    print(f"  Would INSERT: {plan['counts']['inserts']}")
    print(f"  Would UPDATE: {plan['counts']['updates']}")
    print(f"  Unchanged: {plan['counts']['unchanged']}")
    if plan['counts']['errors'] > 0:
        print(f"  Errors: {plan['counts']['errors']}")
    
    # Show sample operations
    print()
    print("Sample operations (first 25):")
    for op in plan['operations'][:25]:
        action = op['action']
        canon_id = op['canon_id']
        if action == 'UPDATE':
            print(f"  {action:10} {canon_id} (text differs)")
        elif action == 'INSERT':
            print(f"  {action:10} {canon_id}")
        elif action == 'UNCHANGED':
            print(f"  {action:10} {canon_id}")
    
    if len(plan['operations']) > 25:
        print(f"  ... and {len(plan['operations']) - 25} more")
    
    # Write plan JSON
    plan_path = Path(args.plan_out)
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    
    plan_output = {
        'generated_at': datetime.now().isoformat(),
        'dry_run': dry_run,
        'canon_source': str(canon_path),
        'detected_table': plan['detected_table'],
        'mapping': plan['mapping'],
        'mapping_source': mapping_source,
        'lock_path': str(LOCK_PATH) if lock_doc else None,
        'counts': plan['counts'],
        'sample_operations': plan['operations'][:25],
        'all_operations': plan['operations'] if len(plan['operations']) <= 100 else None,  # Limit to 100 for file size
        'errors': plan['errors']
    }
    
    with open(plan_path, 'w', encoding='utf-8') as f:
        json.dump(plan_output, f, indent=2)
    
    print()
    print(f"✓ Plan written to: {plan_path}")
    
    # Execute import if --apply
    if args.apply:
        print()
        print("="*80)
        print("EXECUTING IMPORT")
        print("="*80)
        
        try:
            result = execute_import(conn, plan, mapping)
            print(f"✓ Import complete:")
            print(f"  Inserted: {result['inserted']}")
            print(f"  Updated: {result['updated']}")
            if result['errors']:
                print(f"  Errors: {len(result['errors'])}")
                for err in result['errors'][:10]:
                    print(f"    - {err['canon_id']}: {err['error']}")
            
            # Post-apply verification
            print()
            print("Running post-apply verification...")
            verify_report = verify_post_apply(conn, canon_spines, mapping, result)
            
            # Write verification report
            verify_path = Path('analytics/reports/baseline_canon_post_apply_verify.json')
            verify_path.parent.mkdir(parents=True, exist_ok=True)
            
            verify_output = {
                'generated_at': datetime.now().isoformat(),
                'verify_pass': verify_report['verify_pass'],
                'mapping': verify_report['mapping'],
                'counts': {
                    'expected': verify_report['expected_count'],
                    'found': verify_report['found_count'],
                    'inserted': verify_report['inserted'],
                    'updated': verify_report['updated']
                },
                'missing_canon_ids': verify_report['all_missing'],
                'response_enum_status': verify_report['response_enum_status'],
                'errors': verify_report['errors']
            }
            
            with open(verify_path, 'w', encoding='utf-8') as f:
                json.dump(verify_output, f, indent=2)
            
            print(f"✓ Verification report written to: {verify_path}")
            
            # Print verification summary
            print()
            if verify_report['verify_pass']:
                print("✅ VERIFY PASS")
                print(f"  Expected: {verify_report['expected_count']} canon questions")
                print(f"  Found: {verify_report['found_count']} canon questions")
                print(f"  Missing: {len(verify_report['all_missing'])}")
            else:
                print("❌ VERIFY FAIL")
                print(f"  Expected: {verify_report['expected_count']} canon questions")
                print(f"  Found: {verify_report['found_count']} canon questions")
                if verify_report['all_missing']:
                    print(f"  Missing canon_ids: {verify_report['all_missing'][:20]}")
                    if len(verify_report['all_missing']) > 20:
                        print(f"  ... and {len(verify_report['all_missing']) - 20} more")
                print("  Treating as BLOCKER - do not proceed to deprecation.", file=sys.stderr)
                conn.close()
                sys.exit(1)
            
        except Exception as e:
            print(f"ERROR: Import failed: {e}", file=sys.stderr)
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
