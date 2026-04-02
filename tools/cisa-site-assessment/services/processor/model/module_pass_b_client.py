"""
PASS B: Generate 1–4 OFCs per question.
Input: one question + evidence. Output: ofcs (strict JSON).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .ollama_client import ollama_chat

PASS_B_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "ofcs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ofc_code": {"type": "string"},
                    "ofc_text": {"type": "string"},
                    "rationale": {"type": "string"},
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
                "required": ["ofc_text", "evidence"],
            },
        },
    },
    "required": ["ofcs"],
}


def build_pass_b_prompt(
    *,
    module_code: str,
    question_code: str,
    question_text: str,
    why_it_matters: str,
    discipline_subtype_hint: str,
    evidence_excerpts: List[str],
) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    system_path = prompts_dir / "MODULE_PASS_B_OFCS_V1.txt"
    system = system_path.read_text(encoding="utf-8")

    prefix = module_code.replace("MODULE_", "").replace("_", "")[:6].upper()
    if not prefix:
        prefix = "OFC"

    evidence_block = "\n".join(f"- {excerpt}" for excerpt in (evidence_excerpts or ["(no excerpt)"])[:10])

    parts = [
        f"{system}\n\n",
        f"module_code: {module_code}\n",
        f"question_code: {question_code}\n",
        f"question_text: {question_text}\n",
        f"why_it_matters: {why_it_matters}\n",
        f"discipline_subtype_hint: {discipline_subtype_hint}\n\n",
        "Evidence excerpts from source:\n",
        evidence_block,
        "\n\nGenerate 1–4 OFCs. Use ofc_code like " f"{prefix}_OFC_001, {prefix}_OFC_002, etc.\n",
    ]
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


def run_pass_b(
    *,
    model: str,
    module_code: str,
    question: Dict[str, Any],
    temperature: float = 0.2,
    timeout: int = 300,
) -> List[Dict[str, Any]]:
    """Run PASS B for one question. Returns list of OFC dicts (ofc_code, ofc_text, rationale, evidence)."""
    question_code = (question.get("question_code") or "").strip()
    question_text = (question.get("question_text") or "").strip()
    if not question_text:
        return []
    why_it_matters = (question.get("why_it_matters") or "").strip()
    discipline_subtype_hint = (question.get("discipline_subtype_hint") or "").strip() or "General"
    evidence_list = question.get("evidence") or []
    evidence_excerpts = []
    for e in evidence_list if isinstance(evidence_list, list) else []:
        if isinstance(e, dict) and e.get("excerpt"):
            evidence_excerpts.append(str(e.get("excerpt", "")).strip())
        elif isinstance(e, str) and e.strip():
            evidence_excerpts.append(e.strip())

    prompt = build_pass_b_prompt(
        module_code=module_code,
        question_code=question_code,
        question_text=question_text,
        why_it_matters=why_it_matters,
        discipline_subtype_hint=discipline_subtype_hint,
        evidence_excerpts=evidence_excerpts,
    )
    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_schema=PASS_B_OUTPUT_SCHEMA,
    )
    json_text = extract_json_from_response(raw)
    try:
        data = json.loads(json_text)
        if not isinstance(data, dict):
            return []
        ofcs = data.get("ofcs") or []
        if not isinstance(ofcs, list):
            return []
        out = []
        for i, o in enumerate(ofcs[:4]):
            if not isinstance(o, dict):
                continue
            ofc_text = (o.get("ofc_text") or "").strip()
            if not ofc_text:
                continue
            out.append({
                "ofc_code": (o.get("ofc_code") or "").strip() or f"{module_code.replace('MODULE_', '')[:6]}_OFC_{i+1:03d}",
                "ofc_text": ofc_text,
                "rationale": (o.get("rationale") or "").strip(),
                "evidence": o.get("evidence") if isinstance(o.get("evidence"), list) else [],
            })
        return out
    except json.JSONDecodeError:
        return []
