#!/usr/bin/env python3
"""
Ollama JSON Chat Utility

Provides structured JSON extraction from Ollama chat API with schema validation.
"""

import os
import json
import requests
from pathlib import Path
from typing import Dict, Any, Optional
import jsonschema
from jsonschema import validate, ValidationError


def get_ollama_url() -> str:
    """Get Ollama URL from environment. Adds http:// if no scheme, :11434 if no port.
    Replaces 0.0.0.0 with 127.0.0.1 for client connections (0.0.0.0 is bind-only)."""
    url = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").strip()
    if not url:
        return "http://127.0.0.1:11434"
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    try:
        from urllib.parse import urlparse
        p = urlparse(url)
        host = (p.netloc or p.path).split(":")[0]
        port = p.port
        if host in ("0.0.0.0", "::"):
            host = "127.0.0.1"
        if port is None and ":" not in (p.netloc or ""):
            port = 11434
        if port is not None:
            url = f"{p.scheme or 'http'}://{host}:{port}"
        else:
            url = f"{p.scheme or 'http'}://{host}"
    except Exception:
        pass
    return url


def load_schema(schema_path: str) -> Dict[str, Any]:
    """Load JSON schema from file."""
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_json(data: Dict[str, Any], schema: Dict[str, Any]) -> None:
    """Validate JSON data against schema. Raises ValidationError on failure."""
    validate(instance=data, schema=schema.get("schema", schema))


def ollama_chat_json(
    model: str,
    system_prompt: str,
    user_message: str,
    temperature: float = 0.3,
    timeout: int = 120
) -> Dict[str, Any]:
    """
    Call Ollama chat API with JSON format constraint.
    
    Args:
        model: Ollama model name (e.g., "llama3.1:8b-instruct")
        system_prompt: System prompt text
        user_message: User message (can be JSON string or dict)
        temperature: Sampling temperature (default 0.3)
        timeout: Request timeout in seconds (default 120)
    
    Returns:
        Parsed JSON response as dict
    
    Raises:
        requests.RequestException: On API errors
        json.JSONDecodeError: On JSON parse errors
    """
    ollama_url = get_ollama_url()
    
    # Convert user_message to string if it's a dict
    if isinstance(user_message, dict):
        user_message = json.dumps(user_message, indent=2)
    
    # Prepare messages
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
    ]
    
    # Call Ollama chat API
    response = requests.post(
        f"{ollama_url}/api/chat",
        json={
            "model": model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": temperature,
                "top_p": 0.9
            }
        },
        timeout=timeout
    )
    
    if response.status_code != 200:
        raise requests.RequestException(
            f"Ollama API error: {response.status_code} - {response.text[:200]}"
        )
    
    result = response.json()
    response_text = result.get("message", {}).get("content", "").strip()
    
    if not response_text:
        raise ValueError("Empty response from Ollama")
    
    # Optional: log raw response to stderr (e.g. OLLAMA_DEBUG_RAW=1) to debug empty/wrong output
    if os.environ.get("OLLAMA_DEBUG_RAW"):
        import sys
        preview = response_text[:4000] + ("..." if len(response_text) > 4000 else "")
        print("[ollama_json] raw response preview:", file=sys.stderr)
        print(preview, file=sys.stderr)
    
    # Extract JSON from response (may be wrapped in markdown code blocks)
    json_start = response_text.find("{")
    json_end = response_text.rfind("}") + 1
    
    if json_start >= 0 and json_end > json_start:
        json_text = response_text[json_start:json_end]
        try:
            parsed = json.loads(json_text)
            return parsed
        except json.JSONDecodeError as e:
            raise json.JSONDecodeError(
                f"Failed to parse JSON from Ollama response: {e}",
                json_text,
                0
            )
    
    # Fallback: try to parse entire response as JSON
    try:
        parsed = json.loads(response_text)
        return parsed
    except json.JSONDecodeError as e:
        raise json.JSONDecodeError(
            f"Failed to parse JSON from Ollama response: {e}",
            response_text,
            0
        )


if __name__ == "__main__":
    # Test
    schema = load_schema("tools/module_crawler/llm/module_chunk_to_comprehension.schema.json")
    system = Path("tools/module_crawler/llm/system_prompt_module_chunk_to_comprehension.txt").read_text()
    
    test_user = {
        "module_code": "MODULE_TEST",
        "chunk": {
            "chunk_id": "test-123",
            "doc_id": "doc-123",
            "source_registry_id": "sr-123",
            "locator": "page 5",
            "text": "Test chunk text about physical security measures."
        }
    }
    
    try:
        result = ollama_chat_json("llama3.1:8b-instruct", system, json.dumps(test_user))
        validate_json(result, schema)
        print("✓ Test passed")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"✗ Test failed: {e}")
