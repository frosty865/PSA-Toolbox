#!/usr/bin/env python3
"""
OFC Link Audit Report

Audits OFC-question links for:
- Citationless OFCs
- Missing subtype/discipline mapping
- Subtypes with questions but no OFCs

Output: analytics/reports/ofc_link_audit.json
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
        print("=" * 70)
        print("OFC LINK AUDIT")
        print("=" * 70)
        print("\nAuditing OFC links...")
        
        # Get all promoted OFCs
        corpus_cur.execute("""
            SELECT 
                candidate_id,
                snippet_text,
                title,
                source_id,
                discipline_subtype_id,
                discipline_id,
                ofc_origin,
                status
            FROM public.ofc_candidate_queue
            WHERE status IN ('PROMOTED', 'REVIEWED', 'PENDING')
        """)
        ofcs = corpus_cur.fetchall()
        
        citationless_ofcs = []
        missing_mapping_ofcs = []
        
        for ofc in ofcs:
            ofc_id, ofc_text, title, source_id, subtype_id, discipline_id, ofc_origin, status = ofc
            
            # Check for citation
            if not source_id:
                citationless_ofcs.append({
                    'id': str(ofc_id),
                    'title': title,
                    'ofc_text': ofc_text[:100] + '...' if len(ofc_text) > 100 else ofc_text,
                    'ofc_origin': ofc_origin,
                    'status': status
                })
            
            # Check for subtype mapping
            if not subtype_id:
                missing_mapping_ofcs.append({
                    'id': str(ofc_id),
                    'title': title,
                    'ofc_text': ofc_text[:100] + '...' if len(ofc_text) > 100 else ofc_text,
                    'ofc_origin': ofc_origin,
                    'status': status
                })
        
        # Get subtypes with questions but no OFCs
        runtime_cur.execute("""
            SELECT 
                q.discipline_subtype_id::text as subtype_id,
                COUNT(DISTINCT q.canon_id) as question_count
            FROM public.baseline_spines_runtime q
            WHERE q.active = true AND q.discipline_subtype_id IS NOT NULL
            GROUP BY q.discipline_subtype_id
        """)
        subtypes_with_questions = {row[0]: row[1] for row in runtime_cur.fetchall()}
        
        # Get subtypes with OFCs
        corpus_cur.execute("""
            SELECT DISTINCT discipline_subtype_id::text
            FROM public.ofc_candidate_queue
            WHERE discipline_subtype_id IS NOT NULL
        """)
        subtypes_with_ofcs = {row[0] for row in corpus_cur.fetchall()}
        
        # Find gaps
        missing_ofc_subtypes = []
        for subtype_id, question_count in subtypes_with_questions.items():
            if subtype_id not in subtypes_with_ofcs:
                missing_ofc_subtypes.append({
                    'subtype_id': subtype_id,
                    'question_count': question_count
                })
        
        missing_ofc_subtypes.sort(key=lambda x: x['question_count'], reverse=True)
        
        # Generate report
        report = {
            'timestamp': str(Path(__file__).parent.parent.parent / 'analytics' / 'reports' / 'ofc_link_audit.json'),
            'summary': {
                'total_ofcs': len(ofcs),
                'citationless_ofcs': len(citationless_ofcs),
                'missing_mapping_ofcs': len(missing_mapping_ofcs),
                'subtypes_with_questions_no_ofcs': len(missing_ofc_subtypes)
            },
            'citationless_ofcs': citationless_ofcs[:50],  # Top 50
            'missing_mapping_ofcs': missing_mapping_ofcs[:50],  # Top 50
            'missing_ofc_subtypes': missing_ofc_subtypes[:20]  # Top 20
        }
        
        # Write report
        report_path = Path(__file__).parent.parent.parent / 'analytics' / 'reports' / 'ofc_link_audit.json'
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        
        # Print summary
        print("=" * 70)
        print("OFC LINK AUDIT")
        print("=" * 70)
        print(f"\nTotal OFCs audited: {len(ofcs)}")
        print(f"Citationless OFCs: {len(citationless_ofcs)}")
        print(f"Missing subtype mapping: {len(missing_mapping_ofcs)}")
        print(f"Subtypes with questions but no OFCs: {len(missing_ofc_subtypes)}")
        
        if citationless_ofcs:
            print("\n⚠️  Citationless OFCs (top 10):")
            for ofc in citationless_ofcs[:10]:
                print(f"  - {ofc['title']} (ID: {ofc['id']}, Origin: {ofc['ofc_origin']})")
        
        if missing_mapping_ofcs:
            print("\n⚠️  Missing subtype mapping (top 10):")
            for ofc in missing_mapping_ofcs[:10]:
                print(f"  - {ofc['title']} (ID: {ofc['id']}, Origin: {ofc['ofc_origin']})")
        
        if missing_ofc_subtypes:
            print("\n⚠️  Subtypes with questions but no OFCs (top 10):")
            for subtype in missing_ofc_subtypes[:10]:
                print(f"  - Subtype {subtype['subtype_id']}: {subtype['question_count']} questions")
        
        print(f"\n[REPORT] Written to: {report_path}")
        
        if len(citationless_ofcs) == 0 and len(missing_mapping_ofcs) == 0:
            print("\n✅ All OFCs have citations and subtype mappings")
        else:
            print(f"\n⚠️  Issues found: {len(citationless_ofcs)} citationless, {len(missing_mapping_ofcs)} missing mapping")
        
        return 0
        
    finally:
        corpus_cur.close()
        runtime_cur.close()
        corpus_conn.close()
        runtime_conn.close()

if __name__ == '__main__':
    sys.exit(main())
