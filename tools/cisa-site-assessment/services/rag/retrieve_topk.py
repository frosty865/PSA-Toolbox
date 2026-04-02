"""
Retrieve top-k chunks by cosine similarity with tags filter.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]


def embed_query(text: str) -> list[float]:
    """Embed query text via Ollama /api/embed."""
    if requests is None:
        raise RuntimeError("requests is required for embed_query")
    model = os.getenv("RAG_EMBED_MODEL", "nomic-embed-text")
    base = (os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")).rstrip("/")
    if not base.startswith(("http://", "https://")):
        base = "http://" + base
    resp = requests.post(f"{base}/api/embed", json={"model": model, "input": text}, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if "embedding" in data and isinstance(data["embedding"], list):
        return [float(x) for x in data["embedding"]]
    if "embeddings" in data and data["embeddings"]:
        return [float(x) for x in data["embeddings"][0]]
    raise RuntimeError("Unexpected embeddings response.")


def retrieve_topk(
    *,
    conn: Any,
    query_text: str,
    k: int = 8,
    tags_filter: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Returns top-k chunks with citation metadata.
    Uses cosine distance (<=>): smaller is better.
    """
    qvec = embed_query(query_text)
    tags_filter = tags_filter or {}
    vec_literal = "[" + ",".join(str(float(x)) for x in qvec) + "]"
    tags_json = json.dumps(tags_filter)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              chunk_id,
              source_file,
              page_range,
              chunk_text,
              (embedding <=> %s::vector) AS distance,
              tags
            FROM public.rag_chunks
            WHERE tags @> %s::jsonb
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (vec_literal, tags_json, vec_literal, k),
        )
        rows = cur.fetchall()

    out = []
    for (chunk_id, source_file, page_range, chunk_text, distance, tags) in rows:
        out.append(
            {
                "chunk_id": chunk_id,
                "source_file": source_file or "",
                "page_range": page_range or "",
                "chunk_text": chunk_text or "",
                "distance": float(distance),
                "tags": tags,
            }
        )
    return out


def open_corpus_conn():
    """Open CORPUS DB connection (CORPUS_DATABASE_URL, CORPUS_DB_URL, or DATABASE_URL)."""
    db_url = os.getenv("CORPUS_DATABASE_URL") or os.getenv("CORPUS_DB_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("Missing CORPUS_DATABASE_URL, CORPUS_DB_URL, or DATABASE_URL.")
    try:
        import psycopg2
        return psycopg2.connect(db_url)
    except ImportError:
        raise RuntimeError("psycopg2 is required for open_corpus_conn.")
