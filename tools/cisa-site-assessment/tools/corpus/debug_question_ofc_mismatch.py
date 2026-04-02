#!/usr/bin/env python3
"""
Debug script to verify question-OFC subtype/discipline matching.

Usage:
    # Always use venv!
    source venv/bin/activate  # Unix/Mac/Linux
    venv\Scripts\activate      # Windows
    
    python tools/corpus/debug_question_ofc_mismatch.py --canon-id <ILLUMINATION_QUESTION_CANON>
    python tools/corpus/debug_question_ofc_mismatch.py --question-id <question_id>
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

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

def fetch_rows(conn, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Fetch rows from database."""
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    out = []
    for row in cur.fetchall():
        out.append({cols[i]: row[i] for i in range(len(cols))})
    cur.close()
    return out

def main():
    ap = argparse.ArgumentParser(description="Debug question-OFC subtype/discipline matching")
    ap.add_argument("--canon-id", type=str, help="Question canon_id")
    ap.add_argument("--question-id", type=str, help="Question ID (alternative to canon-id)")
    ap.add_argument("--topn", type=int, default=20, help="Number of top OFCs to show")
    args = ap.parse_args()
    
    if not args.canon_id and not args.question_id:
        ap.error("Must provide either --canon-id or --question-id")
    
    runtime_conn = get_runtime_db()
    corpus_conn = get_corpus_db()
    
    try:
        # Find question
        if args.canon_id:
            questions = fetch_rows(runtime_conn, """
                SELECT canon_id, question_text, discipline_subtype_id, discipline_id
                FROM public.baseline_spines_runtime
                WHERE canon_id = %s AND active = true
            """, (args.canon_id,))
        else:
            questions = fetch_rows(runtime_conn, """
                SELECT canon_id, question_text, discipline_subtype_id, discipline_id
                FROM public.baseline_spines_runtime
                WHERE canon_id = %s AND active = true
            """, (args.question_id,))
        
        if not questions:
            print(f"[FAIL] Question not found: {args.canon_id or args.question_id}")
            sys.exit(1)
        
        question = questions[0]
        q_canon_id = question["canon_id"]
        q_text = question["question_text"]
        q_subtype_id = str(question["discipline_subtype_id"]) if question["discipline_subtype_id"] else None
        q_discipline_id = str(question["discipline_id"]) if question["discipline_id"] else None
        
        print("=" * 70)
        print("QUESTION DETAILS")
        print("=" * 70)
        print(f"Canon ID: {q_canon_id}")
        print(f"Text: {q_text[:200]}...")
        print(f"Discipline Subtype ID: {q_subtype_id}")
        print(f"Discipline ID: {q_discipline_id}")
        
        if not q_subtype_id:
            print("\n[FAIL] Question missing discipline_subtype_id - cannot verify matches")
            sys.exit(1)
        
        # Get subtype and discipline names
        subtype_info = fetch_rows(runtime_conn, """
            SELECT ds.name as subtype_name, ds.code as subtype_code,
                   d.name as discipline_name, d.id as discipline_id
            FROM public.discipline_subtypes ds
            JOIN public.disciplines d ON ds.discipline_id = d.id
            WHERE ds.id = %s
        """, (q_subtype_id,))
        
        if subtype_info:
            print(f"Subtype: {subtype_info[0]['subtype_name']} ({subtype_info[0]['subtype_code']})")
            print(f"Discipline: {subtype_info[0]['discipline_name']}")
            expected_discipline_id = str(subtype_info[0]['discipline_id'])
            if q_discipline_id and q_discipline_id != expected_discipline_id:
                print(f"[WARN] Question discipline_id ({q_discipline_id}) doesn't match subtype's discipline ({expected_discipline_id})")
        else:
            print("[WARN] Could not load subtype/discipline details")
        
        # Get top OFCs that would be considered (from ofc_candidate_queue)
        print("\n" + "=" * 70)
        print(f"TOP {args.topn} OFCs CONSIDERED (should all match subtype)")
        print("=" * 70)
        
        ofcs = fetch_rows(corpus_conn, """
            SELECT 
                ocq.candidate_id,
                ocq.snippet_text,
                ocq.status,
                ocq.discipline_subtype_id,
                ocq.discipline_id,
                ocq.ofc_origin
            FROM public.ofc_candidate_queue ocq
            WHERE ocq.ofc_origin = 'CORPUS'
            ORDER BY ocq.created_at DESC
            LIMIT %s
        """, (args.topn * 10,))  # Get more to filter
        
        # Filter to only those with matching subtype (what linker would consider)
        matching_ofcs = []
        mismatched_ofcs = []
        
        for ofc in ofcs:
            o_subtype_id = str(ofc["discipline_subtype_id"]) if ofc["discipline_subtype_id"] else None
            o_discipline_id = str(ofc["discipline_id"]) if ofc["discipline_id"] else None
            
            if not o_subtype_id:
                mismatched_ofcs.append({
                    "ofc": ofc,
                    "reason": "ofc_missing_subtype"
                })
                continue
            
            if o_subtype_id != q_subtype_id:
                mismatched_ofcs.append({
                    "ofc": ofc,
                    "reason": "subtype_mismatch",
                    "expected": q_subtype_id,
                    "got": o_subtype_id
                })
                continue
            
            if q_discipline_id and o_discipline_id and o_discipline_id != q_discipline_id:
                mismatched_ofcs.append({
                    "ofc": ofc,
                    "reason": "discipline_mismatch",
                    "expected": q_discipline_id,
                    "got": o_discipline_id
                })
                continue
            
            matching_ofcs.append(ofc)
        
        # Show matching OFCs (top N)
        if matching_ofcs:
            print(f"\n✓ Found {len(matching_ofcs)} OFCs with matching subtype")
            for i, ofc in enumerate(matching_ofcs[:args.topn], 1):
                print(f"\n{i}. {ofc['snippet_text'][:150]}...")
                print(f"   Status: {ofc['status']}, Origin: {ofc['ofc_origin']}")
        else:
            print(f"\n[WARN] No OFCs found with matching subtype")
        
        # Show mismatched OFCs
        if mismatched_ofcs:
            print("\n" + "=" * 70)
            print(f"❌ MISMATCHED OFCs ({len(mismatched_ofcs)} found)")
            print("=" * 70)
            
            by_reason = {}
            for item in mismatched_ofcs:
                reason = item["reason"]
                if reason not in by_reason:
                    by_reason[reason] = []
                by_reason[reason].append(item)
            
            for reason, items in by_reason.items():
                print(f"\n{reason}: {len(items)} OFCs")
                for item in items[:5]:  # Show first 5
                    ofc = item["ofc"]
                    print(f"  - {ofc['snippet_text'][:100]}...")
                    if reason == "subtype_mismatch":
                        print(f"    Expected subtype: {item['expected']}, Got: {item['got']}")
                    elif reason == "discipline_mismatch":
                        print(f"    Expected discipline: {item['expected']}, Got: {item['got']}")
            
            print("\n[FAIL] Found mismatched subtype/discipline OFCs in considered set")
            sys.exit(1)
        else:
            print("\n[OK] All considered OFCs have matching subtype/discipline")
        
        print("\n" + "=" * 70)
        print("VERIFICATION COMPLETE")
        print("=" * 70)
        
    finally:
        runtime_conn.close()
        corpus_conn.close()

if __name__ == "__main__":
    main()
