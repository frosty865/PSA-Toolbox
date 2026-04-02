"""
RAG pipeline V1: embed query → retrieve top-k (with filters) → context pack → LLM.
See docs/rag/RAG_PIPELINE_V1.md.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

from .model.ollama_client import ollama_chat, ollama_embed

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

# Lock embedding model; must match rag_chunks.embedding dimension (768 for nomic-embed-text).
DEFAULT_EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
DEFAULT_CHAT_MODEL = os.environ.get("RAG_CHAT_MODEL", "llama3.2")
DEFAULT_K = 8


class RetrievedChunk(TypedDict):
    chunk_id: str
    source_file: str
    page_range: str
    chunk_text: str
    similarity: float


def _embedding_to_literal(embedding: List[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in embedding) + "]"


def embed_query(text: str, model: str | None = None) -> List[float] | None:
    """Embed query text via Ollama. Returns vector or None."""
    return ollama_embed(text or "", model=model or DEFAULT_EMBED_MODEL)


def retrieve(
    cur: Any,
    query_embedding: List[float],
    filters: Optional[Dict[str, Any]] = None,
    k: int = DEFAULT_K,
) -> List[RetrievedChunk]:
    """
    Retrieve top-k chunks by cosine similarity, applying tags filter.
    cur: psycopg2 cursor (CORPUS DB, rag_chunks table must exist).
    """
    if not query_embedding:
        return []
    filters = filters or {"source_type": "CORPUS"}
    tags_json = json.dumps(filters)
    vec_literal = _embedding_to_literal(query_embedding)
    try:
        cur.execute(
            """
            SELECT chunk_id, source_file, page_range, chunk_text,
                   1 - (embedding <=> %s::vector) AS similarity
            FROM public.rag_chunks
            WHERE tags @> %s::jsonb
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (vec_literal, tags_json, vec_literal, k),
        )
        rows = cur.fetchall()
    except Exception:
        return []
    return [
        {
            "chunk_id": str(r[0]),
            "source_file": str(r[1] or ""),
            "page_range": str(r[2] or ""),
            "chunk_text": str(r[3] or ""),
            "similarity": float(r[4]) if r[4] is not None else 0.0,
        }
        for r in rows
    ]


def build_context_pack(chunks: List[RetrievedChunk]) -> str:
    """Format chunks for LLM: chunk_id, source_file, page_range, chunk_text."""
    parts = []
    for i, c in enumerate(chunks, 1):
        parts.append(
            f"[Chunk {i}] chunk_id={c['chunk_id']} source_file={c['source_file']} page_range={c['page_range']}\n{c['chunk_text']}"
        )
    return "\n\n".join(parts)


def answer_from_context(
    query_text: str,
    context_pack: str,
    model: str | None = None,
    timeout: int = 300,
) -> str:
    """
    Call LLM with system prompt (answer only from context, cite chunk_ids) and user content (query + context).
    """
    system = "Answer ONLY from the provided context. Cite chunk_id for each claim. Do not invent content."
    user = f"Query: {query_text}\n\nContext:\n{context_pack}"
    full_prompt = f"{system}\n\n{user}"
    return ollama_chat(model or DEFAULT_CHAT_MODEL, full_prompt, temperature=0.2, timeout=timeout)


def rag_run(
    cur: Any,
    query_text: str,
    filters: Optional[Dict[str, Any]] = None,
    k: int = DEFAULT_K,
    chat_model: str | None = None,
    similarity_threshold: float = 0.0,
) -> Dict[str, Any]:
    """
    Full RAG pipeline: embed → retrieve → context pack → LLM.
    Returns: { "answer": str, "citations": [...], "retrieval_list": [...], "insufficient": bool }.
    Hard guard: if no chunks or all below similarity_threshold, answer = "INSUFFICIENT_CONTEXT".
    """
    out = {
        "answer": "",
        "citations": [],
        "retrieval_list": [],
        "insufficient": False,
    }
    embedding = embed_query(query_text)
    if not embedding:
        out["answer"] = "INSUFFICIENT_CONTEXT"
        out["insufficient"] = True
        return out
    chunks = retrieve(cur, embedding, filters=filters, k=k)
    out["retrieval_list"] = [
        {"chunk_id": c["chunk_id"], "source_file": c["source_file"], "page_range": c["page_range"], "similarity": c["similarity"]}
        for c in chunks
    ]
    if not chunks or all(c["similarity"] < similarity_threshold for c in chunks):
        out["answer"] = "INSUFFICIENT_CONTEXT"
        out["insufficient"] = True
        return out
    context_pack = build_context_pack(chunks)
    answer = answer_from_context(query_text, context_pack, model=chat_model)
    out["answer"] = answer
    out["citations"] = [{"chunk_id": c["chunk_id"], "source_file": c["source_file"], "page_range": c["page_range"]} for c in chunks]
    return out


def _load_prompt(name: str) -> str:
    path = _PROMPTS_DIR / name
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract first JSON object or array from text (handles markdown code blocks)."""
    if not text:
        return None
    # Strip markdown code block if present
    text = text.strip()
    for pattern in (r"```(?:json)?\s*([\s\S]*?)```", r"\{[\s\S]*\}"):
        m = re.search(pattern, text)
        if m:
            raw = m.group(1) if "```" in pattern else m.group(0)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                continue
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def run_measures(
    cur: Any,
    query_text: str,
    module_domain: str,
    filters: Optional[Dict[str, Any]] = None,
    k: int = DEFAULT_K,
    chat_model: str | None = None,
) -> Dict[str, Any]:
    """
    MEASURES comprehension: RAG retrieve → context pack → LLM with RAG_VULN_TO_Q_OFC_MEASURES_V1.
    module_domain: EV_PARKING or EV_CHARGING (enforced in prompt).
    Returns: { "summary_findings": [...], "items": [...], "retrieval_list": [...], "insufficient": bool }.
    """
    out = {"summary_findings": [], "items": [], "retrieval_list": [], "insufficient": False}
    filters = dict(filters or {})
    filters.setdefault("source_type", "CORPUS")
    if module_domain:
        filters["module_domain"] = module_domain
    embedding = embed_query(query_text)
    if not embedding:
        out["insufficient"] = True
        return out
    chunks = retrieve(cur, embedding, filters=filters, k=k)
    out["retrieval_list"] = [
        {"chunk_id": c["chunk_id"], "source_file": c["source_file"], "page_range": c["page_range"], "similarity": c["similarity"]}
        for c in chunks
    ]
    if not chunks:
        out["insufficient"] = True
        return out
    context_pack = build_context_pack(chunks)
    prompt_path = _PROMPTS_DIR / "RAG_VULN_TO_Q_OFC_MEASURES_V1.txt"
    system = _load_prompt("RAG_VULN_TO_Q_OFC_MEASURES_V1.txt") if prompt_path.exists() else ""
    user = f"module_domain: {module_domain}\n\nQuery / focus: {query_text}\n\nCONTEXT PACK:\n{context_pack}"
    full_prompt = f"{system}\n\n{user}" if system else user
    raw = ollama_chat(chat_model or DEFAULT_CHAT_MODEL, full_prompt, temperature=0.2, format_json=True, timeout=300)
    parsed = _extract_json(raw)
    if parsed:
        out["summary_findings"] = parsed.get("summary_findings") or []
        out["items"] = parsed.get("items") or []
    return out


def run_plan_checklist(
    cur: Any,
    query_text: str,
    plan_template_sections: List[str],
    filters: Optional[Dict[str, Any]] = None,
    k: int = DEFAULT_K,
    chat_model: str | None = None,
) -> Dict[str, Any]:
    """
    PLAN checklist comprehension: RAG retrieve → context pack → LLM with RAG_PLAN_CHECKLIST_V1.
    Returns: { "items": [...], "retrieval_list": [...], "insufficient": bool }.
    """
    out = {"items": [], "retrieval_list": [], "insufficient": False}
    filters = dict(filters or {})
    filters.setdefault("source_type", "CORPUS")
    embedding = embed_query(query_text)
    if not embedding:
        out["insufficient"] = True
        return out
    chunks = retrieve(cur, embedding, filters=filters, k=k)
    out["retrieval_list"] = [
        {"chunk_id": c["chunk_id"], "source_file": c["source_file"], "page_range": c["page_range"], "similarity": c["similarity"]}
        for c in chunks
    ]
    if not chunks:
        out["insufficient"] = True
        return out
    context_pack = build_context_pack(chunks)
    system = _load_prompt("RAG_PLAN_CHECKLIST_V1.txt")
    sections_str = json.dumps(plan_template_sections)
    user = f"plan_template_sections: {sections_str}\n\ncontext_pack:\n{context_pack}\n\nQuery / focus (optional): {query_text}"
    full_prompt = f"{system}\n\n{user}" if system else user
    raw = ollama_chat(chat_model or DEFAULT_CHAT_MODEL, full_prompt, temperature=0.2, format_json=True, timeout=300)
    parsed = _extract_json(raw)
    if parsed:
        out["items"] = parsed.get("items") or []
    return out
