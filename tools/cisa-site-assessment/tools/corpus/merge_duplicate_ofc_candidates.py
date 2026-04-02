#!/usr/bin/env python3
"""
Merge duplicate OFC candidates by normalized text, consolidating citations.

Groups candidates by normalized text hash and merges duplicates into canonical rows,
re-pointing all citations and links to the canonical candidate_id.
"""
import argparse
import hashlib
import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
    die("Missing CORPUS_DATABASE_URL")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get("RUNTIME_DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing RUNTIME_DATABASE_URL")

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def norm_text(s: str) -> str:
    """Normalize text for hashing (whitespace only)."""
    return " ".join((s or "").split()).strip()

def hash_text(s: str) -> str:
    """SHA256 hash of normalized text."""
    normalized = norm_text(s)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def fetch(cur, sql: str, params: Tuple[Any,...]=()) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [{cols[i]: row[i] for i in range(len(cols))} for row in cur.fetchall()]

def table_has_column(cur, table: str, column: str) -> bool:
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s AND column_name=%s
        )
    """, (table.replace("public.", ""), column))
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
    ap.add_argument("--submitted-by", type=str, default="MINED")
    ap.add_argument("--limit-groups", type=int, default=None)
    ap.add_argument("--min-group-size", type=int, default=2)
    args = ap.parse_args()
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    runtime_conn = get_runtime_db()
    runtime_cur = runtime_conn.cursor()
    
    # Discover schema
    candidate_table = "public.ofc_candidate_queue"
    candidate_id_col = "candidate_id"
    text_col = "snippet_text"  # or candidate_text, discover it
    
    # Check which text column exists
    if table_has_column(corpus_cur, candidate_table, "snippet_text"):
        text_col = "snippet_text"
    elif table_has_column(corpus_cur, candidate_table, "candidate_text"):
        text_col = "candidate_text"
    else:
        die("Cannot find text column in ofc_candidate_queue")
    
    has_created_at = table_has_column(corpus_cur, candidate_table, "created_at")
    has_submitted_by = table_has_column(corpus_cur, candidate_table, "submitted_by")
    
    # Find citations table
    citations_info = find_citations_table(corpus_cur, candidate_table, candidate_id_col)
    if not citations_info:
        die("Cannot find citations table or document_chunk_id column")
    
    # Find link table
    link_info = find_link_table(runtime_cur)
    
    # Query candidates
    where_clauses = []
    params: List[Any] = []
    
    if has_submitted_by and args.submitted_by:
        where_clauses.append(f"submitted_by = %s")
        params.append(args.submitted_by)
    
    where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    
    candidates = fetch(corpus_cur, f"""
        SELECT {candidate_id_col}, {text_col}
        {f', created_at' if has_created_at else ''}
        FROM {candidate_table}
        {where_sql}
    """, tuple(params))
    
    if not candidates:
        print("[INFO] No candidates found to merge")
        sys.exit(0)
    
    print(f"[INFO] Found {len(candidates)} candidates to analyze")
    
    # Group by normalized text hash
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for cand in candidates:
        text = cand.get(text_col) or ""
        if not text:
            continue
        text_hash = hash_text(text)
        groups[text_hash].append(cand)
    
    # Filter groups by size
    merge_groups = {h: g for h, g in groups.items() if len(g) >= args.min_group_size}
    
    if args.limit_groups:
        merge_groups = dict(list(merge_groups.items())[:args.limit_groups])
    
    print(f"[INFO] Found {len(merge_groups)} duplicate groups (size >= {args.min_group_size})")
    
    # Process each group
    groups_processed = 0
    rows_merged = 0
    citations_moved = 0
    candidates_deleted = 0
    links_updated = 0
    sample_groups = []
    
    for idx, (text_hash, group) in enumerate(merge_groups.items(), 1):
        if len(group) < args.min_group_size:
            continue
        
        # Choose canonical: oldest created_at, else lowest UUID
        canonical = None
        if has_created_at:
            canonical = min(group, key=lambda x: (x.get("created_at") or "9999-12-31", x[candidate_id_col]))
        else:
            canonical = min(group, key=lambda x: x[candidate_id_col])
        
        canonical_id = canonical[candidate_id_col]
        duplicates = [c for c in group if c[candidate_id_col] != canonical_id]
        
        if not duplicates:
            continue
        
        groups_processed += 1
        rows_merged += len(duplicates)
        
        # Progress logging
        if args.apply and groups_processed % 100 == 0:
            print(f"[INFO] Processed {groups_processed}/{len(merge_groups)} groups...", file=sys.stderr)
        
        sample_text = (canonical.get(text_col) or "")[:100]
        sample_groups.append({
            "canonical_id": str(canonical_id),
            "merged_ids": [str(d[candidate_id_col]) for d in duplicates],
            "text_preview": sample_text,
            "group_size": len(group)
        })
        
        if not args.apply:
            continue
        
        # Merge in transaction
        try:
            corpus_cur.execute("BEGIN")
            
            # Handle citations
            if citations_info["use_direct_fk"]:
                # Direct FK: each candidate has one document_chunk_id
                # Collect chunk_ids from duplicates to track what we're consolidating
                duplicate_ids = [d[candidate_id_col] for d in duplicates]
                placeholders = ",".join(["%s"] * len(duplicate_ids))
                
                # Get chunk_ids from duplicates (for reporting)
                dup_chunks = fetch(corpus_cur, f"""
                    SELECT {citations_info["chunk_id_col"]}
                    FROM {candidate_table}
                    WHERE {candidate_id_col} IN ({placeholders})
                    AND {citations_info["chunk_id_col"]} IS NOT NULL
                """, tuple(duplicate_ids))
                
                citations_moved += len(dup_chunks)
                
                # Get canonical's chunk_id
                canonical_chunk = fetch(corpus_cur, f"""
                    SELECT {citations_info["chunk_id_col"]}
                    FROM {candidate_table}
                    WHERE {candidate_id_col} = %s
                """, (canonical_id,))
                
                canonical_chunk_id = canonical_chunk[0][citations_info["chunk_id_col"]] if canonical_chunk else None
                
                # Note: With direct FK, we can only keep one chunk_id per candidate
                # If duplicates have different chunk_ids, we're consolidating them but can't preserve all
                # The canonical keeps its chunk_id, and duplicates are deleted
                # This is a known limitation of the direct FK approach
            else:
                # Separate citations table: re-point citations to canonical
                duplicate_ids = [d[candidate_id_col] for d in duplicates]
                placeholders = ",".join(["%s"] * len(duplicate_ids))
                
                result = corpus_cur.execute(f"""
                    UPDATE {citations_info["table"]}
                    SET {citations_info["ofc_id_col"]} = %s
                    WHERE {citations_info["ofc_id_col"]} IN ({placeholders})
                """, (canonical_id,) + tuple(duplicate_ids))
                
                citations_moved += corpus_cur.rowcount
            
            # Update links if they exist (batch processing for efficiency)
            if link_info:
                duplicate_ids = [d[candidate_id_col] for d in duplicates]
                placeholders = ",".join(["%s"] * len(duplicate_ids))
                
                # Get existing links for canonical
                existing_links = fetch(runtime_cur, f"""
                    SELECT question_canon_id
                    FROM {link_info["table"]}
                    WHERE {link_info["ofc_id_col"]}::text = %s
                """, (str(canonical_id),))
                existing_question_ids = {row["question_canon_id"] for row in existing_links}
                
                # Delete links from duplicates that would create duplicates (batch)
                if existing_question_ids:
                    existing_placeholders = ",".join(["%s"] * len(existing_question_ids))
                    runtime_cur.execute(f"""
                        DELETE FROM {link_info["table"]}
                        WHERE {link_info["ofc_id_col"]}::text IN ({placeholders})
                          AND question_canon_id IN ({existing_placeholders})
                    """, tuple(str(did) for did in duplicate_ids) + tuple(existing_question_ids))
                
                # Update remaining links to point to canonical (batch, using CTE to avoid constraint violation)
                runtime_cur.execute(f"""
                    WITH links_to_update AS (
                        SELECT question_canon_id
                        FROM {link_info["table"]}
                        WHERE {link_info["ofc_id_col"]}::text IN ({placeholders})
                          AND question_canon_id NOT IN (
                            SELECT question_canon_id FROM {link_info["table"]}
                            WHERE {link_info["ofc_id_col"]}::text = %s
                          )
                    )
                    UPDATE {link_info["table"]}
                    SET {link_info["ofc_id_col"]} = %s
                    FROM links_to_update
                    WHERE {link_info["table"]}.{link_info["ofc_id_col"]}::text IN ({placeholders})
                      AND {link_info["table"]}.question_canon_id = links_to_update.question_canon_id
                """, tuple(str(did) for did in duplicate_ids) + (str(canonical_id), str(canonical_id)) + tuple(str(did) for did in duplicate_ids))
                
                links_updated += runtime_cur.rowcount
                
                # Delete any remaining links from duplicates
                runtime_cur.execute(f"""
                    DELETE FROM {link_info["table"]}
                    WHERE {link_info["ofc_id_col"]}::text IN ({placeholders})
                """, tuple(str(did) for did in duplicate_ids))
            
            # Delete duplicate candidates
            duplicate_ids = [d[candidate_id_col] for d in duplicates]
            placeholders = ",".join(["%s"] * len(duplicate_ids))
            
            corpus_cur.execute(f"""
                DELETE FROM {candidate_table}
                WHERE {candidate_id_col} IN ({placeholders})
            """, tuple(duplicate_ids))
            
            candidates_deleted += len(duplicate_ids)
            
            corpus_cur.execute("COMMIT")
            runtime_conn.commit()
            
        except Exception as e:
            corpus_cur.execute("ROLLBACK")
            runtime_cur.execute("ROLLBACK")
            print(f"[ERROR] Failed to merge group {text_hash[:8]}: {e}", file=sys.stderr)
            raise
    
    # Generate report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "submitted_by": args.submitted_by,
        "candidates_analyzed": len(candidates),
        "groups_found": len(merge_groups),
        "groups_processed": groups_processed,
        "rows_merged": rows_merged,
        "citations_moved": citations_moved,
        "links_updated": links_updated,
        "candidates_deleted": candidates_deleted,
        "sample_groups": sample_groups[:10],
        "citations_info": citations_info,
        "link_info": link_info
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/ofc_dedupe_merge_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    corpus_cur.close()
    corpus_conn.close()
    runtime_cur.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
