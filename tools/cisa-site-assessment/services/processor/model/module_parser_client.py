"""
Module parser client: Ollama Phase-1 prompts for MODULE generation (not baseline).
Output is kept separate from baseline parser contract.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List

from .ollama_client import ollama_chat

# PLAN: YES/NO plan-coverage only. No open-ended "What/How/Why" questions.
_PLAN_BAD_START = re.compile(
    r"^(What|How|Why|When|Where|Who|Describe|Explain)\b", re.IGNORECASE
)
_PLAN_OK_START = re.compile(
    r"^(Does the plan|Does the plan include|Does the plan address|Does the plan specify|Is there|Are there|Has the plan|Do procedures|Are procedures|Is the plan)\b",
    re.IGNORECASE,
)

DEBUG = os.environ.get("PSA_MODULE_PARSER_DEBUG", "").strip().lower() in ("1", "true", "yes")
DEBUG_SCO_PROMPT = os.environ.get("DEBUG_SCO_PROMPT", "").strip() == "1"


class StandardPromptContainsPlanForObjectModuleError(Exception):
    """Raised when an OBJECT module prompt incorrectly contains 'plan element' vocabulary."""

    MESSAGE = "STANDARD_PROMPT_CONTAINS_PLAN_FOR_OBJECT_MODULE"


def _log_sco_prompt_debug(prompt: str, module_kind: str) -> None:
    """When DEBUG_SCO_PROMPT=1, log prompt head, contains_plan, and plan context."""
    if not DEBUG_SCO_PROMPT:
        return
    import sys as _sys
    prompt_single = prompt.replace("\n", " ").replace("\r", " ")[:600]
    contains = "plan element" in prompt.lower()
    print(f"[sco] prompt_head={prompt_single!r}", file=_sys.stderr)
    print(f"[sco] prompt_contains_plan={contains}", file=_sys.stderr)
    if contains:
        idx = prompt.lower().find("plan element")
        start = max(0, idx - 80)
        end = min(len(prompt), idx + len("plan element") + 80)
        ctx = prompt[start:end].replace("\n", " ").replace("\r", " ")
        print(f"[sco] plan_context={ctx!r}", file=_sys.stderr)

# Max chars per chunk in consolidated prompt to stay within context
DEFAULT_MAX_CHUNK_CHARS = 2000

# JSON schema for consolidated parser output. Citations are HANDLES only (e.g. ["C01","C07"]); server maps to canonical IDs.
MODULE_PARSER_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "module_code": {"type": "string"},
        "module_title": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "question": {"type": "string"},
                    "finding": {"type": "string"},
                    "ofcs": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "0 to 4 option strings per item; 0 allowed during generation (export may require 1-4 or NO_OFC_NEEDED)",
                    },
                    "evidence_excerpt": {"type": "string"},
                    "citations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Array of handles only, e.g. ['C01','C07']. Each item must cite 1-3 handles from the Retrieved Context. Do NOT output source ids, chunk ids, URLs, or page numbers.",
                    },
                },
                "required": ["question", "finding", "citations"],
            },
        },
    },
    "required": ["module_code", "module_title", "items"],
}


def _format_scope_terms(terms: List[str] | None) -> str:
    if not terms:
        return "(none)"
    return ", ".join(str(t).strip() for t in terms if str(t).strip())


def build_module_prompt(
    *,
    module_code: str,
    module_title: str,
    module_kind: str,  # "OBJECT" | "PLAN"
    chunk_text: str,
    chunk_id: str,
    page_range: str,
    source_file: str,
    in_scope_terms: List[str] | None = None,
    out_of_scope_terms: List[str] | None = None,
) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"

    if module_kind.upper() == "PLAN":
        prompt_path = prompts_dir / "MODULE_PARSER_PLAN_V1.txt"
    else:
        prompt_path = prompts_dir / "MODULE_PARSER_OBJECT_V1.txt"

    system = prompt_path.read_text(encoding="utf-8")

    parts = [
        f"{system}\n\n",
        f"module_code: {module_code}\n",
        f"module_title: {module_title}\n",
    ]
    if module_kind.upper() != "PLAN":
        parts.append(f"in_scope_terms: {_format_scope_terms(in_scope_terms)}\n")
        parts.append(f"out_of_scope_terms: {_format_scope_terms(out_of_scope_terms)}\n")
    parts.extend([
        f"source_file: {source_file}\n",
        f"chunk_id: {chunk_id}\n",
        f"page_range: {page_range}\n",
        f"chunk_text:\n{chunk_text}\n",
    ])
    return "".join(parts)


def _build_handle_map(chunks: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Build C01..C{N} -> {chunk_id, source_file, page_range} from chunks in order."""
    return {
        f"C{i + 1:02d}": {
            "chunk_id": str(ch.get("chunk_id", "")).strip(),
            "source_file": str(ch.get("source_file", "")),
            "page_range": str(ch.get("page_range", "")),
        }
        for i, ch in enumerate(chunks)
    }


def build_consolidated_prompt(
    *,
    module_code: str,
    module_title: str,
    module_kind: str,
    chunks: List[Dict[str, Any]],  # each: chunk_id, chunk_text, page_range, source_file
    max_chunk_chars: int = DEFAULT_MAX_CHUNK_CHARS,
    in_scope_terms: List[str] | None = None,
    out_of_scope_terms: List[str] | None = None,
    handle_map: Dict[str, Dict[str, Any]] | None = None,
) -> tuple[str, Dict[str, Dict[str, Any]]]:
    """Build prompt with Retrieved Context (handles only). Returns (prompt_string, handle_map)."""
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    prompt_path = prompts_dir / "MODULE_PARSER_CONSOLIDATED_V1.txt"
    system = prompt_path.read_text(encoding="utf-8")
    if handle_map is None:
        handle_map = _build_handle_map(chunks)

    parts = [
        f"{system}\n\n",
        f"module_code: {module_code}\n",
        f"module_title: {module_title}\n",
        f"module_kind: {module_kind}\n",
        f"in_scope_terms: {_format_scope_terms(in_scope_terms)}\n",
        f"out_of_scope_terms: {_format_scope_terms(out_of_scope_terms)}\n\n",
        "CITATION RULES (NON-NEGOTIABLE):\n",
        "- Citations MUST be an array of handles only (e.g. ['C01','C07']).\n",
        "- Do NOT output source ids, chunk ids, URLs, or page numbers in citations.\n",
        "- Every item must cite 1–3 handles from the Retrieved Context below.\n\n",
        "Retrieved Context (cite ONLY by handle):\n",
    ]
    retrieved = []
    for h in sorted(handle_map.keys()):
        ref = handle_map[h]
        ch = next((c for c in chunks if str(c.get("chunk_id", "")).strip() == ref["chunk_id"]), None)
        if not ch:
            continue
        src = ref.get("source_file", "") or ch.get("source_file", "")
        pr = ref.get("page_range", "") or ch.get("page_range", "")
        locator = f"p.{pr}" if pr and not str(pr).startswith("p") else str(pr) or "p.1"
        text = (ch.get("chunk_text") or "").strip()
        if max_chunk_chars and len(text) > max_chunk_chars:
            text = text[:max_chunk_chars] + "\n[... truncated ...]"
        retrieved.append({"h": h, "source_label": src[:120], "locator": locator, "text": text[:800]})
    parts.append(json.dumps(retrieved, ensure_ascii=False, indent=2))
    parts.append("\n\nOutput one JSON object with items[]. Each item must have question, finding, ofcs, evidence_excerpt, and citations (array of handles from the list above).\n")
    return "".join(parts), handle_map


def _resolve_source_chunk_id(
    cid: str,
    valid_chunk_ids: set,
    chunk_by_id: Dict[str, Dict[str, Any]],
    index_to_chunk_id: Dict[str, str],
    chunks: List[Dict[str, Any]],
) -> str | None:
    """Resolve model output (UUID, index, or fragment) to a valid chunk_id."""
    if not cid:
        return None
    if cid in valid_chunk_ids:
        return cid
    if cid in index_to_chunk_id:
        return index_to_chunk_id[cid]
    # 0-based index: "0", "1", ...
    if cid.isdigit():
        i = int(cid)
        if 0 <= i < len(chunks):
            resolved = str(chunks[i].get("chunk_id", "")).strip()
            if resolved in valid_chunk_ids:
                return resolved
    # "chunk_1", "chunk1" -> 1-based index
    cid_lower = cid.lower()
    if cid_lower.startswith("chunk"):
        rest = cid_lower[5:].lstrip("_ ")
        if rest.isdigit():
            one_based = int(rest)
            if 1 <= one_based <= len(chunks):
                resolved = str(chunks[one_based - 1].get("chunk_id", "")).strip()
                if resolved in valid_chunk_ids:
                    return resolved
    # Prefix match: model returned truncated UUID (e.g. first 8 chars)
    for vid in valid_chunk_ids:
        if vid.startswith(cid) or cid.startswith(vid):
            return vid
    return None


def _clean_items_consolidated(
    data_items: List[Dict[str, Any]],
    handle_map: Dict[str, Dict[str, Any]],
    module_kind: str = "OBJECT",
) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Validate citations as handles; map to canonical chunk_id/source_file/page_range. Track drop reasons and examples."""
    cleaned: List[Dict[str, Any]] = []
    drop_reasons: Dict[str, int] = {"missing_citations": 0, "invalid_handle": 0, "zero_ofc_kept": 0, "other": 0, "invalid_plan_question": 0}
    examples: List[Dict[str, Any]] = []
    for idx, it in enumerate(data_items[:24]):
        if not isinstance(it, dict):
            drop_reasons["other"] += 1
            continue
        q = str(it.get("question") or "").strip()
        if module_kind.upper() == "PLAN" and q:
            if _PLAN_BAD_START.search(q) or not _PLAN_OK_START.search(q):
                drop_reasons["invalid_plan_question"] += 1
                continue
        ofcs_raw = it.get("ofcs")
        if isinstance(ofcs_raw, str) and ofcs_raw.strip():
            ofcs_raw = [ofcs_raw]
        if not isinstance(ofcs_raw, list):
            ofcs_raw = []
        ofcs = []
        for x in ofcs_raw:
            if isinstance(x, dict):
                text = (x.get("text") or x.get("option") or x.get("ofc_text") or "").strip()
            else:
                text = str(x).strip() if x else ""
            if text:
                ofcs.append(text)
        if len(ofcs) == 1 and len(ofcs[0]) > 80:
            for sep in (" | ", ". ", "; ", "\n"):
                if sep in ofcs[0]:
                    parts = [p.strip() for p in ofcs[0].split(sep) if p.strip() and len(p.strip()) > 10]
                    if len(parts) >= 2:
                        ofcs = parts[:4]
                        break
        if len(ofcs) == 0:
            drop_reasons["zero_ofc_kept"] += 1
        if len(ofcs) > 4:
            ofcs = ofcs[:4]
        citations = it.get("citations")
        if not isinstance(citations, list):
            citations = []
        citations = [str(h).strip() for h in citations if h is not None and str(h).strip()]
        if len(citations) == 0:
            drop_reasons["missing_citations"] += 1
            if len(examples) < 5:
                examples.append({"reason": "missing_citations", "item_type": "question", "text": (q or "")[:100], "bad_handles": None})
            continue
        bad = [h for h in citations if h not in handle_map]
        if bad:
            drop_reasons["invalid_handle"] += 1
            if len(examples) < 5:
                examples.append({"reason": "invalid_handle", "item_type": "question", "text": (q or "")[:100], "bad_handles": bad[:5]})
            continue
        ref = handle_map.get(citations[0])
        if not ref:
            drop_reasons["invalid_handle"] += 1
            continue
        it = dict(it)
        it["ofcs"] = ofcs
        it["source_chunk_id"] = ref.get("chunk_id", "")
        it["source_file"] = ref.get("source_file", "")
        it["page_range"] = ref.get("page_range", "")
        if len(ofcs) == 0:
            it["NEEDS_OFC"] = True
        cleaned.append(it)
    drop_summary: Dict[str, Any] = {
        "drop_reasons": drop_reasons,
        "examples": examples[:5],
        "invalid_citation": drop_reasons.get("invalid_handle", 0) + drop_reasons.get("missing_citations", 0),
        "sample_source_chunk_ids": [],
    }
    return cleaned, drop_summary


def extract_from_all_chunks_module_parser(
    *,
    model: str,
    module_code: str,
    module_title: str,
    module_kind: str,
    chunks: List[Dict[str, Any]],
    max_chunk_chars: int = DEFAULT_MAX_CHUNK_CHARS,
    in_scope_terms: List[str] | None = None,
    out_of_scope_terms: List[str] | None = None,
    temperature: float = 0.2,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """
    Single Ollama call with ALL chunks. Model understands all, then chooses the best chunk per item.
    No fake data; items with invalid citation are dropped. Items with 0 OFCs are kept (NEEDS_OFC); export may require 1–4 or NO_OFC_NEEDED.
    """
    if not chunks:
        return {"module_code": module_code, "module_title": module_title, "items": [], "items_empty_reason": "no_chunks"}

    prompt, handle_map = build_consolidated_prompt(
        module_code=module_code,
        module_title=module_title,
        module_kind=module_kind,
        chunks=chunks,
        max_chunk_chars=max_chunk_chars,
        in_scope_terms=in_scope_terms,
        out_of_scope_terms=out_of_scope_terms,
    )
    _log_sco_prompt_debug(prompt, module_kind)
    if module_kind.upper() == "OBJECT" and "plan element" in prompt.lower():
        raise StandardPromptContainsPlanForObjectModuleError(
            StandardPromptContainsPlanForObjectModuleError.MESSAGE
        )
    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_schema=MODULE_PARSER_OUTPUT_SCHEMA,
    )
    json_text = raw.strip()
    if json_text.startswith("```"):
        lines = json_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        json_text = "\n".join(lines)

    # If model prepended prose (e.g. "The text appears to be..."), extract JSON object
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

    try:
        data = json.loads(json_text)
        if not isinstance(data, dict):
            if DEBUG:
                print(f"[module_parser consolidated] result not a dict; raw (first 500): {raw[:500]!r}")
            return {"module_code": module_code, "module_title": module_title, "items": [], "items_empty_reason": "ollama_response_not_dict"}
        if "items" not in data or not isinstance(data["items"], list):
            if DEBUG:
                print(f"[module_parser consolidated] missing/invalid items; raw (first 500): {raw[:500]!r}")
            return {"module_code": module_code, "module_title": module_title, "items": [], "items_empty_reason": "ollama_response_missing_or_invalid_items"}
        cleaned, drop_summary = _clean_items_consolidated(
            data["items"],
            handle_map=handle_map,
            module_kind=module_kind,
        )
        out = {
            "module_code": str(data.get("module_code", module_code)),
            "module_title": str(data.get("module_title", module_title)),
            "items": cleaned,
        }
        if len(cleaned) == 0 and data["items"]:
            out["items_empty_reason"] = "all_items_dropped_invalid_citation"
            out["items_drop_summary"] = drop_summary
            drop_reasons = drop_summary.get("drop_reasons") or {}
            dropped_total = sum(drop_reasons.values())
            out["dropped_total"] = dropped_total
            out["drop_reasons"] = drop_reasons
            out["examples"] = drop_summary.get("examples") or []
            out["items_raw_sample"] = [
                {"citations": it.get("citations", [])[:5], "ofcs_count": len(it.get("ofcs") or [])}
                for it in (data["items"][:3]) if isinstance(it, dict)
            ]
        return out
    except Exception as e:
        if DEBUG:
            print(f"[module_parser consolidated] parse error: {e!r}; raw (first 500): {raw[:500]!r}")
        return {"module_code": module_code, "module_title": module_title, "items": [], "items_empty_reason": "ollama_response_not_valid_json"}


def extract_from_chunk_module_parser(
    *,
    model: str,
    module_code: str,
    module_title: str,
    module_kind: str,
    chunk_text: str,
    chunk_id: str,
    page_range: str,
    source_file: str,
    in_scope_terms: List[str] | None = None,
    out_of_scope_terms: List[str] | None = None,
    temperature: float = 0.2,
    timeout: int = 1200,
) -> Dict[str, Any]:
    prompt = build_module_prompt(
        module_code=module_code,
        module_title=module_title,
        module_kind=module_kind,
        chunk_text=chunk_text,
        chunk_id=chunk_id,
        page_range=page_range,
        source_file=source_file,
        in_scope_terms=in_scope_terms,
        out_of_scope_terms=out_of_scope_terms,
    )

    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_schema=MODULE_PARSER_OUTPUT_SCHEMA,
    )

    json_text = raw.strip()
    # Strip markdown code fence if present
    if json_text.startswith("```"):
        lines = json_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        json_text = "\n".join(lines)

    try:
        data = json.loads(json_text)
        if not isinstance(data, dict):
            if DEBUG:
                print(f"[module_parser] chunk_id={chunk_id} result not a dict; raw (first 500): {raw[:500]!r}")
            return {"module_code": module_code, "module_title": module_title, "items": []}
        if "items" not in data or not isinstance(data["items"], list):
            if DEBUG:
                print(f"[module_parser] chunk_id={chunk_id} missing/invalid items; raw (first 500): {raw[:500]!r}")
            return {"module_code": module_code, "module_title": module_title, "items": []}

        # Enforce OFC count bounds (0–4); cite actual source chunk; 0 OFCs allowed (NEEDS_OFC)
        cleaned = []
        for it in data["items"][:12]:
            if not isinstance(it, dict):
                continue
            ofcs_raw = it.get("ofcs")
            # Normalize: allow single string from model
            if isinstance(ofcs_raw, str) and ofcs_raw.strip():
                ofcs_raw = [ofcs_raw]
            if not isinstance(ofcs_raw, list):
                ofcs_raw = []
            ofcs = []
            for x in ofcs_raw:
                if isinstance(x, dict):
                    text = (x.get("text") or x.get("option") or x.get("ofc_text") or "").strip()
                else:
                    text = str(x).strip() if x else ""
                if text:
                    ofcs.append(text)
            if len(ofcs) > 4:
                ofcs = ofcs[:4]
            it = dict(it)
            it["ofcs"] = ofcs
            if len(ofcs) == 0:
                it["NEEDS_OFC"] = True
            # Ensure citation fields cite this chunk (overwrite if model hallucinated)
            it["source_chunk_id"] = str(it.get("source_chunk_id") or chunk_id)
            it["source_file"] = str(it.get("source_file") or source_file)
            it["page_range"] = str(it.get("page_range") or page_range)
            cleaned.append(it)

        if not cleaned and DEBUG:
            print(f"[module_parser] chunk_id={chunk_id} all items dropped (e.g. invalid citation); raw (first 800): {raw[:800]!r}")

        return {
            "module_code": str(data.get("module_code", module_code)),
            "module_title": str(data.get("module_title", module_title)),
            "items": cleaned,
        }
    except Exception as e:
        if DEBUG:
            print(f"[module_parser] chunk_id={chunk_id} parse error: {e!r}; raw (first 500): {raw[:500]!r}")
        return {"module_code": module_code, "module_title": module_title, "items": []}
