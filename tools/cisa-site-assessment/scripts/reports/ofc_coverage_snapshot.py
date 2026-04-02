#!/usr/bin/env python3
"""
OFC Coverage Snapshot Report

Generates a snapshot of OFC coverage across questions, disciplines, and subtypes.

Output: analytics/reports/ofc_coverage_snapshot.json
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

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

def get_corpus_db():
    """Get CORPUS database connection."""
    import psycopg2
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(corpus_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def get_runtime_db():
    """Get RUNTIME database connection."""
    import psycopg2
    from urllib.parse import urlparse
    
    load_env_file('.env.local')
    
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        url = urlparse(runtime_url)
        project_ref = url.hostname.split('.')[0]
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def main():
    corpus_conn = get_corpus_db()
    runtime_conn = get_runtime_db()
    
    corpus_cur = corpus_conn.cursor()
    runtime_cur = runtime_conn.cursor()
    
    try:
        # Get total questions
        runtime_cur.execute("""
            SELECT COUNT(*) as total
            FROM public.baseline_spines_runtime
            WHERE active = true
        """)
        total_questions = runtime_cur.fetchone()[0]
        
        # Get questions with OFC links
        runtime_cur.execute("""
            SELECT COUNT(DISTINCT question_canon_id) as linked
            FROM public.ofc_question_links
        """)
        questions_with_ofcs = runtime_cur.fetchone()[0] or 0
        
        # Get total OFCs
        corpus_cur.execute("""
            SELECT COUNT(*) as total
            FROM public.ofc_candidate_queue
            WHERE approved = TRUE AND status = 'PROMOTED'
        """)
        total_ofcs = corpus_cur.fetchone()[0]
        
        # Get OFCs with links
        runtime_cur.execute("""
            SELECT COUNT(DISTINCT ofc_id) as linked
            FROM public.ofc_question_links
        """)
        ofcs_with_links = runtime_cur.fetchone()[0] or 0
        
        # Coverage by discipline/subtype
        runtime_cur.execute("""
            SELECT 
                q.discipline_subtype_id::text as subtype_id,
                COUNT(DISTINCT q.canon_id) as question_count,
                COUNT(DISTINCT l.question_canon_id) as questions_with_ofcs
            FROM public.baseline_spines_runtime q
            LEFT JOIN public.ofc_question_links l ON q.canon_id = l.question_canon_id
            WHERE q.active = true AND q.discipline_subtype_id IS NOT NULL
            GROUP BY q.discipline_subtype_id
            ORDER BY question_count DESC
        """)
        subtype_coverage = []
        for row in runtime_cur.fetchall():
            subtype_id, question_count, questions_with_ofcs = row
            coverage_pct = (questions_with_ofcs / question_count * 100) if question_count > 0 else 0
            subtype_coverage.append({
                'subtype_id': subtype_id,
                'question_count': question_count,
                'questions_with_ofcs': questions_with_ofcs or 0,
                'coverage_percent': round(coverage_pct, 2)
            })
        
        # Top coverage gaps (subtypes with questions but no OFCs)
        coverage_gaps = [
            s for s in subtype_coverage 
            if s['question_count'] > 0 and s['questions_with_ofcs'] == 0
        ]
        coverage_gaps.sort(key=lambda x: x['question_count'], reverse=True)
        
        # Generate report
        report = {
            'timestamp': str(Path(__file__).parent.parent.parent / 'analytics' / 'reports' / 'ofc_coverage_snapshot.json'),
            'summary': {
                'total_questions': total_questions,
                'questions_with_ofcs': questions_with_ofcs,
                'questions_without_ofcs': total_questions - questions_with_ofcs,
                'coverage_percent': round((questions_with_ofcs / total_questions * 100) if total_questions > 0 else 0, 2),
                'total_ofcs': total_ofcs,
                'ofcs_with_links': ofcs_with_links,
                'ofcs_without_links': total_ofcs - ofcs_with_links,
                'link_utilization_percent': round((ofcs_with_links / total_ofcs * 100) if total_ofcs > 0 else 0, 2)
            },
            'subtype_coverage': subtype_coverage,
            'coverage_gaps': coverage_gaps[:20],  # Top 20 gaps
            'pilot_gate_met': (questions_with_ofcs / total_questions * 100) >= 80 if total_questions > 0 else False
        }
        
        # Write report
        report_path = Path(__file__).parent.parent.parent / 'analytics' / 'reports' / 'ofc_coverage_snapshot.json'
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        
        # Print summary
        print("=" * 70)
        print("OFC COVERAGE SNAPSHOT")
        print("=" * 70)
        print(f"\nQuestions: {total_questions} total, {questions_with_ofcs} with OFCs ({report['summary']['coverage_percent']}%)")
        print(f"OFCs: {total_ofcs} total, {ofcs_with_links} linked ({report['summary']['link_utilization_percent']}%)")
        print(f"\nCoverage gaps: {len(coverage_gaps)} subtypes with questions but no OFCs")
        if coverage_gaps:
            print("\nTop coverage gaps:")
            for gap in coverage_gaps[:10]:
                print(f"  - Subtype {gap['subtype_id']}: {gap['question_count']} questions, 0 OFCs")
        
        print(f"\n[REPORT] Written to: {report_path}")
        
        if report['pilot_gate_met']:
            print("\n✅ PILOT GATE MET: ≥80% coverage")
        else:
            print(f"\n⚠️  PILOT GATE NOT MET: {report['summary']['coverage_percent']}% coverage (<80% required)")
        
        return 0
        
    finally:
        corpus_cur.close()
        runtime_cur.close()
        corpus_conn.close()
        runtime_conn.close()

if __name__ == '__main__':
    sys.exit(main())
