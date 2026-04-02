#!/usr/bin/env python3
"""
Print all PENDING OFCs from the candidate queue.
"""

import json
import os
import sys
import textwrap
from pathlib import Path
from typing import Any, Dict, List
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

def get_corpus_db():
    """Get CORPUS database connection."""
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = corpus_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            print(f"[FAIL] Could not parse project_ref from CORPUS_URL: {corpus_url}", file=sys.stderr)
            sys.exit(1)
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    print("[FAIL] Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.", file=sys.stderr)
    sys.exit(1)

def load_targets() -> Dict[str, Any]:
    """Load mining targets configuration."""
    p = Path("analytics/reports/ofc_mining_targets.json")
    if not p.exists():
        print("[FAIL] Missing analytics/reports/ofc_mining_targets.json. Run discover_ofc_mining_targets.py first.", file=sys.stderr)
        sys.exit(1)
    return json.loads(p.read_text(encoding="utf-8"))

def fetch_rows(cur, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Fetch rows as dictionaries."""
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def main():
    targets = load_targets()
    dest = targets["destination"]
    dest_table = dest["table"]
    dest_id_col = dest["id_col"]
    dest_text_col = dest["text_col"]
    
    conn = get_corpus_db()
    cur = conn.cursor()
    
    # Check what columns are available
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        ORDER BY ordinal_position
    """, (dest_table.replace("public.", ""),))
    available_cols = {row[0] for row in cur.fetchall()}
    
    # Build SELECT columns
    select_cols = [dest_id_col, dest_text_col]
    if "title" in available_cols:
        select_cols.append("title")
    if "status" in available_cols:
        select_cols.append("status")
    if "created_at" in available_cols:
        select_cols.append("created_at")
    if "document_chunk_id" in available_cols:
        select_cols.append("document_chunk_id")
    
    # Query all PENDING OFCs
    query = f"""
        SELECT {', '.join(select_cols)}
        FROM {dest_table}
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
    """
    
    ofcs = fetch_rows(cur, query)
    
    if not ofcs:
        print("[INFO] No PENDING OFCs found.")
        cur.close()
        conn.close()
        return
    
    output_lines = []
    output_lines.append("=" * 80)
    output_lines.append(f"PENDING OFCs ({len(ofcs)} total)")
    output_lines.append("=" * 80)
    output_lines.append("")
    
    for i, ofc in enumerate(ofcs, 1):
        ofc_id = str(ofc[dest_id_col])
        ofc_text = ofc.get(dest_text_col) or ""
        title = ofc.get("title") or ""
        created_at = ofc.get("created_at") or ""
        chunk_id = ofc.get("document_chunk_id") or ""
        
        output_lines.append(f"[{i}] ID: {ofc_id}")
        if title:
            wrapped_title = textwrap.fill(title, width=75, initial_indent="     Title: ", subsequent_indent="              ")
            output_lines.append(wrapped_title)
        if created_at:
            output_lines.append(f"     Created: {created_at}")
        if chunk_id:
            output_lines.append(f"     Chunk ID: {chunk_id}")
        
        # Word-wrap the OFC text for readability
        wrapped_text = textwrap.fill(ofc_text, width=75, initial_indent="     Text: ", subsequent_indent="           ")
        output_lines.append(wrapped_text)
        output_lines.append("")
        output_lines.append("-" * 80)
        output_lines.append("")
    
    output_lines.append(f"\nTotal: {len(ofcs)} PENDING OFCs")
    
    # Print to console
    output_text = "\n".join(output_lines)
    print(output_text)
    
    # Also save to file
    output_file = Path("analytics/reports/pending_ofcs_list.txt")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(output_text, encoding="utf-8")
    print(f"\n[OK] Full list saved to: {output_file}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
