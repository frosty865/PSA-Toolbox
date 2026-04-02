#!/usr/bin/env python3
"""
Mini eval runner: recall@k for a gold set.
Run from psa_rebuild root. Set RAG_EVAL_JSON (path to eval JSON), RAG_EVAL_K (default 8).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

_psa_root = Path(__file__).resolve().parent.parent.parent
if str(_psa_root) not in sys.path:
    sys.path.insert(0, str(_psa_root))

for env_file in (_psa_root / ".local.env", _psa_root / ".env.local"):
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        break

from services.rag.retrieve_topk import open_corpus_conn, retrieve_topk


def main() -> int:
    path = os.getenv("RAG_EVAL_JSON", str(_psa_root / "tools" / "rag" / "eval_set_v1.json"))
    k = int(os.getenv("RAG_EVAL_K", "8"))

    if not Path(path).exists():
        print(f"Eval file not found: {path}", file=sys.stderr)
        return 2

    with open(path, "r", encoding="utf-8") as f:
        data = f.read()
    cases: List[Dict[str, Any]] = json.loads(data)
    if isinstance(cases, dict) and "queries" in cases:
        cases = cases["queries"]
    if not isinstance(cases, list):
        cases = [cases]

    conn = open_corpus_conn()
    try:
        hit = 0
        for i, c in enumerate(cases, start=1):
            q = c.get("query") or c.get("query_text", "")
            gold = set(c.get("gold_chunk_ids") or c.get("expected_chunk_ids", []))
            gold = {str(g) for g in gold}
            tags = c.get("tags_filter") or c.get("tags", {}) or {}
            got = retrieve_topk(conn=conn, query_text=q, k=k, tags_filter=tags)
            got_ids = [x["chunk_id"] for x in got]
            ok = any(g in got_ids for g in gold) if gold else False
            if ok:
                hit += 1
            print(f"[{i:02d}] {'HIT' if ok else 'MISS'}  k={k}  gold={list(gold)[:3]}  top={got_ids[:5]}")
        recall = hit / max(1, len(cases))
        print(f"\nRECALL@{k}: {recall:.3f} ({hit}/{len(cases)})")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
