"""
Emit a single chunk to rag_chunks with content_hash no-op check.
Best-effort: caller should catch exceptions and log (log-and-continue).
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse, urlunparse

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]


OLLAMA_DEFAULT_PORT = 11434


def _normalize_ollama_base_url(url: str) -> str:
    """Replace 0.0.0.0/:: with 127.0.0.1 and default port to 11434 when missing (avoid port 80)."""
    u = urlparse(url)
    host = (u.hostname or "").strip() or "127.0.0.1"
    if host in ("0.0.0.0", "::", "::1"):
        host = "127.0.0.1"
    port = u.port if u.port is not None else OLLAMA_DEFAULT_PORT
    netloc = f"{host}:{port}"
    scheme = u.scheme or "http"
    return urlunparse((scheme, netloc, u.path or "", u.params, u.query, u.fragment))


def _sha256_text(s: str) -> str:
    return hashlib.sha256((s or "").encode("utf-8")).hexdigest()


def _ollama_embed(text: str, *, model: str, base_url: str, timeout_s: int = 60) -> list[float]:
    """
    Call Ollama embeddings endpoint.
    Expect: {"embedding": [...]} or {"embeddings": [[...]]} depending on version.
    """
    if requests is None:
        raise RuntimeError("requests is required for Ollama embeddings")
    url = f"{base_url.rstrip('/')}/api/embed"
    # Ollama /api/embed uses "input" (not "prompt")
    resp = requests.post(url, json={"model": model, "input": text}, timeout=timeout_s)
    resp.raise_for_status()
    data = resp.json()
    if "embedding" in data and isinstance(data["embedding"], list):
        return [float(x) for x in data["embedding"]]
    if "embeddings" in data and isinstance(data["embeddings"], list) and data["embeddings"]:
        return [float(x) for x in data["embeddings"][0]]
    raise RuntimeError("Unexpected embeddings response shape from Ollama.")


def _embedding_to_pgvector(embedding: list[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in embedding) + "]"


def emit_chunk_to_rag_store(
    cur: Any,
    *,
    chunk_id: str,
    chunk_text: str,
    source_file: str,
    page_range: str,
    tags: Dict[str, Any],
    embed_model: Optional[str] = None,
    ollama_base_url: Optional[str] = None,
) -> None:
    """
    Best-effort emit. Caller should catch exceptions and log.
    Upsert policy:
    - If row exists and content_hash unchanged: no-op
    - Else: re-embed and update text, embedding, content_hash, metadata
    """
    embed_model = embed_model or os.getenv("RAG_EMBED_MODEL", "nomic-embed-text")
    base_url = ollama_base_url or os.getenv("OLLAMA_BASE_URL") or os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    if not base_url.startswith(("http://", "https://")):
        base_url = "http://" + base_url
    base_url = _normalize_ollama_base_url(base_url)

    content_hash = _sha256_text(chunk_text)

    # Quick no-op check (content_hash column may not exist on older deployments)
    try:
        cur.execute("SELECT content_hash FROM public.rag_chunks WHERE chunk_id = %s", (chunk_id,))
        row = cur.fetchone()
        if row and row[0] == content_hash:
            return
    except Exception:
        # Column might not exist yet; proceed to embed and upsert
        pass

    # Embed (retry once)
    last_err = None
    for attempt in range(2):
        try:
            emb = _ollama_embed(chunk_text, model=embed_model, base_url=base_url)
            last_err = None
            break
        except Exception as e:
            last_err = e
            time.sleep(0.5)
    if last_err:
        raise last_err

    vec_literal = _embedding_to_pgvector(emb)
    tags_json = json.dumps(tags)

    # Upsert with content_hash (prefer); fallback to schema without content_hash
    try:
        cur.execute(
            """
            INSERT INTO public.rag_chunks (chunk_id, source_file, page_range, chunk_text, embedding, content_hash, tags)
            VALUES (%s, %s, %s, %s, %s::vector, %s, %s::jsonb)
            ON CONFLICT (chunk_id) DO UPDATE SET
              source_file = EXCLUDED.source_file,
              page_range = EXCLUDED.page_range,
              chunk_text = EXCLUDED.chunk_text,
              embedding = EXCLUDED.embedding,
              content_hash = EXCLUDED.content_hash,
              tags = EXCLUDED.tags,
              updated_at = current_timestamp
            """,
            (chunk_id, source_file, page_range or "", chunk_text, vec_literal, content_hash, tags_json),
        )
    except Exception as e:
        if "content_hash" in str(e) and ("does not exist" in str(e) or "column" in str(e).lower()):
            cur.execute(
                """
                INSERT INTO public.rag_chunks (chunk_id, source_file, page_range, chunk_text, embedding, tags)
                VALUES (%s, %s, %s, %s, %s::vector, %s::jsonb)
                ON CONFLICT (chunk_id) DO UPDATE SET
                  source_file = EXCLUDED.source_file,
                  page_range = EXCLUDED.page_range,
                  chunk_text = EXCLUDED.chunk_text,
                  embedding = EXCLUDED.embedding,
                  tags = EXCLUDED.tags,
                  updated_at = current_timestamp
                """,
                (chunk_id, source_file, page_range or "", chunk_text, vec_literal, tags_json),
            )
        else:
            raise
