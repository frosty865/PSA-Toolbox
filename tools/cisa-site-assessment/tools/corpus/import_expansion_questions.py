#!/usr/bin/env python3
"""
CORPUS: Import Expansion Questions

Imports expansion questions from JSON or CSV files into CORPUS.

HARD RULE: Only writes to CORPUS database (yylslokiaovdythzrbgt)
"""

import os
import sys
import json
import csv
import argparse
from pathlib import Path
from typing import List, Dict

# Add parent directory to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from tools.corpus.overlay_control import get_corpus_db_connection, forbid_deprecated_sources
from app.db.db_router import guard_write, require_target_from_cli_or_env

def validate_question(question: Dict) -> None:
    """Validate a single question object."""
    required_fields = ['expansion_version', 'scope_type', 'scope_code', 'question_code', 'question_text']
    for field in required_fields:
        if field not in question or not question[field]:
            raise ValueError(f"Missing or empty required field: {field}")
    
    # Validate scope_type
    if question['scope_type'] not in ['SECTOR', 'SUBSECTOR', 'TECHNOLOGY']:
        raise ValueError(f"scope_type must be SECTOR, SUBSECTOR, or TECHNOLOGY, got: {question['scope_type']}")
    
    # Forbid SAFE in codes
    forbid_deprecated_sources(question['scope_code'])
    forbid_deprecated_sources(question['question_code'])
    
    # Validate response_enum
    response_enum = question.get('response_enum', ["YES", "NO", "N_A"])
    if response_enum != ["YES", "NO", "N_A"]:
        raise ValueError(f"response_enum must be exactly ['YES','NO','N_A'], got: {response_enum}")

def import_from_json(json_path: str) -> List[Dict]:
    """Import questions from JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not isinstance(data, list):
        raise ValueError("JSON file must contain an array of question objects")
    
    questions = []
    for i, item in enumerate(data):
        try:
            validate_question(item)
            questions.append(item)
        except Exception as e:
            print(f"⚠️  Skipping question at index {i}: {e}", file=sys.stderr)
    
    return questions

def import_from_csv(csv_path: str) -> List[Dict]:
    """Import questions from CSV file."""
    questions = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Map CSV columns to question dict
                question = {
                    'expansion_version': row.get('expansion_version', '').strip(),
                    'scope_type': row.get('scope_type', '').strip(),
                    'scope_code': row.get('scope_code', '').strip(),
                    'question_code': row.get('question_code', '').strip(),
                    'question_text': row.get('question_text', '').strip(),
                    'is_active': row.get('is_active', 'true').strip().lower() == 'true'
                }
                
                # Parse response_enum if provided, otherwise use default
                if 'response_enum' in row and row['response_enum']:
                    question['response_enum'] = json.loads(row['response_enum'])
                else:
                    question['response_enum'] = ["YES", "NO", "N_A"]
                
                validate_question(question)
                questions.append(question)
            except Exception as e:
                print(f"⚠️  Skipping row {row_num}: {e}", file=sys.stderr)
    
    return questions

def import_questions(questions: List[Dict], dry_run: bool = False) -> Dict:
    """Import questions into database."""
    conn = get_corpus_db_connection()
    cur = conn.cursor()
    
    try:
        inserted = 0
        updated = 0
        errors = []
        
        for question in questions:
            try:
                if dry_run:
                    print(f"Would upsert: {question['question_code']}")
                    inserted += 1
                    continue
                
                # Upsert by (expansion_version, question_code)
                cur.execute("""
                    INSERT INTO public.expansion_questions (
                        expansion_version, scope_type, scope_code, question_code,
                        question_text, response_enum, is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (expansion_version, question_code) DO UPDATE SET
                        scope_type = EXCLUDED.scope_type,
                        scope_code = EXCLUDED.scope_code,
                        question_text = EXCLUDED.question_text,
                        response_enum = EXCLUDED.response_enum,
                        is_active = EXCLUDED.is_active,
                        updated_at = now()
                    RETURNING (xmax = 0) AS is_insert
                """, (
                    question['expansion_version'],
                    question['scope_type'],
                    question['scope_code'],
                    question['question_code'],
                    question['question_text'],
                    json.dumps(question.get('response_enum', ["YES", "NO", "N_A"])),
                    question.get('is_active', True)
                ))
                
                is_insert = cur.fetchone()[0]
                if is_insert:
                    inserted += 1
                else:
                    updated += 1
                    
            except Exception as e:
                errors.append({
                    'question_code': question.get('question_code', 'UNKNOWN'),
                    'error': str(e)
                })
        
        if not dry_run:
            conn.commit()
        
        return {
            'status': 'completed',
            'inserted': inserted,
            'updated': updated,
            'errors': errors
        }
        
    except Exception as e:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

def main():
    parser = argparse.ArgumentParser(description='Import expansion questions into CORPUS')
    parser.add_argument('--json', help='Path to JSON file')
    parser.add_argument('--csv', help='Path to CSV file')
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        default='corpus',
        help='Target database (must be "corpus" for this tool, default: corpus)'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Apply changes to database (default: dry-run only)'
    )
    
    args = parser.parse_args()
    
    if not args.json and not args.csv:
        parser.error("Must provide either --json or --csv")
    
    if args.json and args.csv:
        parser.error("Cannot provide both --json and --csv")
    
    # Validate target is corpus
    target = require_target_from_cli_or_env(args.target)
    if target != 'corpus':
        print("ERROR: This tool MUST target the CORPUS database only.", file=sys.stderr)
        print(f"Received target: {target}", file=sys.stderr)
        sys.exit(2)
    
    # Guard write (validates CORPUS connection)
    guard_write(target)  # Hard-fails if mismatch detected
    
    try:
        # Import questions
        if args.json:
            questions = import_from_json(args.json)
        else:
            questions = import_from_csv(args.csv)
        
        print(f"Loaded {len(questions)} questions from file")
        
        # Determine dry-run mode
        dry_run = not args.apply
        
        # Import into database
        result = import_questions(questions, dry_run=dry_run)
        
        print(json.dumps(result, indent=2))
        
        if result['status'] == 'completed':
            if dry_run:
                print(f"\n✅ Dry run complete: Would insert {result['inserted']} questions")
                print("⚠️  Use --apply to write changes to database")
            else:
                print(f"\n✅ Import complete: {result['inserted']} inserted, {result['updated']} updated")
                if result['errors']:
                    print(f"⚠️  {len(result['errors'])} errors occurred")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

