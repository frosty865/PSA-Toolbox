"""
LLM-based router for module chunks. Outputs KEEP/MAYBE/IGNORE per handle with reason (auditable).
Used when standard_key is PHYSICAL_SECURITY_MEASURES to avoid over-ignoring EV/charging content.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List

from .ollama_client import ollama_chat

ROUTER_MODEL_DEFAULT = "llama3.2:1b"
MIN_CHUNK_CHARS_FOR_ROUTER = 200
MAX_CHUNK_SNIPPET_CHARS = 1200


def _load_router_prompt(standard_key: str, for_windows: bool = False) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    if for_windows:
        name = "ROUTER_WINDOWS_PHYSICAL_SECURITY_MEASURES_V1.txt"
    else:
        name = "ROUTER_PHYSICAL_SECURITY_MEASURES_V1.txt"
    path = prompts_dir / name
    if not path.exists():
        return (prompts_dir / "ROUTER_PHYSICAL_SECURITY_MEASURES_V1.txt").read_text(encoding="utf-8").strip() if not for_windows else ""
    return path.read_text(encoding="utf-8").strip()


def _build_user_payload(chunks_with_handles: List[Dict[str, Any]]) -> str:
    lines = []
    for c in chunks_with_handles:
        handle = c.get("handle") or ""
        text = (c.get("chunk_text") or c.get("text") or "").strip()
        title = (c.get("source_file") or c.get("title") or "").strip()
        if len(text) > MAX_CHUNK_SNIPPET_CHARS:
            text = text[: MAX_CHUNK_SNIPPET_CHARS] + "..."
        block = f"[{handle}]"
        if title:
            block += f" Title: {title}"
        block += f"\n{text}\n"
        lines.append(block)
    return "\n".join(lines)


def _build_user_payload_windows(windows: List[Dict[str, Any]], max_window_chars: int = 3600) -> str:
    """Build user payload for window-based routing: primary_handle, doc/source, locator range, packet_text."""
    lines = []
    for w in windows:
        primary = w.get("primary_handle") or ""
        packet_text = (w.get("packet_text") or "").strip()
        if len(packet_text) > max_window_chars:
            packet_text = packet_text[:max_window_chars] + "..."
        source = (w.get("source_file") or "").strip()
        loc = (w.get("locator_range") or "").strip()
        block = f"[Window primary_handle={primary}]"
        if source:
            block += f" Doc: {source}"
        if loc:
            block += f" Pages: {loc}"
        block += f"\n{packet_text}\n"
        lines.append(block)
    return "\n".join(lines)


def _parse_and_validate_decisions(
    raw: str, expected_handles: List[str]
) -> List[Dict[str, Any]]:
    raw = raw.strip()
    # Strip markdown code fence if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    decisions_raw = data.get("decisions")
    if not isinstance(decisions_raw, list):
        return []
    expected_set = set(expected_handles)
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for d in decisions_raw:
        if not isinstance(d, dict):
            continue
        handle = (d.get("handle") or "").strip()
        if not handle or handle in seen or handle not in expected_set:
            continue
        decision = (d.get("decision") or "").strip().upper()
        if decision not in ("KEEP", "MAYBE", "IGNORE"):
            decision = "IGNORE"
        reason = (d.get("reason") or "").strip()
        if not reason:
            reason = "No reason provided"
        if len(reason) > 120:
            reason = reason[:117] + "..."
        tags = d.get("tags")
        if not isinstance(tags, list):
            tags = []
        seen.add(handle)
        out.append({"handle": handle, "decision": decision, "reason": reason, "tags": tags})
    # Fill missing handles as IGNORE so every handle appears exactly once
    for h in expected_handles:
        if h not in seen:
            out.append({"handle": h, "decision": "IGNORE", "reason": "Missing from router output", "tags": []})
    # Sort by original handle order
    order = {h: i for i, h in enumerate(expected_handles)}
    out.sort(key=lambda x: order.get(x["handle"], 9999))
    return out


def route_chunks_with_llm(
    chunks_with_handles: List[Dict[str, Any]],
    standard_key: str,
    model: str | None = None,
    timeout: int = 300,
) -> Dict[str, Any]:
    """
    Run LLM router on chunks. Each chunk must have handle, chunk_text (or text), optional source_file/title.
    Returns:
      decisions: list of { handle, decision, reason, tags }
      model: model used
      raw_response_chars: length of raw LLM response
      parse_ok: whether JSON parsed and every handle present
    """
    if not chunks_with_handles:
        return {"decisions": [], "model": model or ROUTER_MODEL_DEFAULT, "raw_response_chars": 0, "parse_ok": True}
    handles = [c.get("handle") or "" for c in chunks_with_handles]
    system = _load_router_prompt(standard_key)
    if not system:
        # Fallback: all MAYBE so quota can still run
        return {
            "decisions": [{"handle": h, "decision": "MAYBE", "reason": "No router prompt", "tags": []} for h in handles],
            "model": model or ROUTER_MODEL_DEFAULT,
            "raw_response_chars": 0,
            "parse_ok": True,
        }
    user = _build_user_payload(chunks_with_handles)
    full_prompt = f"{system}\n\n––– CHUNKS –––\n\n{user}"
    model_name = model or ROUTER_MODEL_DEFAULT
    try:
        raw = ollama_chat(
            model=model_name,
            prompt=full_prompt,
            temperature=0.1,
            timeout=timeout,
            format_json=True,
        )
    except Exception as e:
        # On failure, treat all as MAYBE so quota can run
        return {
            "decisions": [{"handle": h, "decision": "MAYBE", "reason": f"Router LLM failed: {e!s}"[:80], "tags": []} for h in handles],
            "model": model_name,
            "raw_response_chars": 0,
            "parse_ok": False,
        }
    decisions = _parse_and_validate_decisions(raw, handles)
    parse_ok = len(decisions) == len(handles) and all(d["handle"] in handles for d in decisions)
    if not parse_ok and len(decisions) < len(handles):
        # Fill missing
        seen = {d["handle"] for d in decisions}
        for h in handles:
            if h not in seen:
                decisions.append({"handle": h, "decision": "MAYBE", "reason": "Router parse incomplete", "tags": []})
        decisions.sort(key=lambda x: handles.index(x["handle"]) if x["handle"] in handles else 9999)
    return {
        "decisions": decisions,
        "model": model_name,
        "raw_response_chars": len(raw),
        "parse_ok": parse_ok,
    }


def route_windows_with_llm(
    windows: List[Dict[str, Any]],
    standard_key: str,
    model: str | None = None,
    timeout: int = 300,
) -> Dict[str, Any]:
    """
    Run LLM router on document windows. Each window has primary_handle, packet_text, doc/source, locator_range.
    Returns decisions keyed by primary_handle (one per window).
    """
    if not windows:
        return {"decisions": [], "model": model or ROUTER_MODEL_DEFAULT, "raw_response_chars": 0, "parse_ok": True}
    primary_handles = [w.get("primary_handle") or "" for w in windows]
    system = _load_router_prompt(standard_key, for_windows=True)
    if not system:
        return {
            "decisions": [{"handle": h, "decision": "MAYBE", "reason": "No router prompt", "tags": []} for h in primary_handles],
            "model": model or ROUTER_MODEL_DEFAULT,
            "raw_response_chars": 0,
            "parse_ok": True,
        }
    user = _build_user_payload_windows(windows)
    full_prompt = f"{system}\n\n––– WINDOWS –––\n\n{user}"
    model_name = model or ROUTER_MODEL_DEFAULT
    try:
        raw = ollama_chat(
            model=model_name,
            prompt=full_prompt,
            temperature=0.1,
            timeout=timeout,
            format_json=True,
        )
    except Exception as e:
        return {
            "decisions": [{"handle": h, "decision": "MAYBE", "reason": f"Router LLM failed: {e!s}"[:80], "tags": []} for h in primary_handles],
            "model": model_name,
            "raw_response_chars": 0,
            "parse_ok": False,
        }
    decisions = _parse_and_validate_decisions(raw, primary_handles)
    parse_ok = len(decisions) == len(primary_handles) and all(d["handle"] in primary_handles for d in decisions)
    if not parse_ok and len(decisions) < len(primary_handles):
        seen = {d["handle"] for d in decisions}
        for h in primary_handles:
            if h not in seen:
                decisions.append({"handle": h, "decision": "MAYBE", "reason": "Router parse incomplete", "tags": []})
        decisions.sort(key=lambda x: primary_handles.index(x["handle"]) if x["handle"] in primary_handles else 9999)
    return {
        "decisions": decisions,
        "model": model_name,
        "raw_response_chars": len(raw),
        "parse_ok": parse_ok,
    }
