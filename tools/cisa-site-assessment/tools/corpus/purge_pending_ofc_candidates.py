#!/usr/bin/env python3
"""
Purge PENDING MINED/INFERRED OFC candidates.

Removes noisy candidates that don't align to current questions.
Safe, guarded operation - requires ALLOW_PURGE_PENDING=YES for --apply.
"""
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def get_corpus_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing CORPUS_DATABASE_URL")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    raise SystemExit("Missing RUNTIME_DATABASE_URL")

def fetch(cur, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def table_has_column(cur, table: str, column: str) -> bool:
    table_name = table.replace("public.", "")
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s AND column_name=%s
        )
    """, (table_name, column))
    return cur.fetchone()[0]

def find_citations_table(cur, candidate_table: str, candidate_id_col: str) -> Optional[Dict[str, Any]]:
    """Find citations table and its structure."""
    # Check if candidate table has document_chunk_id (direct FK)
    if table_has_column(cur, candidate_table, "document_chunk_id"):
        return {
            "table": candidate_table,
            "ofc_id_col": candidate_id_col,
            "chunk_id_col": "document_chunk_id",
            "use_direct_fk": True
        }
    
    # Check for separate citations tables
    for table_name in ["ofc_library_citations", "canonical_ofc_citations", "ofc_candidate_citations"]:
        if table_has_column(cur, table_name, candidate_id_col) or table_has_column(cur, table_name, "candidate_id"):
            cols = fetch(cur, """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s
            """, (table_name,))
            col_names = [r["column_name"] for r in cols]
            ofc_col = candidate_id_col if candidate_id_col in col_names else ("candidate_id" if "candidate_id" in col_names else None)
            chunk_col = "document_chunk_id" if "document_chunk_id" in col_names else ("chunk_id" if "chunk_id" in col_names else None)
            if ofc_col and chunk_col:
                return {
                    "table": f"public.{table_name}",
                    "ofc_id_col": ofc_col,
                    "chunk_id_col": chunk_col,
                    "use_direct_fk": False
                }
    
    return None

def find_link_table(cur) -> Optional[Dict[str, Any]]:
    """Find ofc_question_links table."""
    if not table_has_column(cur, "ofc_question_links", "ofc_id"):
        return None
    
    cols = fetch(cur, """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ofc_question_links'
    """)
    col_names = [r["column_name"] for r in cols]
    
    # Try to find candidate_id column (might be ofc_id or candidate_id)
    ofc_col = "candidate_id" if "candidate_id" in col_names else ("ofc_id" if "ofc_id" in col_names else None)
    if ofc_col:
        return {
            "table": "public.ofc_question_links",
            "ofc_id_col": ofc_col
        }
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--include-ist", action="store_true", help="Also purge IST_IMPORT candidates (default: false)")
    args = ap.parse_args()
    
    # SAFETY GUARD
    if args.apply and os.environ.get("ALLOW_PURGE_PENDING") != "YES":
        print("[FAIL] Purge --apply blocked. Set ALLOW_PURGE_PENDING=YES environment variable to enable.", file=sys.stderr)
        sys.exit(1)
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    runtime_conn = get_runtime_db()
    runtime_cur = runtime_conn.cursor()
    
    # Discover schema
    candidate_table = "public.ofc_candidate_queue"
    candidate_id_col = "candidate_id"
    
    has_submitted_by = table_has_column(corpus_cur, candidate_table, "submitted_by")
    has_status = table_has_column(corpus_cur, candidate_table, "status")
    
    # Find citations table
    citations_info = find_citations_table(corpus_cur, candidate_table, candidate_id_col)
    
    # Find link table
    link_info = find_link_table(runtime_cur)
    
    # Build purge query
    where_clauses = []
    params: List[Any] = []
    
    if has_submitted_by:
        if args.include_ist:
            where_clauses.append("submitted_by IN ('MINED', 'INFERRED', 'IST_IMPORT')")
        else:
            where_clauses.append("submitted_by IN ('MINED', 'INFERRED')")
    
    if has_status:
        where_clauses.append("status = 'PENDING'")
        mode = "pending_only"
    else:
        mode = "all_mined_inferred"
    
    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    
    # Get purge candidates
    purge_candidates = fetch(corpus_cur, f"""
        SELECT {candidate_id_col}
        FROM {candidate_table}
        {where_sql}
    """, tuple(params))
    
    if not purge_candidates:
        print("[INFO] No candidates found to purge")
        sys.exit(0)
    
    purge_ids = [str(c[candidate_id_col]) for c in purge_candidates]
    print(f"[INFO] Found {len(purge_ids)} candidates to purge", file=sys.stderr)
    
    candidates_deleted = 0
    citations_deleted = 0
    links_deleted = 0
    
    if not args.apply:
        # Dry run: count what would be deleted
        if citations_info:
            if citations_info["use_direct_fk"]:
                # Direct FK: citations are in the candidate table itself
                citations_deleted = len(purge_ids)  # Each candidate has one chunk_id
            else:
                # Separate citations table
                placeholders = ",".join(["%s"] * len(purge_ids))
                cite_count = fetch(corpus_cur, f"""
                    SELECT COUNT(*) as cnt
                    FROM {citations_info["table"]}
                    WHERE {citations_info["ofc_id_col"]} IN ({placeholders})
                """, tuple(purge_ids))
                citations_deleted = cite_count[0]["cnt"] if cite_count else 0
        
        if link_info:
            placeholders = ",".join(["%s"] * len(purge_ids))
            link_count = fetch(runtime_cur, f"""
                SELECT COUNT(*) as cnt
                FROM {link_info["table"]}
                WHERE {link_info["ofc_id_col"]}::text IN ({placeholders})
            """, tuple(purge_ids))
            links_deleted = link_count[0]["cnt"] if link_count else 0
        
        candidates_deleted = len(purge_ids)
        
        print(f"[INFO] DRY RUN: Would delete {candidates_deleted} candidates, {citations_deleted} citations, {links_deleted} links", file=sys.stderr)
    else:
        # Apply: delete in transaction
        try:
            corpus_cur.execute("BEGIN")
            runtime_cur.execute("BEGIN")
            
            placeholders = ",".join(["%s"] * len(purge_ids))
            
            # 1) Delete citations
            if citations_info:
                if citations_info["use_direct_fk"]:
                    # Direct FK: citations are in the candidate table itself, will be deleted with candidates
                    citations_deleted = len(purge_ids)
                else:
                    # Separate citations table
                    corpus_cur.execute(f"""
                        DELETE FROM {citations_info["table"]}
                        WHERE {citations_info["ofc_id_col"]} IN ({placeholders})
                    """, tuple(purge_ids))
                    citations_deleted = corpus_cur.rowcount
            
            # 2) Delete links
            if link_info:
                runtime_cur.execute(f"""
                    DELETE FROM {link_info["table"]}
                    WHERE {link_info["ofc_id_col"]}::text IN ({placeholders})
                """, tuple(purge_ids))
                links_deleted = runtime_cur.rowcount
            
            # 3) Delete candidates
            corpus_cur.execute(f"""
                DELETE FROM {candidate_table}
                WHERE {candidate_id_col} IN ({placeholders})
            """, tuple(purge_ids))
            candidates_deleted = corpus_cur.rowcount
            
            corpus_cur.execute("COMMIT")
            runtime_cur.execute("COMMIT")
            print(f"[INFO] Deleted {candidates_deleted} candidates, {citations_deleted} citations, {links_deleted} links", file=sys.stderr)
            
        except Exception as e:
            corpus_cur.execute("ROLLBACK")
            runtime_cur.execute("ROLLBACK")
            print(f"[ERROR] Failed to purge: {e}", file=sys.stderr)
            raise
    
    # Generate report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "purge_mode": mode,
        "include_ist": args.include_ist,
        "candidates_deleted": candidates_deleted,
        "citations_deleted": citations_deleted,
        "links_deleted": links_deleted,
        "citations_info": citations_info,
        "link_info": link_info
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/purge_pending_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    corpus_cur.close()
    corpus_conn.close()
    runtime_cur.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
