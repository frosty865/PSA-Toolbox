#!/usr/bin/env python3
import json, os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
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

def die(msg: str):
    raise SystemExit(msg)

def get_db():
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_CORPUS_URL + password pattern
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = corpus_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            die(f"Could not parse project_ref from CORPUS_URL: {corpus_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    die("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def q(cur, sql: str, params: Tuple[Any,...]=()):
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    return cols, rows

def cols_for(cur, table: str) -> List[str]:
    _, rows = q(cur, """
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=%s
      ORDER BY ordinal_position
    """, (table,))
    return [r[0] for r in rows]

def table_exists(cur, name: str) -> bool:
    _, rows = q(cur, """
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=%s
    """, (name,))
    return bool(rows)

def pick_destination(cur) -> Dict[str, Any]:
    # Prefer ofc_candidate_queue
    if table_exists(cur, "ofc_candidate_queue"):
        t = "ofc_candidate_queue"
        c = cols_for(cur, t)
        # Try various ID column names
        id_col = None
        for col_name in ["id", "candidate_id", "ofc_candidate_id", "ofc_id"]:
            if col_name in c:
                id_col = col_name
                break
        if not id_col:
            die(f"ofc_candidate_queue missing id column (checked: id, candidate_id, ofc_candidate_id, ofc_id)")
        text_col = None
        for col_name in ["candidate_text", "ofc_text", "snippet_text", "text"]:
            if col_name in c:
                text_col = col_name
                break
        if not text_col:
            die(f"ofc_candidate_queue missing text column (checked: candidate_text, ofc_text, snippet_text, text)")
        chunk_fk = "document_chunk_id" if "document_chunk_id" in c else None
        return {"table": f"public.{t}", "id_col": id_col, "text_col": text_col, "document_chunk_id_col": chunk_fk}

    # Fallback: any table with 'ofc' and 'candidate'
    _, rows = q(cur, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%%ofc%%' AND table_name ILIKE '%%candidate%%'
      ORDER BY table_name
    """)
    for (t,) in rows:
        c = cols_for(cur, t)
        if not any(x in c for x in ["candidate_text","ofc_text","snippet_text","text"]):
            continue
        id_col = None
        for col_name in ["id", "candidate_id", "ofc_candidate_id", "ofc_id"]:
            if col_name in c:
                id_col = col_name
                break
        if not id_col:
            continue
        text_col = None
        for col_name in ["candidate_text", "ofc_text", "snippet_text", "text"]:
            if col_name in c:
                text_col = col_name
                break
        if not text_col:
            continue
        chunk_fk = "document_chunk_id" if "document_chunk_id" in c else None
        return {"table": f"public.{t}", "id_col": id_col, "text_col": text_col, "document_chunk_id_col": chunk_fk}

    die("No OFC candidate destination table found (need ofc_candidate_queue or similar).")

def pick_citations(cur, dest_table_name: str, dest_id_col: str) -> Dict[str, Any]:
    # Check if destination table has document_chunk_id column (direct FK)
    # This is the preferred approach - bind citations directly via FK column
    t_check = dest_table_name.replace("public.", "")
    if table_exists(cur, t_check):
        c_check = cols_for(cur, t_check)
        if "document_chunk_id" in c_check:
            # Destination table has direct FK to chunks - we can use it directly
            return {
                "table": dest_table_name,
                "ofc_fk_col": dest_id_col,
                "chunk_fk_col": "document_chunk_id",
                "use_direct_fk": True
            }
    
    # Check for dedicated citation tables that link candidates to chunks
    if table_exists(cur, "ofc_library_citations"):
        t = "ofc_library_citations"
        c = cols_for(cur, t)
        # find ofc fk col
        ofc_fk = "ofc_id" if "ofc_id" in c else ("candidate_id" if "candidate_id" in c else None)
        chunk_fk = "document_chunk_id" if "document_chunk_id" in c else ("chunk_id" if "chunk_id" in c else None)
        if ofc_fk and chunk_fk:
            return {"table": f"public.{t}", "ofc_fk_col": ofc_fk, "chunk_fk_col": chunk_fk, "use_direct_fk": False}

    # fallback search for any citation table with chunk reference
    _, rows = q(cur, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%%citation%%'
      ORDER BY table_name
    """)
    for (t,) in rows:
        c = cols_for(cur, t)
        chunk_fk = "document_chunk_id" if "document_chunk_id" in c else ("chunk_id" if "chunk_id" in c else None)
        ofc_fk = "ofc_id" if "ofc_id" in c else ("candidate_id" if "candidate_id" in c else None)
        if chunk_fk and ofc_fk:
            return {"table": f"public.{t}", "ofc_fk_col": ofc_fk, "chunk_fk_col": chunk_fk, "use_direct_fk": False}

    # If no citation table exists and destination lacks document_chunk_id,
    # we'll need to add the column (not a new table, so this is allowed)
    # Return a structure indicating we need to add the column
    return {
        "table": dest_table_name,
        "ofc_fk_col": dest_id_col,
        "chunk_fk_col": "document_chunk_id",
        "use_direct_fk": True,
        "needs_column_add": True
    }

def pick_chunks(cur) -> Dict[str, Any]:
    if not table_exists(cur, "document_chunks"):
        die("document_chunks table not found.")
    c = cols_for(cur, "document_chunks")
    # Try various ID column names
    chunk_id = None
    for col_name in ["chunk_id", "id"]:
        if col_name in c:
            chunk_id = col_name
            break
    if not chunk_id:
        die("document_chunks missing id column (checked: chunk_id, id)")
    chunk_text = "chunk_text" if "chunk_text" in c else die("document_chunks missing chunk_text")
    doc_id = "document_id" if "document_id" in c else die("document_chunks missing document_id")
    source_set = "source_set" if "source_set" in c else None
    locator_type = "locator_type" if "locator_type" in c else None
    locator = "locator" if "locator" in c else None
    return {
        "table": "public.document_chunks",
        "chunk_id_col": chunk_id,
        "chunk_text_col": chunk_text,
        "document_id_col": doc_id,
        "source_set_col": source_set,
        "locator_type_col": locator_type,
        "locator_col": locator
    }

def main():
    conn = get_db()
    cur = conn.cursor()

    dest = pick_destination(cur)
    cite = pick_citations(cur, dest["table"], dest["id_col"])
    chunks = pick_chunks(cur)

    # If citation binding needs document_chunk_id column added, add it now
    if cite.get("needs_column_add"):
        t_name = cite["table"].replace("public.", "")
        chunk_id_col = chunks["chunk_id_col"]
        try:
            cur.execute(f"""
                ALTER TABLE {cite["table"]} 
                ADD COLUMN IF NOT EXISTS document_chunk_id UUID REFERENCES public.document_chunks({chunk_id_col}) ON DELETE SET NULL;
            """)
            conn.commit()
            print(f"[OK] Added document_chunk_id column to {cite['table']}")
            # Update the destination table info to reflect the new column
            dest["document_chunk_id_col"] = "document_chunk_id"
        except Exception as e:
            conn.rollback()
            print(f"[WARN] Could not add document_chunk_id column: {e}")
            print("[INFO] You may need to add it manually or use a citation table")

    out = {"destination": dest, "citations": cite, "document_chunks": chunks}
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_mining_targets.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("[OK] Wrote analytics/reports/ofc_mining_targets.json")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
