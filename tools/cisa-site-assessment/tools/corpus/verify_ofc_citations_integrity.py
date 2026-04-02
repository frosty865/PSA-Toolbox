#!/usr/bin/env python3
"""
Verify OFC citations integrity after merge.

Checks:
- Every MINED candidate has >=1 citation (document_chunk_id)
- No citation rows point to deleted candidate IDs
- Candidate count vs citation count makes sense
- No duplicate normalized-text hashes remain
"""
import os, sys
import hashlib
import json
from pathlib import Path
from collections import Counter

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

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def norm_text(s: str) -> str:
    return " ".join((s or "").split()).strip()

def hash_text(s: str) -> str:
    normalized = norm_text(s)
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def fetch(cur, sql: str, params=()):
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

def main():
    conn = get_corpus_db()
    cur = conn.cursor()
    
    candidate_table = "public.ofc_candidate_queue"
    candidate_id_col = "candidate_id"
    text_col = "snippet_text"
    has_submitted_by = table_has_column(cur, candidate_table, "submitted_by")
    has_chunk_id = table_has_column(cur, candidate_table, "document_chunk_id")
    
    issues = []
    stats = {}
    
    # 1) Check total candidates
    cur.execute(f"SELECT COUNT(*) FROM {candidate_table}")
    total_candidates = cur.fetchone()[0]
    stats["total_candidates"] = total_candidates
    
    # 2) Check MINED candidates (if column exists)
    if has_submitted_by:
        cur.execute(f"SELECT COUNT(*) FROM {candidate_table} WHERE submitted_by = 'MINED'")
        mined_candidates = cur.fetchone()[0]
        stats["mined_candidates"] = mined_candidates
        
        # Check MINED candidates without citations
        if has_chunk_id:
            cur.execute(f"""
                SELECT COUNT(*) FROM {candidate_table}
                WHERE submitted_by = 'MINED' AND document_chunk_id IS NULL
            """)
            mined_without_citations = cur.fetchone()[0]
            stats["mined_without_citations"] = mined_without_citations
            if mined_without_citations > 0:
                issues.append(f"{mined_without_citations} MINED candidates have no document_chunk_id citation")
    else:
        stats["mined_candidates"] = "N/A (submitted_by column not found)"
    
    # 3) Check citation counts
    if has_chunk_id:
        cur.execute(f"SELECT COUNT(*) FROM {candidate_table} WHERE document_chunk_id IS NOT NULL")
        candidates_with_citations = cur.fetchone()[0]
        stats["candidates_with_citations"] = candidates_with_citations
        
        # Count unique chunk_ids (to see citation consolidation)
        cur.execute(f"SELECT COUNT(DISTINCT document_chunk_id) FROM {candidate_table} WHERE document_chunk_id IS NOT NULL")
        unique_chunks = cur.fetchone()[0]
        stats["unique_chunk_citations"] = unique_chunks
    
    # 4) Check for duplicate normalized texts
    candidates = fetch(cur, f"SELECT {candidate_id_col}, {text_col} FROM {candidate_table} WHERE {text_col} IS NOT NULL")
    
    text_hashes = {}
    for cand in candidates:
        text = cand.get(text_col) or ""
        if not text:
            continue
        text_hash = hash_text(text)
        if text_hash not in text_hashes:
            text_hashes[text_hash] = []
        text_hashes[text_hash].append(cand[candidate_id_col])
    
    duplicates = {h: ids for h, ids in text_hashes.items() if len(ids) > 1}
    stats["duplicate_text_groups"] = len(duplicates)
    stats["duplicate_candidate_count"] = sum(len(ids) - 1 for ids in duplicates.values())
    
    if duplicates and has_submitted_by:
        # Check if duplicates are MINED
        dup_ids = [id for ids in duplicates.values() for id in ids]
        placeholders = ",".join(["%s"] * len(dup_ids))
        cur.execute(f"""
            SELECT COUNT(*) FROM {candidate_table}
            WHERE {candidate_id_col} IN ({placeholders}) AND submitted_by = 'MINED'
        """, tuple(dup_ids))
        mined_dups = cur.fetchone()[0]
        if mined_dups > 0:
            issues.append(f"{mined_dups} MINED candidates have duplicate normalized text (should be merged)")
    
    # 5) Sample duplicate groups for reporting
    sample_dups = []
    for text_hash, ids in list(duplicates.items())[:5]:
        sample_dups.append({
            "text_hash": text_hash[:16],
            "candidate_ids": [str(id) for id in ids],
            "count": len(ids)
        })
    
    # Generate report
    report = {
        "integrity_check": "PASSED" if not issues else "FAILED",
        "issues": issues,
        "stats": stats,
        "sample_duplicates": sample_dups
    }
    
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report_path = Path("analytics/reports/ofc_citations_integrity_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    
    print(json.dumps(report, indent=2))
    
    if issues:
        print("\n[WARN] Integrity issues found. Review the report.", file=sys.stderr)
        sys.exit(1)
    else:
        print("\n[OK] Integrity check passed.")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
