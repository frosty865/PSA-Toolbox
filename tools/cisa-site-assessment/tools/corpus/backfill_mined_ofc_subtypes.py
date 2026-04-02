#!/usr/bin/env python3
"""
Backfill discipline_subtype_id for existing MINED OFC candidates.

Uses the same deterministic lexicon-based classifier as the miner.
Only assigns subtypes when confidence thresholds are met.
"""
import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional

# Import subtype lexicon
sys.path.insert(0, str(Path(__file__).parent))
from subtype_lexicon import build_lexicon, classify_subtype

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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--submitted-by", type=str, default="MINED")
    ap.add_argument("--subtype-min-score", type=float, default=0.35)
    ap.add_argument("--subtype-margin", type=float, default=1.35)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    
    # SAFETY GUARD
    if args.apply and os.environ.get("ALLOW_SUBTYPE_BACKFILL") != "YES":
        print("[FAIL] Backfill --apply blocked. Set ALLOW_SUBTYPE_BACKFILL=YES environment variable to enable.", file=sys.stderr)
        sys.exit(1)
    
    # Load lexicon
    print("[INFO] Building subtype lexicon...", file=sys.stderr)
    lexicon = build_lexicon()
    print(f"[INFO] Loaded lexicon for {len(lexicon)} subtypes", file=sys.stderr)
    
    # Connect to database
    conn = get_corpus_db()
    cur = conn.cursor()
    
    # Discover schema
    candidate_table = "public.ofc_candidate_queue"
    candidate_id_col = "candidate_id"
    
    # Find text column
    if table_has_column(cur, candidate_table, "snippet_text"):
        text_col = "snippet_text"
    elif table_has_column(cur, candidate_table, "candidate_text"):
        text_col = "candidate_text"
    else:
        print("[FAIL] Cannot find text column in ofc_candidate_queue", file=sys.stderr)
        sys.exit(1)
    
    has_submitted_by = table_has_column(cur, candidate_table, "submitted_by")
    has_discipline_subtype_id = table_has_column(cur, candidate_table, "discipline_subtype_id")
    
    if not has_discipline_subtype_id:
        print("[FAIL] discipline_subtype_id column does not exist in ofc_candidate_queue", file=sys.stderr)
        sys.exit(1)
    
    # Query candidates without subtype
    where_clauses = ["discipline_subtype_id IS NULL"]
    params: List[Any] = []
    
    if has_submitted_by and args.submitted_by:
        where_clauses.append("submitted_by = %s")
        params.append(args.submitted_by)
    
    limit_clause = f"LIMIT {args.limit}" if args.limit else ""
    
    candidates = fetch(cur, f"""
        SELECT {candidate_id_col}, {text_col}
        FROM {candidate_table}
        WHERE {' AND '.join(where_clauses)}
        {limit_clause}
    """, tuple(params))
    
    if not candidates:
        print("[INFO] No candidates found without subtype assignment")
        sys.exit(0)
    
    print(f"[INFO] Found {len(candidates)} candidates to scan", file=sys.stderr)
    
    # Classify and update
    scanned = 0
    assigned = 0
    skipped_low_confidence = 0
    subtype_assigned_by_code = Counter()
    
    for cand in candidates:
        scanned += 1
        candidate_id = cand[candidate_id_col]
        text = cand.get(text_col) or ""
        
        if not text:
            continue
        
        # Classify
        subtype_id, explanation = classify_subtype(
            text,
            lexicon,
            min_score=args.subtype_min_score,
            margin=args.subtype_margin
        )
        
        if not subtype_id:
            skipped_low_confidence += 1
            continue
        
        # Update
        if args.apply:
            cur.execute(f"""
                UPDATE {candidate_table}
                SET discipline_subtype_id = %s
                WHERE {candidate_id_col} = %s
            """, (subtype_id, candidate_id))
        
        assigned += 1
        subtype_code = lexicon[subtype_id]["code"]
        subtype_assigned_by_code[subtype_code] += 1
        
        # Progress logging
        if scanned % 100 == 0:
            print(f"[INFO] Scanned {scanned}/{len(candidates)}...", file=sys.stderr)
    
    if args.apply:
        conn.commit()
        print(f"[INFO] Updated {assigned} candidates", file=sys.stderr)
    else:
        print(f"[INFO] DRY RUN: Would update {assigned} candidates", file=sys.stderr)
    
    # Generate report
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "submitted_by": args.submitted_by,
        "scanned": scanned,
        "assigned": assigned,
        "skipped_low_confidence": skipped_low_confidence,
        "top_assigned_subtypes": dict(subtype_assigned_by_code.most_common(20)),
        "thresholds": {
            "min_score": args.subtype_min_score,
            "margin": args.subtype_margin
        }
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/ofc_subtype_backfill_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
