"""
Mine problem candidates from CORPUS RAG: retrieve top-k chunks, generate candidates via LLM, insert into RUNTIME as PENDING.

Usage (from repo root with PYTHONPATH=psa_rebuild):
  python psa_rebuild/tools/problem_candidates/mine_problem_candidates_from_rag.py \
    --discipline-subtype-id <UUID> \
    --query "battery fire spread parking areas separation distance" \
    --k 8

Requires: CORPUS_DATABASE_URL (or CORPUS_DB_URL), RUNTIME_DATABASE_URL (or RUNTIME_DB_URL/DATABASE_URL), Ollama.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List

# Allow imports from psa_rebuild/services when run from repo root
_PSA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _PSA_ROOT not in sys.path:
    sys.path.insert(0, _PSA_ROOT)

from services.rag.retrieve_topk import open_corpus_conn, retrieve_topk
from services.problem_candidates.generate_and_insert import (
    generate_problem_candidates_from_context,
    insert_problem_candidates,
    open_runtime_conn,
)

PROMPT_NAME = "RAG_CONTEXT_TO_PROBLEMS_V1.txt"


def _prompt_path() -> str:
    return os.path.join(
        _PSA_ROOT,
        "services",
        "problem_candidates",
        "prompts",
        PROMPT_NAME,
    )


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Retrieve RAG context from CORPUS, generate problem candidates, insert into RUNTIME (PENDING)."
    )
    ap.add_argument("--discipline-subtype-id", required=True, help="UUID of discipline_subtypes.id (RUNTIME)")
    ap.add_argument("--query", type=str, required=True, help="Query text for RAG retrieval")
    ap.add_argument("--k", type=int, default=8, help="Number of chunks to retrieve (default 8)")
    ap.add_argument(
        "--tags",
        type=str,
        default='{"source_type":"CORPUS"}',
        help='JSON object for rag_chunks tags filter (default: {"source_type":"CORPUS"})',
    )
    args = ap.parse_args()

    try:
        tags_filter = json.loads(args.tags)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid --tags JSON: {e}", file=sys.stderr)
        return 1

    # Retrieve evidence from CORPUS rag store
    corpus_conn = open_corpus_conn()
    try:
        context = retrieve_topk(
            conn=corpus_conn,
            query_text=args.query,
            k=args.k,
            tags_filter=tags_filter,
        )
    finally:
        corpus_conn.close()

    # Convert to compact context pack
    context_pack: List[Dict[str, Any]] = []
    for r in context:
        context_pack.append(
            {
                "chunk_id": r.get("chunk_id", ""),
                "source_file": r.get("source_file", ""),
                "page_range": r.get("page_range", ""),
                "chunk_text": r.get("chunk_text", ""),
            }
        )

    prompt_path = _prompt_path()
    if not os.path.isfile(prompt_path):
        print(f"[ERROR] Prompt file not found: {prompt_path}", file=sys.stderr)
        return 1

    # Generate problem candidates (JSON)
    out = generate_problem_candidates_from_context(
        discipline_subtype_id=args.discipline_subtype_id,
        context_pack=context_pack,
        prompt_path=prompt_path,
    )

    candidates = out.get("candidates") or []
    if not candidates:
        print(f"[OK] No candidates generated for subtype_id={args.discipline_subtype_id}")
        return 0

    # Insert into RUNTIME
    runtime_conn = open_runtime_conn()
    try:
        n = insert_problem_candidates(
            runtime_conn,
            discipline_subtype_id=args.discipline_subtype_id,
            candidates=candidates,
        )
    finally:
        runtime_conn.close()

    print(f"[OK] Inserted {n} problem_candidates (PENDING) for subtype_id={args.discipline_subtype_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
