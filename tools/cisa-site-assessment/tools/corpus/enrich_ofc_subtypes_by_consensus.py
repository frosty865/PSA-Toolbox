#!/usr/bin/env python3
"""
Enrich OFC subtypes by consensus from candidate question matches.

Deterministic: Only assign subtype when evidence is strong (consensus threshold).
No approvals - just fills in NULL subtypes when confidence is high.
"""
import argparse, json, os
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

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
    dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing CORPUS_DATABASE_URL")

def get_runtime_db():
    import psycopg2
    load_env_file('.env.local')
    dsn = os.environ.get('RUNTIME_DATABASE_URL')
    if dsn:
        return psycopg2.connect(dsn)
    die("Missing RUNTIME_DATABASE_URL")

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def main():
    import sys
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-support", type=int, default=5, help="Minimum number of candidate matches required")
    ap.add_argument("--consensus", type=float, default=0.70, help="Consensus threshold (0.0-1.0)")
    ap.add_argument("--apply", action="store_true", help="Apply subtype assignments (default: dry run)")
    args = ap.parse_args()

    # Load candidate matches from linker output
    candidates_path = Path("analytics/reports/ofc_link_candidates_topN.json")
    if not candidates_path.exists():
        die(f"Missing {candidates_path}. Run linker first (link_ofcs_to_questions_v1.py --topn N).")
    
    candidates_data = json.loads(candidates_path.read_text(encoding="utf-8"))
    results = candidates_data.get("results", [])

    # Collect OFC -> subtype votes from candidate matches
    ofc_subtype_votes: Dict[str, Counter] = defaultdict(Counter)
    ofc_citation_bound: Dict[str, bool] = {}
    
    corpus_conn = get_corpus_db()
    corpus_cur = corpus_conn.cursor()
    
    # Get OFC candidate info from CORPUS
    corpus_cur.execute("""
        SELECT candidate_id, discipline_subtype_id, source_id
        FROM ofc_candidate_queue
        WHERE status = 'PENDING'
    """)
    ofc_info = {str(r[0]): {"subtype_id": r[1], "source_id": r[2]} for r in corpus_cur.fetchall()}
    
    runtime_conn = get_runtime_db()
    runtime_cur = runtime_conn.cursor()
    
    # Get question subtype mappings
    runtime_cur.execute("""
        SELECT DISTINCT canon_id, discipline_subtype_id
        FROM baseline_spines_runtime
        WHERE discipline_subtype_id IS NOT NULL
    """)
    question_subtypes = {str(r[0]): str(r[1]) for r in runtime_cur.fetchall()}

    for result in results:
        qid = str(result.get("question_id", ""))
        q_subtype_id = question_subtypes.get(qid)
        if not q_subtype_id:
            continue
        
        # Check both "candidates" and "promoted" arrays
        candidates_list = result.get("candidates", []) + result.get("promoted", []) + result.get("suggested", [])
        
        for candidate in candidates_list:
            ofc_id = str(candidate.get("ofc_id", ""))
            if not ofc_id or ofc_id not in ofc_info:
                continue
            
            citation_bound = candidate.get("citation_bound", False)
            ofc_citation_bound[ofc_id] = citation_bound
            
            # Only vote if citation-bound
            if citation_bound:
                ofc_subtype_votes[ofc_id][q_subtype_id] += 1

    # Compute consensus for each OFC
    enriched = []
    skipped = defaultdict(int)
    
    for ofc_id, votes in ofc_subtype_votes.items():
        if ofc_id not in ofc_info:
            continue
        
        current_subtype = ofc_info[ofc_id]["subtype_id"]
        
        # Skip if already has subtype
        if current_subtype:
            skipped["already_has_subtype"] += 1
            continue
        
        total_votes = sum(votes.values())
        if total_votes < args.min_support:
            skipped["insufficient_support"] += 1
            continue
        
        # Find most common subtype
        most_common_subtype, count = votes.most_common(1)[0]
        consensus_ratio = count / total_votes
        
        if consensus_ratio >= args.consensus:
            enriched.append({
                "ofc_id": ofc_id,
                "subtype_id": most_common_subtype,
                "consensus_ratio": consensus_ratio,
                "support_count": count,
                "total_votes": total_votes
            })
        else:
            skipped["low_consensus"] += 1

    # Report
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    report = {
        "mode": "APPLY" if args.apply else "DRY_RUN",
        "min_support": args.min_support,
        "consensus_threshold": args.consensus,
        "ofcs_scanned": len(ofc_info),
        "ofcs_with_candidates": len(ofc_subtype_votes),
        "enriched_count": len(enriched),
        "skipped_counts": dict(skipped),
        "enriched_ofcs": enriched[:20]  # Sample
    }
    
    report_path = Path("analytics/reports/ofc_subtype_consensus_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))

    # Apply if requested
    if args.apply and enriched:
        corpus_cur.executemany("""
            UPDATE ofc_candidate_queue
            SET discipline_subtype_id = %s
            WHERE candidate_id = %s
        """, [(e["subtype_id"], e["ofc_id"]) for e in enriched])
        corpus_conn.commit()
        print(f"[OK] Updated {len(enriched)} OFCs with subtype assignments")
    elif args.apply:
        print("[OK] No OFCs to update")

    corpus_cur.close()
    corpus_conn.close()
    runtime_cur.close()
    runtime_conn.close()

if __name__ == "__main__":
    main()
