#!/usr/bin/env python3
"""
Report Unmapped Subtype Codes

Lists questions with subtype_code that don't map to discipline_subtypes.code
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse
from collections import Counter

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
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    runtime_url = os.getenv('SUPABASE_RUNTIME_URL')
    runtime_password = os.getenv('SUPABASE_RUNTIME_DB_PASSWORD')
    
    if runtime_url and runtime_password:
        clean_password = runtime_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = runtime_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            raise SystemExit(f"Could not parse project_ref from RUNTIME_URL: {runtime_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def fetch_rows(conn, sql: str, params: Tuple[Any, ...]=()) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    out = []
    for row in cur.fetchall():
        out.append({cols[i]: row[i] for i in range(len(cols))})
    cur.close()
    return out

def main():
    conn = get_runtime_db()
    
    # Total questions
    total = fetch_rows(conn, "SELECT COUNT(*) as cnt FROM public.baseline_spines_runtime;")[0]["cnt"]
    
    # Questions with subtype_code
    with_subtype_code = fetch_rows(conn, """
        SELECT COUNT(*) as cnt 
        FROM public.baseline_spines_runtime 
        WHERE subtype_code IS NOT NULL
    """)[0]["cnt"]
    
    # Questions with discipline_subtype_id
    with_subtype_id = fetch_rows(conn, """
        SELECT COUNT(*) as cnt 
        FROM public.baseline_spines_runtime 
        WHERE discipline_subtype_id IS NOT NULL
    """)[0]["cnt"]
    
    # Questions missing discipline_subtype_id but have subtype_code
    unmapped = fetch_rows(conn, """
        SELECT 
            canon_id,
            subtype_code,
            discipline_subtype_id
        FROM public.baseline_spines_runtime
        WHERE subtype_code IS NOT NULL
          AND discipline_subtype_id IS NULL
        ORDER BY subtype_code, canon_id
    """)
    
    # Top unmapped subtype_codes
    unmapped_codes = Counter(r["subtype_code"] for r in unmapped)
    
    # Check if these codes exist in discipline_subtypes
    if unmapped:
        codes = list(unmapped_codes.keys())
        placeholders = ",".join(["%s"] * len(codes))
        existing_codes = fetch_rows(conn, f"""
            SELECT code 
            FROM public.discipline_subtypes 
            WHERE code IN ({placeholders})
        """, tuple(codes))
        existing_code_set = {r["code"] for r in existing_codes}
        missing_codes = [c for c in codes if c not in existing_code_set]
    else:
        missing_codes = []
    
    report = {
        "total_questions": total,
        "questions_with_subtype_code": with_subtype_code,
        "questions_with_discipline_subtype_id": with_subtype_id,
        "unmapped_count": len(unmapped),
        "unmapped_questions": [
            {
                "canon_id": r["canon_id"],
                "subtype_code": r["subtype_code"]
            }
            for r in unmapped[:50]  # Top 50
        ],
        "top_unmapped_subtype_codes": dict(unmapped_codes.most_common(20)),
        "missing_from_discipline_subtypes": missing_codes
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/unmapped_subtypes.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    
    print("=" * 70)
    print("Unmapped Subtype Codes Report")
    print("=" * 70)
    print(f"\nTotal questions: {total}")
    print(f"Questions with subtype_code: {with_subtype_code}")
    print(f"Questions with discipline_subtype_id: {with_subtype_id}")
    print(f"Unmapped (have subtype_code but no discipline_subtype_id): {len(unmapped)}")
    
    if unmapped:
        print(f"\nTop unmapped subtype_codes:")
        for code, count in unmapped_codes.most_common(20):
            print(f"  {code}: {count} questions")
        
        if missing_codes:
            print(f"\n⚠️  These subtype_codes don't exist in discipline_subtypes:")
            for code in missing_codes:
                print(f"  - {code}")
        else:
            print(f"\n✓ All unmapped subtype_codes exist in discipline_subtypes (backfill needed)")
    else:
        print("\n✓ All questions with subtype_code have discipline_subtype_id")
    
    print(f"\n[OK] Wrote analytics/reports/unmapped_subtypes.json")
    
    conn.close()
    
    if len(unmapped) > 0:
        sys.exit(1)  # Exit with error if unmapped exist

if __name__ == "__main__":
    main()
