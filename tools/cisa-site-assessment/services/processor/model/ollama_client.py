"""
Minimal Ollama chat client for processor (raw text response).
Used by module parser; keeps processor independent of baseline/OFC panel logic.
"""

from __future__ import annotations

import os
import time

try:
    import requests
except ImportError:
    requests = None  # type: ignore[assignment]

CONNECT_TIMEOUT = 5
READ_TIMEOUT_DEFAULT = 600
RETRY_SLEEP = 0.5


def get_ollama_url() -> str:
    """Ollama base URL. Prefer OLLAMA_HOST; if host:port (no scheme) use http://; default http://127.0.0.1:11434."""
    host = (os.environ.get("OLLAMA_HOST") or "").strip()
    if not host:
        return "http://127.0.0.1:11434"
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")
    return ("http://" + host).rstrip("/")


def _ensure_no_proxy_for_localhost() -> None:
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    needed = ["127.0.0.1", "localhost"]
    cur = [x.strip() for x in no_proxy.split(",") if x.strip()]
    for n in needed:
        if n not in cur:
            cur.append(n)
    os.environ["NO_PROXY"] = ",".join(cur)
    os.environ["no_proxy"] = os.environ["NO_PROXY"]


def ollama_chat(
    model: str,
    prompt: str,
    temperature: float = 0.2,
    timeout: int = 1200,
    format_json: bool = False,
    format_schema: dict | None = None,
) -> str:
    """
    Send a single prompt to Ollama chat API and return the raw message content.
    Default 1200s (20 min) so runs with many chunks/documents can complete.
    If format_json=True, Ollama constrains output to valid JSON.
    If format_schema is a dict (JSON schema), Ollama constrains output to that shape (overrides format_json).
    Uses a session with trust_env=False so localhost is not hijacked by HTTP_PROXY.
    Connect timeout 5s, read timeout as given. Retries once on connection errors.
    """
    if requests is None:
        raise RuntimeError("requests is required for ollama_chat; install it and retry")
    _ensure_no_proxy_for_localhost()
    ollama_url = get_ollama_url()
    read_timeout = timeout if timeout and timeout > 0 else READ_TIMEOUT_DEFAULT
    timeouts = (CONNECT_TIMEOUT, read_timeout)
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": temperature},
    }
    if format_schema is not None:
        body["format"] = format_schema
    elif format_json:
        body["format"] = "json"

    session = requests.Session()
    session.trust_env = False
    url = f"{ollama_url}/api/chat"

    response = None
    for attempt in range(2):
        try:
            response = session.post(url, json=body, timeout=timeouts)
            break
        except (requests.exceptions.ConnectionError, requests.exceptions.ConnectTimeout) as e:
            if attempt == 0:
                time.sleep(RETRY_SLEEP)
            else:
                raise

    if response.status_code != 200:
        raise RuntimeError(
            f"Ollama API error: {response.status_code} - {response.text[:300]}"
        )
    result = response.json()
    content = (result.get("message") or {}).get("content") or ""
    return content.strip()


def ollama_embed(
    text: str,
    model: str | None = None,
    timeout: int = 60,
) -> list[float] | None:
    """
    Get embedding vector for text via Ollama POST /api/embed.
    Returns list of floats (e.g. 768 for nomic-embed-text) or None on failure.
    Lock model; do not change mid-run or vectors are incompatible.
    Uses session with trust_env=False and explicit timeouts.
    """
    if requests is None:
        return None
    if not text or not text.strip():
        return None
    _ensure_no_proxy_for_localhost()
    model = model or os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
    url = get_ollama_url()
    body = {"model": model, "input": text}
    read_timeout = timeout if timeout and timeout > 0 else 60
    timeouts = (CONNECT_TIMEOUT, read_timeout)
    session = requests.Session()
    session.trust_env = False
    try:
        r = session.post(f"{url}/api/embed", json=body, timeout=timeouts)
        if r.status_code != 200:
            return None
        data = r.json()
        embeddings = data.get("embeddings")
        if not embeddings or not isinstance(embeddings, list):
            return None
        vec = embeddings[0]
        if isinstance(vec, list) and len(vec) > 0:
            return [float(x) for x in vec]
        return None
    except Exception:
        return None
