"""
PASS A: Generate vulnerability-driven questions (no OFCs).
Input: chunks. Output: risk_drivers + questions (strict JSON).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .ollama_client import ollama_chat

PASS_A_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "risk_drivers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "evidence": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "locator_type": {"type": "string"},
                                "locator": {"type": "string"},
                                "excerpt": {"type": "string"},
                            },
                        },
                    },
                },
            },
        },
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question_code": {"type": "string"},
                    "question_text": {"type": "string"},
                    "applicability": {"type": "string"},
                    "discipline_code": {"type": "string"},
                    "discipline_subtype_hint": {"type": "string"},
                    "why_it_matters": {"type": "string"},
                    "evidence": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "locator_type": {"type": "string"},
                                "locator": {"type": "string"},
                                "excerpt": {"type": "string"},
                            },
                        },
                    },
                },
                "required": ["question_code", "question_text", "evidence"],
            },
        },
    },
    "required": ["questions"],
}


def build_pass_a_prompt(
    *,
    module_code: str,
    module_title: str,
    chunks: List[Dict[str, Any]],
    max_chunk_chars: int = 2000,
) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    system_path = prompts_dir / "MODULE_PASS_A_QUESTIONS_V1.txt"
    system = system_path.read_text(encoding="utf-8")

    parts = [
        f"{system}\n\n",
        f"module_code: {module_code}\n",
        f"module_title: {module_title}\n\n",
        "CHUNKs:\n\n",
    ]
    for i, ch in enumerate(chunks, 1):
        cid = ch.get("chunk_id", "")
        src = ch.get("source_file", "")
        pr = ch.get("page_range", "")
        text = (ch.get("chunk_text") or "").strip()
        if max_chunk_chars and len(text) > max_chunk_chars:
            text = text[:max_chunk_chars] + "\n[... truncated ...]"
        parts.append(f"--- CHUNK {i} ---\n")
        parts.append(f"chunk_id: {cid}\n")
        parts.append(f"source_file: {src}\n")
        parts.append(f"page_range: {pr}\n")
        parts.append(f"chunk_text:\n{text}\n\n")
    return "".join(parts)


def extract_json_from_response(raw: str) -> str:
    json_text = raw.strip()
    if json_text.startswith("```"):
        lines = json_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        json_text = "\n".join(lines)
    if json_text and not json_text.strip().startswith("{"):
        start = json_text.find("{")
        if start >= 0:
            depth = 0
            for i in range(start, len(json_text)):
                if json_text[i] == "{":
                    depth += 1
                elif json_text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        json_text = json_text[start : i + 1]
                        break
    return json_text


def run_pass_a(
    *,
    model: str,
    module_code: str,
    module_title: str,
    chunks: List[Dict[str, Any]],
    max_chunk_chars: int = 2000,
    temperature: float = 0.2,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """Run PASS A: chunks -> risk_drivers + questions. Returns dict with risk_drivers, questions, and optional items_empty_reason."""
    if not chunks:
        return {
            "risk_drivers": [],
            "questions": [],
            "items_empty_reason": "no_chunks",
        }

    prompt = build_pass_a_prompt(
        module_code=module_code,
        module_title=module_title,
        chunks=chunks,
        max_chunk_chars=max_chunk_chars,
    )
    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_schema=PASS_A_OUTPUT_SCHEMA,
    )
    json_text = extract_json_from_response(raw)
    try:
        data = json.loads(json_text)
        if not isinstance(data, dict):
            return {"risk_drivers": [], "questions": [], "items_empty_reason": "ollama_response_not_dict"}
        questions = data.get("questions") or []
        if not isinstance(questions, list):
            questions = []
        risk_drivers = data.get("risk_drivers")
        if not isinstance(risk_drivers, list):
            risk_drivers = []
        # Normalize question codes with module prefix (e.g. MODULE_EV_PARKING -> EVP)
        prefix = module_code.replace("MODULE_", "").replace("_", "")[:6].upper()
        if not prefix:
            prefix = "Q"
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            code = (q.get("question_code") or "").strip()
            if not code:
                q["question_code"] = f"{prefix}_{(i+1):03d}"
            if not q.get("evidence"):
                q["evidence"] = []
        return {"risk_drivers": risk_drivers, "questions": questions}
    except json.JSONDecodeError:
        return {"risk_drivers": [], "questions": [], "items_empty_reason": "ollama_response_not_valid_json"}


def build_pass_a_low_yield_prompt(
    *,
    module_code: str,
    module_title: str,
    chunks: List[Dict[str, Any]],
    max_chunk_chars: int = 2000,
) -> str:
    """Same as PASS A but with low-yield correction instructions."""
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    system_path = prompts_dir / "MODULE_PASS_A_LOW_YIELD_CORRECTION_V1.txt"
    system = system_path.read_text(encoding="utf-8")
    parts = [
        f"{system}\n\n",
        f"module_code: {module_code}\n",
        f"module_title: {module_title}\n\n",
        "CHUNKs:\n\n",
    ]
    for i, ch in enumerate(chunks, 1):
        cid = ch.get("chunk_id", "")
        src = ch.get("source_file", "")
        pr = ch.get("page_range", "")
        text = (ch.get("chunk_text") or "").strip()
        if max_chunk_chars and len(text) > max_chunk_chars:
            text = text[:max_chunk_chars] + "\n[... truncated ...]"
        parts.append(f"--- CHUNK {i} ---\n")
        parts.append(f"chunk_id: {cid}\n")
        parts.append(f"source_file: {src}\n")
        parts.append(f"page_range: {pr}\n")
        parts.append(f"chunk_text:\n{text}\n\n")
    return "".join(parts)


def run_pass_a_low_yield_retry(
    *,
    model: str,
    module_code: str,
    module_title: str,
    chunks: List[Dict[str, Any]],
    max_chunk_chars: int = 2000,
    temperature: float = 0.3,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """Retry PASS A with low-yield correction prompt. Same return shape as run_pass_a."""
    if not chunks:
        return {"risk_drivers": [], "questions": [], "items_empty_reason": "no_chunks"}
    prompt = build_pass_a_low_yield_prompt(
        module_code=module_code,
        module_title=module_title,
        chunks=chunks,
        max_chunk_chars=max_chunk_chars,
    )
    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_schema=PASS_A_OUTPUT_SCHEMA,
    )
    json_text = extract_json_from_response(raw)
    try:
        data = json.loads(json_text)
        if not isinstance(data, dict):
            return {"risk_drivers": [], "questions": [], "items_empty_reason": "ollama_response_not_dict"}
        questions = data.get("questions") or []
        if not isinstance(questions, list):
            questions = []
        risk_drivers = data.get("risk_drivers")
        if not isinstance(risk_drivers, list):
            risk_drivers = []
        prefix = module_code.replace("MODULE_", "").replace("_", "")[:6].upper()
        if not prefix:
            prefix = "Q"
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                continue
            if not (q.get("question_code") or "").strip():
                q["question_code"] = f"{prefix}_{(i+1):03d}"
            if not q.get("evidence"):
                q["evidence"] = []
        return {"risk_drivers": risk_drivers, "questions": questions}
    except json.JSONDecodeError:
        return {"risk_drivers": [], "questions": [], "items_empty_reason": "ollama_response_not_valid_json"}
