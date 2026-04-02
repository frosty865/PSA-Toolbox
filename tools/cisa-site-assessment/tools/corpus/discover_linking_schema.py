#!/usr/bin/env python3
import json, os, re
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

def get_runtime_db():
    """Get RUNTIME database connection (for questions and OFCs)."""
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    # Try direct RUNTIME_DATABASE_URL first
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    # Fallback to SUPABASE_RUNTIME_URL + password pattern
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
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing RUNTIME_DATABASE_URL or SUPABASE_RUNTIME_URL + SUPABASE_RUNTIME_DB_PASSWORD.")

def get_corpus_db():
    """Get CORPUS database connection (for citations and chunks)."""
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    # Try direct CORPUS_DATABASE_URL first
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
            raise SystemExit(f"Could not parse project_ref from CORPUS_URL: {corpus_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            # Try direct port
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    raise SystemExit("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def q(conn, sql: str, params: Tuple[Any,...]=()):
    cur = conn.cursor()
    try:
        cur.execute(sql, params)
        rows = cur.fetchall()
        if cur.description:
            cols = [d[0] for d in cur.description]
        else:
            cols = []
        cur.close()
        return cols, rows
    except Exception as e:
        cur.close()
        import traceback
        tb = traceback.format_exc()
        raise SystemExit(f"SQL error in discovery: {type(e).__name__}: {e}\n{tb}\nSQL: {sql[:200]}\nParams: {params}") from e

def find_table_by_name(conn, name: str) -> Optional[str]:
    cols, rows = q(conn, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name=%s
    """, (name,))
    return rows[0][0] if rows and len(rows) > 0 else None

def table_columns(conn, table: str) -> List[str]:
    cols, rows = q(conn, """
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=%s
      ORDER BY ordinal_position
    """, (table,))
    return [r[0] for r in rows]

def grep_review_ui_for_ofc_table() -> Optional[str]:
    # Infer OFC table from app/review/quarantined/page.tsx by searching for .from("TABLE")
    p = Path("app/review/quarantined/page.tsx")
    if not p.exists():
        return None
    txt = p.read_text(encoding="utf-8", errors="replace")
    m = re.search(r'\.from\(["\']([a-zA-Z0-9_]+)["\']\)', txt)
    return m.group(1) if m else None

def pick_question_table(conn) -> Dict[str, Any]:
    # Prefer baseline_spines_runtime
    if find_table_by_name(conn, "baseline_spines_runtime"):
        t = "baseline_spines_runtime"
        cols = table_columns(conn, t)
        # choose canonical id and prompt fields deterministically
        qid = "canon_id" if "canon_id" in cols else ("question_canon_id" if "question_canon_id" in cols else None)
        qtxt = "question_text" if "question_text" in cols else ("prompt" if "prompt" in cols else None)
        if not qid or not qtxt:
            raise SystemExit("baseline_spines_runtime exists but lacks canon_id/question_text-like columns.")
        # Prefer discipline_subtype_id (UUID) over subtype_code (string) for UUID-to-UUID matching
        subtype = None
        if "discipline_subtype_id" in cols:
            subtype = "discipline_subtype_id"
        elif "discipline_subtype_code" in cols:
            subtype = "discipline_subtype_code"
        elif "subtype_code" in cols:
            subtype = "subtype_code"  # Fallback for legacy
        return {"name": f"public.{t}", "columns": cols, "question_id_col": qid, "question_text_col": qtxt, "subtype_col": subtype}

    # Fallback: search for tables with question_text + canon_id
    cols, rows = q(conn, """
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema='public'
      GROUP BY table_name
      HAVING
        SUM(CASE WHEN column_name IN ('canon_id','question_canon_id') THEN 1 ELSE 0 END) > 0
        AND SUM(CASE WHEN column_name IN ('question_text','prompt') THEN 1 ELSE 0 END) > 0
    """)
    if not rows:
        raise SystemExit("No question table found (need canon_id + question_text/prompt).")
    t = rows[0][0]
    tcols = table_columns(conn, t)
    qid = "canon_id" if "canon_id" in tcols else "question_canon_id"
    qtxt = "question_text" if "question_text" in tcols else "prompt"
    # Prefer discipline_subtype_id (UUID) over subtype_code (string) for UUID-to-UUID matching
    subtype = None
    if "discipline_subtype_id" in tcols:
        subtype = "discipline_subtype_id"
    elif "discipline_subtype_code" in tcols:
        subtype = "discipline_subtype_code"
    elif "subtype_code" in tcols:
        subtype = "subtype_code"  # Fallback for legacy
    return {"name": f"public.{t}", "columns": tcols, "question_id_col": qid, "question_text_col": qtxt, "subtype_col": subtype}

def pick_ofc_table(conn, prefer_candidates: bool = False) -> Dict[str, Any]:
    inferred = grep_review_ui_for_ofc_table()
    candidates = []
    cols, rows = q(conn, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
        AND (table_name ILIKE '%%ofc%%' OR table_name ILIKE '%%candidate%%')
      ORDER BY table_name
    """)
    candidates = [r[0] for r in rows]

    if inferred and inferred in candidates:
        t = inferred
    else:
        # If prefer_candidates, prioritize candidate tables
        if prefer_candidates:
            candidate_tables = [c for c in candidates if "candidate" in c.lower()]
            for c in candidate_tables:
                ccols = table_columns(conn, c)
                if any(x in ccols for x in ["ofc_text","text","candidate_text","snippet_text"]):
                    t = c
                    break
            if t:
                pass  # Found candidate table
            else:
                # Fallback to other OFC tables
                t = None
                for c in candidates:
                    ccols = table_columns(conn, c)
                    if any(x in ccols for x in ["ofc_text","text","candidate_text","snippet_text"]):
                        t = c
                        break
        else:
            # pick the first candidate that has a text column
            t = None
            for c in candidates:
                ccols = table_columns(conn, c)
                if any(x in ccols for x in ["ofc_text","text","candidate_text","snippet_text"]):
                    t = c
                    break
        if not t:
            raise SystemExit("No OFC table found. Cannot proceed.")

    tcols = table_columns(conn, t)
    # Handle different ID column names
    oid = None
    for col in ["canonical_ofc_id", "ofc_id", "id", "candidate_id"]:
        if col in tcols:
            oid = col
            break
    # Handle different text column names
    otext = None
    for col in ["ofc_text", "candidate_text", "text", "snippet_text"]:
        if col in tcols:
            otext = col
            break
    if not oid or not otext:
        raise SystemExit(f"OFC table {t} missing id/ofc_text-like columns. Found: {tcols}")
    # Handle subtype columns (could be UUID reference or code)
    subtype = None
    for col in ["discipline_subtype_code", "subtype_code", "discipline_subtype_id", "subtype_id"]:
        if col in tcols:
            subtype = col
            break
    
    # Capture optional columns for external verification
    submitted_by_col = "submitted_by" if "submitted_by" in tcols else None
    source_registry_id_col = "source_registry_id" if "source_registry_id" in tcols else None
    source_id_col = "source_id" if "source_id" in tcols else None

    result = {
        "name": f"public.{t}",
        "columns": tcols,
        "ofc_id_col": oid,
        "ofc_text_col": otext,
        "subtype_col": subtype
    }
    
    # Add optional columns if they exist
    if submitted_by_col:
        result["submitted_by_col"] = submitted_by_col
    if source_registry_id_col:
        result["source_registry_id_col"] = source_registry_id_col
    if source_id_col:
        result["source_id_col"] = source_id_col

    return result

def pick_citation_table(conn, ofc_id_col_guess: str, ofc_table_name: str = "", ofc_table_cols: List[str] = None) -> Dict[str, Any]:
    # If OFC table is ofc_candidate_queue and has document_chunk_id, citations are direct FK
    if "candidate_queue" in ofc_table_name.lower() and ofc_table_cols:
        if "document_chunk_id" in ofc_table_cols:
            # Citations are bound directly via document_chunk_id column
            return {
                "name": ofc_table_name,  # Same table
                "columns": ofc_table_cols,
                "ofc_id_col": ofc_id_col_guess,
                "use_direct_fk": True,
                "chunk_fk_col": "document_chunk_id"
            }
    
    # If OFC table is canonical_ofcs, prefer canonical_ofc_citations
    if "canonical_ofc" in ofc_table_name.lower():
        if find_table_by_name(conn, "canonical_ofc_citations"):
            t = "canonical_ofc_citations"
            cols = table_columns(conn, t)
            oc = "canonical_ofc_id" if "canonical_ofc_id" in cols else ("ofc_id" if "ofc_id" in cols else None)
            if not oc:
                raise SystemExit("canonical_ofc_citations exists but cannot identify ofc id column.")
            return {"name": f"public.{t}", "columns": cols, "ofc_id_col": oc}
    
    # Prefer ofc_library_citations if exists
    if find_table_by_name(conn, "ofc_library_citations"):
        t = "ofc_library_citations"
        cols = table_columns(conn, t)
        # determine ofc id col
        if ofc_id_col_guess in cols:
            oc = ofc_id_col_guess
        else:
            # common fallbacks
            oc = "ofc_id" if "ofc_id" in cols else ("candidate_id" if "candidate_id" in cols else None)
        if not oc:
            raise SystemExit("ofc_library_citations exists but cannot identify ofc id column.")
        return {"name": f"public.{t}", "columns": cols, "ofc_id_col": oc}
    
    # Check canonical_ofc_citations (governance workflow)
    if find_table_by_name(conn, "canonical_ofc_citations"):
        t = "canonical_ofc_citations"
        cols = table_columns(conn, t)
        # determine ofc id col
        if ofc_id_col_guess in cols:
            oc = ofc_id_col_guess
        else:
            # common fallbacks
            oc = "canonical_ofc_id" if "canonical_ofc_id" in cols else ("ofc_id" if "ofc_id" in cols else None)
        if not oc:
            raise SystemExit("canonical_ofc_citations exists but cannot identify ofc id column.")
        return {"name": f"public.{t}", "columns": cols, "ofc_id_col": oc}

    # Fallback: any table with 'citation' in name and a plausible ofc id column
    cols, rows = q(conn, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%%citation%%'
      ORDER BY table_name
    """)
    for (t,) in rows:
        tcols = table_columns(conn, t)
        # Try various OFC ID column names
        for oc in [ofc_id_col_guess, "canonical_ofc_id", "ofc_id", "candidate_id", "ofc_candidate_id"]:
            if oc in tcols:
                return {"name": f"public.{t}", "columns": tcols, "ofc_id_col": oc}
    raise SystemExit("No citation table found (need ofc_library_citations, canonical_ofc_citations, or a %citation% table).")

def pick_link_table(conn, qid: str, oid: str) -> Optional[Dict[str, Any]]:
    # Prefer public.ofc_question_links if it exists
    if find_table_by_name(conn, "ofc_question_links"):
        t = "ofc_question_links"
        tcols = table_columns(conn, t)
        # Verify required columns exist
        required_cols = ["question_canon_id", "ofc_id", "link_score", "link_method", "link_explanation"]
        missing_cols = [col for col in required_cols if col not in tcols]
        if missing_cols:
            raise SystemExit(f"ofc_question_links table exists but missing required columns: {missing_cols}")
        
        qcol = "question_canon_id"
        ocol = "ofc_id"
        score_col = "link_score"
        method_col = "link_method"
        expl_col = "link_explanation"
        return {"name": f"public.{t}", "columns": tcols, "question_id_col": qcol, "ofc_id_col": ocol,
                "score_col": score_col, "method_col": method_col, "explanation_col": expl_col}
    
    # Fallback: search for other link tables
    cols, rows = q(conn, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%%ofc%%link%%'
      ORDER BY table_name
    """)
    candidates = [r[0] for r in rows]
    # broaden search
    if not candidates:
        cols, rows = q(conn, """
          SELECT table_name FROM information_schema.tables
          WHERE table_schema='public' AND table_name ILIKE '%%ofc%%question%%'
          ORDER BY table_name
        """)
        candidates = [r[0] for r in rows]

    for t in candidates:
        tcols = table_columns(conn, t)
        # find cols that look like question id and ofc id
        qcol = qid if qid in tcols else ("question_canon_id" if "question_canon_id" in tcols else ("canon_id" if "canon_id" in tcols else None))
        ocol = oid if oid in tcols else ("ofc_id" if "ofc_id" in tcols else ("candidate_id" if "candidate_id" in tcols else None))
        if qcol and ocol:
            score_col = "link_score" if "link_score" in tcols else ("score" if "score" in tcols else None)
            method_col = "link_method" if "link_method" in tcols else None
            expl_col = "link_explanation" if "link_explanation" in tcols else None
            return {"name": f"public.{t}", "columns": tcols, "question_id_col": qcol, "ofc_id_col": ocol,
                    "score_col": score_col, "method_col": method_col, "explanation_col": expl_col}
    return None

def main():
    # Questions are in RUNTIME
    runtime_conn = get_runtime_db()
    qinfo = pick_question_table(runtime_conn)
    
    # Check CORPUS first for mined candidates (ofc_candidate_queue)
    corpus_conn = get_corpus_db()
    oinfo = None
    ofc_db = "RUNTIME"
    
    # Try CORPUS first for candidates
    try:
        if find_table_by_name(corpus_conn, "ofc_candidate_queue"):
            oinfo_temp = pick_ofc_table(corpus_conn, prefer_candidates=True)
            # Verify citation discovery works for candidates
            try:
                cinfo_temp = pick_citation_table(corpus_conn, oinfo_temp["ofc_id_col"], oinfo_temp["name"], oinfo_temp.get("columns", []))
                # If we get here, both OFC and citation discovery worked
                oinfo = oinfo_temp
                ofc_db = "CORPUS"
                print(f"[INFO] Using CORPUS candidates: {oinfo['name']}")
            except Exception as e2:
                print(f"[INFO] CORPUS citation discovery failed: {e2}, falling back to RUNTIME")
                oinfo = None
    except Exception as e:
        print(f"[INFO] Could not use CORPUS candidates: {e}")
        oinfo = None
    
    # Fallback to RUNTIME
    if not oinfo:
        oinfo = pick_ofc_table(runtime_conn)
        ofc_db = "RUNTIME"
    
    # Citations should be in same DB as OFCs
    ofc_conn = corpus_conn if ofc_db == "CORPUS" else runtime_conn
    cinfo = pick_citation_table(ofc_conn, oinfo["ofc_id_col"], oinfo["name"], oinfo.get("columns", []))
    
    # Link table could be in either - try RUNTIME first (more likely)
    linfo = pick_link_table(runtime_conn, qinfo["question_id_col"], oinfo["ofc_id_col"])
    if not linfo:
        linfo = pick_link_table(corpus_conn, qinfo["question_id_col"], oinfo["ofc_id_col"])

    # Discover source_registry table in CORPUS (for external verification)
    source_registry_info = None
    if find_table_by_name(corpus_conn, "source_registry"):
        sr_cols = table_columns(corpus_conn, "source_registry")
        has_status = "status" in sr_cols
        source_registry_info = {
            "name": "public.source_registry",
            "columns": sr_cols,
            "has_status_column": has_status
        }

    out = {
        "selected_question_table": qinfo,
        "selected_ofc_table": oinfo,
        "selected_citation_table": cinfo,
        "selected_link_table": linfo,
        "selected_source_registry": source_registry_info,
        "databases": {
            "questions": "RUNTIME",
            "ofcs": ofc_db,
            "citations": ofc_db,
            "link_table": "RUNTIME" if linfo else None,
            "source_registry": "CORPUS" if source_registry_info else None
        }
    }

    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports/ofc_link_schema_discovery.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    runtime_conn.close()
    corpus_conn.close()
    print("[OK] Wrote analytics/reports/ofc_link_schema_discovery.json")

if __name__ == "__main__":
    main()
