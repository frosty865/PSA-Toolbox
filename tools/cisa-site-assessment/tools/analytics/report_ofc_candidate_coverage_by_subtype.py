#!/usr/bin/env python3
"""
OFC Candidate Coverage Report by Subtype

Generates coverage analysis showing:
- Subtypes with questions but low/zero candidate coverage
- Subtypes with many candidates already (avoid duplicating)

Outputs:
- analytics/reports/ofc_candidate_coverage_by_subtype.json
- analytics/reports/ofc_candidate_undercovered_subtypes.json
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict
from datetime import datetime

import psycopg2
from urllib.parse import urlparse

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

def get_runtime_db_connection():
    """Get RUNTIME database connection."""
    load_env_file('.env.local')
    
    runtime_url = os.getenv('RUNTIME_DATABASE_URL') or os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD') or os.getenv('SUPABASE_RUNTIME_SERVICE_ROLE_KEY')
    
    if not runtime_url or not runtime_password:
        raise ValueError('RUNTIME_DATABASE_URL and SUPABASE_RUNTIME_DB_PASSWORD must be set')
    
    clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
    
    # Parse URL
    if runtime_url.startswith('postgresql://'):
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0] if 'supabase.co' in url.hostname else url.hostname
        connection_string = runtime_url.replace('postgresql://', f'postgresql://postgres:{clean_password}@')
    else:
        # Supabase URL format
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise

def get_corpus_db_connection():
    """Get CORPUS database connection."""
    load_env_file('.env.local')
    
    corpus_url = os.getenv('CORPUS_DATABASE_URL') or os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD') or os.getenv('SUPABASE_CORPUS_SERVICE_ROLE_KEY')
    
    if not corpus_url or not corpus_password:
        raise ValueError('CORPUS_DATABASE_URL and SUPABASE_CORPUS_DB_PASSWORD must be set')
    
    clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
    
    if corpus_url.startswith('postgresql://'):
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0] if 'supabase.co' in url.hostname else url.hostname
        connection_string = corpus_url.replace('postgresql://', f'postgresql://postgres:{clean_password}@')
    else:
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
    
    try:
        return psycopg2.connect(connection_string)
    except psycopg2.OperationalError as e:
        if '6543' in connection_string:
            print(f"[WARN] Connection to port 6543 failed, trying direct port 5432...")
            connection_string_direct = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string_direct)
        raise

def main():
    """Generate coverage report."""
    print("[COVERAGE] Starting coverage analysis...")
    
    # Connect to both databases
    runtime_conn = get_runtime_db_connection()
    corpus_conn = get_corpus_db_connection()
    
    runtime_cur = runtime_conn.cursor()
    corpus_cur = corpus_conn.cursor()
    
    try:
        # 1. Get all active subtypes with their codes
        print("[COVERAGE] Loading subtypes from RUNTIME...")
        runtime_cur.execute("""
            SELECT 
                ds.id as subtype_id,
                ds.code as subtype_code,
                ds.name as subtype_name,
                d.code as discipline_code,
                d.name as discipline_name
            FROM public.discipline_subtypes ds
            JOIN public.disciplines d ON ds.discipline_id = d.id
            WHERE ds.is_active = true
            ORDER BY d.code, ds.code
        """)
        
        subtypes = {}
        for row in runtime_cur.fetchall():
            subtype_id, subtype_code, subtype_name, discipline_code, discipline_name = row
            subtypes[subtype_id] = {
                'subtype_id': str(subtype_id),
                'subtype_code': subtype_code,
                'subtype_name': subtype_name,
                'discipline_code': discipline_code,
                'discipline_name': discipline_name,
                'question_count': 0,
                'existing_candidate_count': 0,
                'coverage_ratio': 0.0
            }
        
        print(f"[COVERAGE] Found {len(subtypes)} active subtypes")
        
        # 2. Count questions per subtype (from baseline_spines_runtime)
        print("[COVERAGE] Counting questions per subtype...")
        runtime_cur.execute("""
            SELECT 
                discipline_subtype_id,
                COUNT(*) as question_count
            FROM public.baseline_spines_runtime
            WHERE active = true
                AND discipline_subtype_id IS NOT NULL
            GROUP BY discipline_subtype_id
        """)
        
        for row in runtime_cur.fetchall():
            subtype_id, question_count = row
            if str(subtype_id) in subtypes:
                subtypes[str(subtype_id)]['question_count'] = question_count
        
        # 3. Count existing corpus candidates per subtype
        print("[COVERAGE] Counting existing corpus candidates per subtype...")
        corpus_cur.execute("""
            SELECT 
                discipline_subtype_id,
                COUNT(*) as candidate_count
            FROM public.ofc_candidate_queue
            WHERE ofc_origin = 'CORPUS'
                AND status IN ('PENDING', 'REVIEWED', 'PROMOTED')
            GROUP BY discipline_subtype_id
        """)
        
        for row in corpus_cur.fetchall():
            subtype_id, candidate_count = row
            if subtype_id and str(subtype_id) in subtypes:
                subtypes[str(subtype_id)]['existing_candidate_count'] = candidate_count
        
        # 4. Calculate coverage ratios
        print("[COVERAGE] Calculating coverage ratios...")
        for subtype_id, subtype_data in subtypes.items():
            question_count = subtype_data['question_count']
            candidate_count = subtype_data['existing_candidate_count']
            coverage_ratio = candidate_count / max(question_count, 1)
            subtype_data['coverage_ratio'] = round(coverage_ratio, 3)
        
        # 5. Build full coverage report
        coverage_report = {
            'metadata': {
                'generated_at': str(psycopg2.extras.datetime.datetime.now()),
                'total_subtypes': len(subtypes),
                'subtypes_with_questions': sum(1 for s in subtypes.values() if s['question_count'] > 0),
                'subtypes_with_candidates': sum(1 for s in subtypes.values() if s['existing_candidate_count'] > 0)
            },
            'subtypes': list(subtypes.values())
        }
        
        # 6. Build prioritized under-covered list (low coverage, has questions)
        undercovered = [
            s for s in subtypes.values()
            if s['question_count'] > 0 and s['coverage_ratio'] < 0.5  # Less than 0.5 candidates per question
        ]
        undercovered.sort(key=lambda x: (x['coverage_ratio'], -x['question_count']))
        
        undercovered_report = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'threshold': 0.5,
                'total_undercovered': len(undercovered)
            },
            'subtypes': undercovered[:50]  # Top 50 most under-covered
        }
        
        # 7. Write reports
        reports_dir = Path('analytics/reports')
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        coverage_path = reports_dir / 'ofc_candidate_coverage_by_subtype.json'
        with open(coverage_path, 'w') as f:
            json.dump(coverage_report, f, indent=2)
        print(f"[COVERAGE] Wrote coverage report to {coverage_path}")
        
        undercovered_path = reports_dir / 'ofc_candidate_undercovered_subtypes.json'
        with open(undercovered_path, 'w') as f:
            json.dump(undercovered_report, f, indent=2)
        print(f"[COVERAGE] Wrote undercovered subtypes to {undercovered_path}")
        
        print(f"[COVERAGE] Summary:")
        print(f"  - Total subtypes: {len(subtypes)}")
        print(f"  - Subtypes with questions: {coverage_report['metadata']['subtypes_with_questions']}")
        print(f"  - Subtypes with candidates: {coverage_report['metadata']['subtypes_with_candidates']}")
        print(f"  - Under-covered subtypes: {len(undercovered)}")
        
    finally:
        runtime_cur.close()
        corpus_cur.close()
        runtime_conn.close()
        corpus_conn.close()

if __name__ == '__main__':
    main()
