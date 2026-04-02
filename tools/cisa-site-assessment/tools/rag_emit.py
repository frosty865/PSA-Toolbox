"""
Emit document chunks to RAG vector store (rag_chunks).

Used by corpus_ingest_pdf: after each chunk INSERT into document_chunks,
optionally embed via Ollama and upsert into rag_chunks.
See docs/rag/EMIT_TO_RAG_HOOK_V1.md.
"""

from __future__ import annotations

import os
import json
import logging
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# Lock embedding model; do not change mid-run or vectors are incompatible.
DEFAULT_EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
OLLAMA_EMBED_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
if not OLLAMA_EMBED_URL.startswith(("http://", "https://")):
    OLLAMA_EMBED_URL = "http://" + OLLAMA_EMBED_URL


def get_ollama_embed_url() -> str:
    """Ollama base URL for embeddings (normalize 0.0.0.0 -> 127.0.0.1)."""
    url = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").strip()
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        host = (p.netloc or p.path).split(":")[0]
        port = getattr(p, "port", None) or 11434
        if host in ("0.0.0.0", "::"):
            host = "127.0.0.1"
        url = f"{p.scheme or 'http'}://{host}:{port}"
    except Exception:
        pass
    return url


def embed_text(text: str, model: str = DEFAULT_EMBED_MODEL, timeout: int = 60) -> Optional[List[float]]:
    """
    Get embedding vector for text via Ollama POST /api/embed.
    Returns list of floats (768 for nomic-embed-text) or None on failure.
    """
    if not text or not text.strip():
        return None
    if requests is None:
        logger.warning("requests not installed; cannot call Ollama embeddings")
        return None
    url = get_ollama_embed_url()
    body = {"model": model, "input": text}
    try:
        r = requests.post(f"{url}/api/embed", json=body, timeout=timeout)
        if r.status_code != 200:
            logger.warning("Ollama embed %s: %s %s", url, r.status_code, r.text[:200])
            return None
        data = r.json()
        embeddings = data.get("embeddings")
        if not embeddings or not isinstance(embeddings, list):
            return None
        vec = embeddings[0]
        if isinstance(vec, list) and len(vec) > 0 and isinstance(vec[0], (int, float)):
            return [float(x) for x in vec]
        return None
    except Exception as e:
        logger.warning("Ollama embed failed: %s", e)
        return None


def _embedding_to_pgvector(embedding: List[float]) -> str:
    """Format embedding as PostgreSQL vector literal '[x,y,z,...]'."""
    return "[" + ",".join(str(float(x)) for x in embedding) + "]"


def emit_chunk_to_rag_store(
    cur: Any,
    chunk_id: str,
    chunk_text: str,
    source_file: str,
    page_range: str,
    tags: Optional[Dict[str, Any]] = None,
    embed_model: str = DEFAULT_EMBED_MODEL,
    skip_embed_on_failure: bool = True,
) -> bool:
    """
    Embed chunk_text via Ollama and upsert into rag_chunks.
    Uses same DB connection (cur). On failure: log and return False; does not raise.
    Prefer services.rag.emit_chunk_to_rag_store for content_hash no-op behavior.
    """
    if not chunk_id or not chunk_text or not source_file:
        return False
    tags = tags or {"source_type": "CORPUS"}
    if not isinstance(tags, dict):
        tags = {"source_type": "CORPUS"}
    tags_json = json.dumps(tags)

    embedding = embed_text(chunk_text, model=embed_model)
    if embedding is None:
        if not skip_embed_on_failure:
            logger.warning("RAG emit skipped for chunk_id=%s (embed failed)", chunk_id)
        return False

    vec_literal = _embedding_to_pgvector(embedding)
    try:
        cur.execute("""
            INSERT INTO public.rag_chunks (chunk_id, source_file, page_range, chunk_text, embedding, tags)
            VALUES (%s, %s, %s, %s, %s::vector, %s::jsonb)
            ON CONFLICT (chunk_id) DO UPDATE SET
                source_file = EXCLUDED.source_file,
                page_range = EXCLUDED.page_range,
                chunk_text = EXCLUDED.chunk_text,
                embedding = EXCLUDED.embedding,
                tags = EXCLUDED.tags,
                updated_at = current_timestamp
        """, (chunk_id, source_file, page_range, chunk_text, vec_literal, tags_json))
        return True
    except Exception as e:
        logger.warning("RAG upsert failed for chunk_id=%s: %s", chunk_id, e)
        return False


def rag_emit_enabled() -> bool:
    """True if RAG emit should run (env RAG_EMIT=1 or unset and Ollama reachable)."""
    v = os.environ.get("RAG_EMIT", "").strip().lower()
    if v in ("0", "false", "no"):
        return False
    if v in ("1", "true", "yes"):
        return True
    # Default: enable if requests available (caller can still skip if table missing)
    return requests is not None
