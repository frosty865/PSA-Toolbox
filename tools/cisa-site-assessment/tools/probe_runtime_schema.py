#!/usr/bin/env python3
"""
Probe RUNTIME Database Schema

Discovers database schema to identify question tables and related structures.
Must target RUNTIME database only.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional
import psycopg2
from urllib.parse import urlparse

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.db.db_router import guard_write, require_target_from_cli_or_env
from app.db.db_targets import normalize_target


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


def probe_schema(conn) -> Dict:
    """Probe database schema to discover question-related tables."""
    cur = conn.cursor()
    
    try:
        # Get all tables in public schema
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        all_tables = [row[0] for row in cur.fetchall()]
        
        # Find question-related tables
        question_tables = []
        for table in all_tables:
            if 'question' in table.lower():
                question_tables.append(table)
        
        # Find assessment/set-related tables
        set_tables = []
        for table in all_tables:
            if 'set' in table.lower() or 'assessment' in table.lower():
                set_tables.append(table)
        
        # Find discipline/subtype dimension tables
        dimension_tables = []
        for table in all_tables:
            if any(term in table.lower() for term in ['discipline', 'subtype', 'dimension']):
                dimension_tables.append(table)
        
        # Get columns for question tables
        question_table_details = {}
        for table in question_tables:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table,))
            columns = [
                {
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES'
                }
                for row in cur.fetchall()
            ]
            question_table_details[table] = columns
        
        # Get columns for set/assessment tables
        set_table_details = {}
        for table in set_tables:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table,))
            columns = [
                {
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES'
                }
                for row in cur.fetchall()
            ]
            set_table_details[table] = columns
        
        # Get columns for dimension tables
        dimension_table_details = {}
        for table in dimension_tables:
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table,))
            columns = [
                {
                    'name': row[0],
                    'type': row[1],
                    'nullable': row[2] == 'YES'
                }
                for row in cur.fetchall()
            ]
            dimension_table_details[table] = columns
        
        return {
            'all_tables': all_tables,
            'question_tables': question_tables,
            'set_tables': set_tables,
            'dimension_tables': dimension_tables,
            'question_table_details': question_table_details,
            'set_table_details': set_table_details,
            'dimension_table_details': dimension_table_details
        }
        
    finally:
        cur.close()


def main():
    parser = argparse.ArgumentParser(
        description="Probe RUNTIME database schema",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        '--target',
        type=str,
        choices=['runtime', 'corpus'],
        help='Target database (must be "runtime" for this tool). Can also be set via PSA_DB_TARGET env var.'
    )
    parser.add_argument(
        '--out',
        type=str,
        default='analytics/reports/runtime_schema_probe.json',
        help='Output path for schema probe report (default: analytics/reports/runtime_schema_probe.json)'
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
    
    print("="*80)
    print("RUNTIME Schema Probe")
    print("="*80)
    print()
    
    # Connect and probe
    print("Connecting to database...")
    conn = get_db_connection()
    print("✓ Connected")
    
    print("Probing schema...")
    schema_info = probe_schema(conn)
    conn.close()
    print("✓ Schema probe complete")
    
    # Print summary
    print()
    print("Summary:")
    print(f"  Total tables: {len(schema_info['all_tables'])}")
    print(f"  Question tables: {len(schema_info['question_tables'])}")
    print(f"  Set/Assessment tables: {len(schema_info['set_tables'])}")
    print(f"  Dimension tables: {len(schema_info['dimension_tables'])}")
    print()
    
    # Print candidate question tables
    if schema_info['question_tables']:
        print("Candidate Question Tables:")
        for table in schema_info['question_tables']:
            columns = schema_info['question_table_details'][table]
            key_cols = [c['name'] for c in columns if any(term in c['name'].lower() for term in ['code', 'key', 'id', 'text', 'question', 'prompt'])]
            print(f"  - {table}")
            print(f"    Key columns: {', '.join(key_cols[:5])}")
    else:
        print("⚠️  No question tables found")
    
    print()
    
    # Print candidate set tables
    if schema_info['set_tables']:
        print("Candidate Set/Assessment Tables:")
        for table in schema_info['set_tables']:
            columns = schema_info['set_table_details'][table]
            key_cols = [c['name'] for c in columns if any(term in c['name'].lower() for term in ['code', 'key', 'id', 'name', 'version'])]
            print(f"  - {table}")
            print(f"    Key columns: {', '.join(key_cols[:5])}")
    else:
        print("⚠️  No set/assessment tables found")
    
    print()
    
    # Print dimension tables
    if schema_info['dimension_tables']:
        print("Dimension Tables:")
        for table in schema_info['dimension_tables']:
            columns = schema_info['dimension_table_details'][table]
            key_cols = [c['name'] for c in columns if any(term in c['name'].lower() for term in ['code', 'key', 'id', 'name'])]
            print(f"  - {table}")
            print(f"    Key columns: {', '.join(key_cols[:5])}")
    else:
        print("⚠️  No dimension tables found")
    
    # Write report
    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schema_info, f, indent=2)
    
    print()
    print(f"✓ Report written to: {output_path}")
    print()
    print("✅ Schema probe complete")


if __name__ == '__main__':
    main()
