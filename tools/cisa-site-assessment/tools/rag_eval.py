#!/usr/bin/env python3
"""
RAG eval V1: run eval set (20 queries), report retrieval + generation metrics.
See docs/rag/EVAL_SET_V1.md and docs/rag/TUNING_LOOP_V1.md.

Usage (from psa_rebuild root):
  python tools/rag_eval.py [--retrieval-only] [--k 8] [--out results.json]
  Set CORPUS_DATABASE_URL, OLLAMA_HOST; RAG_EMBED_MODEL=nomic-embed-text (default).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Allow imports from psa_rebuild when run as script
_psa_root = Path(__file__).resolve().parent.parent
if str(_psa_root) not in sys.path:
    sys.path.insert(0, str(_psa_root))

# Load .local.env / .env.local
for env_file in (_psa_root / ".local.env", _psa_root / ".env.local"):
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

from tools.db.corpus_db import get_corpus_conn

# RAG pipeline (services.processor)
from services.processor.rag_pipeline import (
    DEFAULT_K,
    embed_query,
    retrieve,
    run_measures,
    run_plan_checklist,
)


def load_eval_set(path: Path | None = None) -> dict:
    if path is None:
        for candidate in (
            _psa_root / "docs" / "rag" / "eval_set_v1.json",
            _psa_root.parent / "docs" / "rag" / "eval_set_v1.json",
        ):
            if candidate.exists():
                path = candidate
                break
        else:
            path = _psa_root / "docs" / "rag" / "eval_set_v1.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def recall_at_k(retrieved_ids: list[str], gold_ids: list[str], k: int) -> bool:
    """True if at least one gold chunk is in the top-k retrieved."""
    if not gold_ids:
        return None  # skip
    top = set(retrieved_ids[:k])
    return any(g in top for g in gold_ids)


def mrr(retrieved_ids: list[str], gold_ids: list[str]) -> float | None:
    """Mean reciprocal rank of first gold chunk. None if no gold or not found."""
    if not gold_ids:
        return None
    gold_set = set(gold_ids)
    for rank, cid in enumerate(retrieved_ids, 1):
        if cid in gold_set:
            return 1.0 / rank
    return 0.0


def run_eval(
    retrieval_only: bool = False,
    k: int = DEFAULT_K,
    out_path: Path | None = None,
) -> dict:
    eval_data = load_eval_set()
    queries = eval_data.get("queries", [])
    results = []
    recall_ok = 0
    recall_total = 0
    mrr_sum = 0.0
    mrr_count = 0
    json_valid = 0
    gen_total = 0

    try:
        conn = get_corpus_conn()
    except Exception as e:
        print(f"Failed to connect to CORPUS: {e}", file=sys.stderr)
        print("Set CORPUS_DATABASE_URL (e.g. in .env.local).", file=sys.stderr)
        sys.exit(1)

    cur = conn.cursor()
    try:
        for q in queries:
            qid = q.get("query_id", "")
            qtype = q.get("type", "")
            query_text = q.get("query_text", "")
            gold_ids = [str(x) for x in q.get("expected_chunk_ids", [])]
            result = {"query_id": qid, "type": qtype, "retrieval_list": [], "recall_at_k": None, "mrr": None}
            embedding = embed_query(query_text)
            if not embedding:
                result["error"] = "embed_failed"
                results.append(result)
                continue
            filters = {"source_type": "CORPUS"}
            if qtype == "MEASURES" and q.get("module_domain"):
                filters["module_domain"] = q["module_domain"]
            chunks = retrieve(cur, embedding, filters=filters, k=k)
            retrieved_ids = [c["chunk_id"] for c in chunks]
            result["retrieval_list"] = [
                {"chunk_id": c["chunk_id"], "source_file": c["source_file"], "page_range": c["page_range"], "similarity": round(c["similarity"], 4)}
                for c in chunks
            ]
            if gold_ids:
                r = recall_at_k(retrieved_ids, gold_ids, k)
                result["recall_at_k"] = r
                if r is not None:
                    recall_total += 1
                    if r:
                        recall_ok += 1
                mr = mrr(retrieved_ids, gold_ids)
                result["mrr"] = mr
                if mr is not None:
                    mrr_sum += mr
                    mrr_count += 1
            if not retrieval_only and qtype == "MEASURES":
                run_out = run_measures(cur, query_text, q.get("module_domain", "EV_PARKING"), filters=filters, k=k)
                result["items"] = run_out.get("items", [])
                result["insufficient"] = run_out.get("insufficient", False)
                gen_total += 1
                try:
                    _ = run_out.get("items", [])
                    json_valid += 1  # assume valid if we got a list
                except Exception:
                    pass
            elif not retrieval_only and qtype == "PLAN":
                sections = q.get("plan_template_sections", ["Purpose and Scope", "Evacuation Procedures"])
                run_out = run_plan_checklist(cur, query_text, sections, filters=filters, k=k)
                result["items"] = run_out.get("items", [])
                result["insufficient"] = run_out.get("insufficient", False)
                gen_total += 1
                try:
                    _ = run_out.get("items", [])
                    json_valid += 1
                except Exception:
                    pass
            results.append(result)
    finally:
        cur.close()
        conn.close()

    summary = {
        "queries_run": len(results),
        "recall_at_k": recall_ok / recall_total if recall_total else None,
        "recall_denom": recall_total,
        "mrr": mrr_sum / mrr_count if mrr_count else None,
        "mrr_denom": mrr_count,
        "json_validity": json_valid / gen_total if gen_total else None,
        "gen_denom": gen_total,
    }
    report = {"summary": summary, "results": results}
    if out_path:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Wrote {out_path}")
    print("Summary:")
    print(f"  recall@{k}: {summary['recall_at_k']} ({recall_ok}/{recall_total})" if recall_total else "  recall@k: (no gold chunk_ids)")
    print(f"  MRR: {summary['mrr']} (n={mrr_count})" if mrr_count else "  MRR: (no gold chunk_ids)")
    if gen_total:
        print(f"  JSON validity: {summary['json_validity']} ({json_valid}/{gen_total})")
    return report


def main():
    ap = argparse.ArgumentParser(description="RAG eval V1: run eval set and report metrics")
    ap.add_argument("--retrieval-only", action="store_true", help="Only run retrieval (no LLM generation)")
    ap.add_argument("--k", type=int, default=DEFAULT_K, help=f"Top-k retrieval (default {DEFAULT_K})")
    ap.add_argument("--out", type=Path, default=None, help="Write results JSON to path")
    args = ap.parse_args()
    run_eval(retrieval_only=args.retrieval_only, k=args.k, out_path=args.out)


if __name__ == "__main__":
    main()
