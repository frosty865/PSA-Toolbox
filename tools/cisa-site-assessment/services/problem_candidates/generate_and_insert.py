"""
Generate problem candidates from RAG context (LLM) and insert into RUNTIME.problem_candidates as PENDING.
De-dup by exact problem_statement within subtype (soft: check before insert).
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Union

import psycopg2
import requests


def _ollama_chat(prompt_system: str, prompt_user: str) -> str:
    base = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_CHAT_MODEL", "llama3.1:8b")
    resp = requests.post(
        f"{base}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": prompt_user},
            ],
            "stream": False,
        },
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["message"]["content"]


def insert_problem_candidates(
    runtime_conn,
    *,
    discipline_subtype_id: str,
    candidates: List[Dict[str, Any]],
) -> int:
    """
    Insert as PENDING. De-dup by exact problem_statement within subtype (soft).
    discipline_subtype_id must be a UUID string (RUNTIME.discipline_subtypes.id).
    """
    n = 0
    with runtime_conn.cursor() as cur:
        for c in candidates:
            stmt = (c.get("problem_statement") or "").strip()
            evidence = {
                "evidence_excerpt": c.get("evidence_excerpt") or "",
                "citations": c.get("citations") or [],
            }
            if not stmt:
                continue

            # Soft de-dup: skip if same subtype + exact statement already exists
            cur.execute(
                """
                SELECT 1 FROM public.problem_candidates
                WHERE discipline_subtype_id = %s::uuid AND problem_statement = %s
                LIMIT 1
                """,
                (discipline_subtype_id, stmt),
            )
            if cur.fetchone():
                continue

            cur.execute(
                """
                INSERT INTO public.problem_candidates
                  (discipline_subtype_id, problem_statement, evidence, status)
                VALUES
                  (%s::uuid, %s, %s::jsonb, 'PENDING')
                """,
                (discipline_subtype_id, stmt, json.dumps(evidence)),
            )
            n += 1
    runtime_conn.commit()
    return n


def generate_problem_candidates_from_context(
    *,
    discipline_subtype_id: Union[str, int],
    context_pack: List[Dict[str, Any]],
    prompt_path: str,
) -> Dict[str, Any]:
    with open(prompt_path, "r", encoding="utf-8") as f:
        system_prompt = f.read()

    user_payload = {
        "discipline_subtype_id": discipline_subtype_id,
        "context_pack": context_pack,
    }
    raw = _ollama_chat(system_prompt, json.dumps(user_payload, ensure_ascii=False))
    return json.loads(raw)


def open_runtime_conn():
    url = os.getenv("RUNTIME_DATABASE_URL") or os.getenv("RUNTIME_DB_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Missing RUNTIME_DATABASE_URL, RUNTIME_DB_URL, or DATABASE_URL.")
    return psycopg2.connect(url)
