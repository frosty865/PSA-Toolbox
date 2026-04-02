"""
Packet-based module parser: OBJECT/PLAN prompts with multi-citation output.
Validates: YES/NO questions (OBJECT), non-garbled OFCs, evidence_excerpt in chunk texts.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

from .ollama_client import ollama_chat

DEBUG_SCO_PROMPT = os.environ.get("DEBUG_SCO_PROMPT", "").strip() == "1"


def _maybe_dump_prompt_response(module_code: str, packet_id: str, prompt: str, raw_response: str) -> None:
    """If GENERATION_DUMP_DIR and GENERATION_DEBUG_DUMP are set, write prompt and response once per run (dev only)."""
    if os.environ.get("GENERATION_DEBUG_DUMP_DONE") == "1":
        return
    dump_dir = os.environ.get("GENERATION_DUMP_DIR", "").strip()
    if not dump_dir or os.environ.get("GENERATION_DEBUG_DUMP") != "1":
        return
    try:
        path = Path(dump_dir)
        path.mkdir(parents=True, exist_ok=True)
        ts = int(time.time())
        safe_code = (module_code or "module").replace(os.path.sep, "_")[:64]
        prefix = f"{ts}_{safe_code}"
        (path / f"{prefix}_prompt.txt").write_text(prompt, encoding="utf-8")
        (path / f"{prefix}_response.txt").write_text(raw_response or "", encoding="utf-8")
        os.environ["GENERATION_DEBUG_DUMP_DONE"] = "1"
    except Exception as e:
        print(f"[module_packet_parser] dump failed: {e}", file=sys.stderr)


class StandardPromptContainsPlanForObjectModuleError(Exception):
    """Raised when an OBJECT module prompt incorrectly contains 'plan element' vocabulary."""

    MESSAGE = "STANDARD_PROMPT_CONTAINS_PLAN_FOR_OBJECT_MODULE"


def _log_sco_prompt_debug(prompt: str, kind: str) -> None:
    """When DEBUG_SCO_PROMPT=1, log prompt head, contains_plan, and plan context."""
    if not DEBUG_SCO_PROMPT or kind.upper() != "OBJECT":
        return
    prompt_single = prompt.replace("\n", " ").replace("\r", " ")[:600]
    contains = "plan element" in prompt.lower()
    print(f"[sco] prompt_head={prompt_single!r}", file=sys.stderr)
    print(f"[sco] prompt_contains_plan={contains}", file=sys.stderr)
    if contains:
        idx = prompt.lower().find("plan element")
        start = max(0, idx - 80)
        end = min(len(prompt), idx + len("plan element") + 80)
        ctx = prompt[start:end].replace("\n", " ").replace("\r", " ")
        print(f"[sco] plan_context={ctx!r}", file=sys.stderr)

_OBJ_OK_START = re.compile(
    r"^(Is there|Are there|Is|Are|Does|Do|Can|Has|Have)\b", re.IGNORECASE
)
_OBJ_BAD_START = re.compile(
    r"^(What|How|Why|Describe|Explain)\b", re.IGNORECASE
)

# PLAN: YES/NO plan-coverage only. No open-ended "What/How/Why" questions.
_PLAN_BAD_START = re.compile(
    r"^(What|How|Why|When|Where|Who|Describe|Explain)\b", re.IGNORECASE
)
_PLAN_OK_START = re.compile(
    r"^(Does the plan|Does the plan include|Does the plan address|Does the plan specify|Is there|Are there|Has the plan|Do procedures|Are procedures|Is the plan)\b",
    re.IGNORECASE,
)


# Allowed required_element_id per standard_key (empty = skip validation). Populate from plan/object framework.
ALLOWED_REQUIRED_ELEMENTS_BY_STANDARD: Dict[str, List[str]] = {
    "PHYSICAL_SECURITY_MEASURES": [],  # e.g. ["capability_monitoring", "capability_barriers"]
    "PHYSICAL_SECURITY_PLAN": [],       # e.g. ["evacuation", "shelter", "communication"]
}


def _load_prompt(kind: str, standard_key: str | None = None) -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    if standard_key:
        key_upper = standard_key.strip().upper()
        if kind.upper() == "PLAN":
            p = prompts_dir / "PARSER_WINDOWS_PLAN_V1.txt"
        else:
            p = prompts_dir / "PARSER_WINDOWS_OBJECT_V1.txt"
        if p.exists():
            return p.read_text(encoding="utf-8")
    if kind.upper() == "PLAN":
        return (prompts_dir / "MODULE_PACKET_PLAN_V1.txt").read_text(encoding="utf-8")
    return (prompts_dir / "MODULE_PACKET_OBJECT_V1.txt").read_text(encoding="utf-8")


def _load_analyst_prompt() -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    return (prompts_dir / "PHYSICAL_SECURITY_VULNERABILITY_ANALYST_V1.txt").read_text(encoding="utf-8")


def _load_ev_analyst_prompt() -> str:
    prompts_dir = Path(__file__).resolve().parents[1] / "prompts"
    return (prompts_dir / "PSA_EV_MODULE_ANALYST_V1.txt").read_text(encoding="utf-8")


def _ev_domain_from_module_code(module_code: str) -> str | None:
    """Derive module_domain from module_code for EV modules."""
    code = (module_code or "").upper()
    if "EV_PARKING" in code:
        return "EV_PARKING"
    if "EV_CHARGING" in code:
        return "EV_CHARGING"
    return None


def _chunk_containing_evidence(evidence: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any] | None:
    """Return first chunk whose text contains any phrase from evidence (split by |)."""
    phrases = [p.strip() for p in (evidence or "").split("|") if p.strip()]
    if not phrases:
        return None
    for c in chunks:
        text = (c.get("chunk_text") or "").strip()
        if not text:
            continue
        if any(ph in text for ph in phrases):
            return c
    return None


def _ofc_garbled(s: str) -> bool:
    s = (s or "").strip()
    if len(s) < 12:
        return True
    if re.search(r"^\w{1,3}\s*-\s*$", s):  # "EC -"
        return True
    if re.search(r"\bO\s*ecti\s*es\b", s, re.IGNORECASE):
        return True
    return False


def _evidence_in_any_chunk(evidence: str, chunks: List[Dict[str, Any]]) -> bool:
    # verify each phrase appears verbatim in at least one chunk
    phrases = [p.strip() for p in (evidence or "").split("|") if p.strip()]
    if not phrases:
        return False
    texts = [c.get("chunk_text", "") or "" for c in chunks]
    for ph in phrases:
        if not any(ph in t for t in texts):
            return False
    return True


def parse_module_packet(
    *,
    model: str,
    module_code: str,
    module_title: str,
    kind: str,  # OBJECT | PLAN
    packet_id: str,
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
    chunks: List[Dict[str, Any]],
    temperature: float = 0.2,
    timeout: int = 1200,
    use_analyst_prompt: bool = False,
    standard_key: str | None = None,
) -> Dict[str, Any]:
    # OBJECT + EV domain: use EV analyst prompt (EV_PARKING vs EV_CHARGING separation)
    ev_domain = _ev_domain_from_module_code(module_code)
    if kind.upper() == "OBJECT" and ev_domain:
        return _parse_module_packet_ev_analyst(
            model=model,
            module_code=module_code,
            module_title=module_title,
            module_domain=ev_domain,
            packet_id=packet_id,
            chunks=chunks,
            temperature=temperature,
            timeout=timeout,
        )
    # OBJECT + use_analyst_prompt: Physical Security Vulnerability Analyst
    if kind.upper() == "OBJECT" and use_analyst_prompt:
        return _parse_module_packet_analyst(
            model=model,
            module_code=module_code,
            module_title=module_title,
            packet_id=packet_id,
            chunks=chunks,
            temperature=temperature,
            timeout=timeout,
        )
    # Per-packet citation allowlist: use chunk.handle when present (window chunks), else C01..CN
    allowed_handles = set()
    handle_map: Dict[str, Dict[str, str]] = {}
    for i, c in enumerate(chunks):
        h = (c.get("handle") or "").strip() or f"C{i + 1:02d}"
        allowed_handles.add(h)
        handle_map[h] = {
            "chunk_id": str(c.get("chunk_id", "")).strip(),
            "source_file": str(c.get("source_file", "")),
            "page_range": str(c.get("page_range", "")),
        }
    system = _load_prompt(kind, standard_key)
    retrieved_context = []
    for i, c in enumerate(chunks):
        h = (c.get("handle") or "").strip() or f"C{i + 1:02d}"
        src = c.get("source_file", "") or ""
        pr = c.get("page_range", "") or ""
        locator = f"p.{pr}" if pr and not str(pr).startswith("p") else str(pr) or "p.1"
        text = (c.get("chunk_text") or "")[:800]
        retrieved_context.append({"h": h, "source_label": src[:120], "locator": locator, "text": text})
    payload = {
        "module_code": module_code,
        "module_title": module_title,
        "in_scope_terms": in_scope_terms,
        "out_of_scope_terms": out_of_scope_terms,
        "packet_id": packet_id,
        "retrieved_context": retrieved_context,
    }

    prompt = system + "\n\n" + json.dumps(payload, ensure_ascii=False)
    _log_sco_prompt_debug(prompt, kind)
    if kind.upper() == "OBJECT" and "plan element" in prompt.lower():
        raise StandardPromptContainsPlanForObjectModuleError(
            StandardPromptContainsPlanForObjectModuleError.MESSAGE
        )

    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_json=True,
    )
    _maybe_dump_prompt_response(module_code, packet_id, prompt, raw or "")
    raw_stripped = (raw or "").strip()
    if not raw_stripped:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "llm_empty_response",
            "debug_trace": {"llm": {"raw_response_chars": 0, "raw_response_preview": ""}, "parsing": {"json_parse_ok": False}},
        }
    try:
        data = json.loads(raw_stripped)
    except Exception as parse_err:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "json_parse_failed",
            "debug_trace": {
                "llm": {"raw_response_chars": len(raw_stripped), "raw_response_preview": raw_stripped[:800]},
                "parsing": {"json_parse_ok": False, "parse_error": str(parse_err)},
            },
        }

    items = data.get("items", [])
    if not isinstance(items, list):
        items = []
    if not items:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "extractor_returned_zero_items",
            "debug_trace": {
                "llm": {"raw_response_chars": len(raw_stripped), "raw_response_preview": raw_stripped[:800]},
                "parsing": {"json_parse_ok": True},
                "extracted": {"questions": 0, "vulnerabilities": 0, "ofcs": 0},
            },
        }

    # Citation allowlist: only handles in allowed_handles; citations must be string[] (handles only)
    drop_reasons: Dict[str, int] = {}
    drop_examples: List[Dict[str, Any]] = []
    max_examples_per_reason = 3

    def _drop(reason: str, item_snippet: str = "") -> None:
        drop_reasons[reason] = drop_reasons.get(reason, 0) + 1
        if len([e for e in drop_examples if e.get("reason") == reason]) < max_examples_per_reason:
            drop_examples.append({"reason": reason, "text": (item_snippet or "")[:200]})

    cleaned = []
    for it in items[:12]:
        if not isinstance(it, dict):
            continue
        q = str(it.get("question", "")).strip()
        f = str(it.get("finding", "")).strip()
        ofcs = it.get("ofcs", [])
        ev = str(it.get("evidence_excerpt", "")).strip()
        cits_raw = it.get("citations", [])

        if kind.upper() == "OBJECT":
            if _OBJ_BAD_START.search(q) or not _OBJ_OK_START.search(q):
                _drop("question_form", q)
                continue
        elif kind.upper() == "PLAN":
            if _PLAN_BAD_START.search(q) or not _PLAN_OK_START.search(q):
                _drop("question_form", q)
                continue

        if len(q) < 8 or len(f) < 10:
            _drop("short_content", q)
            continue
        if not isinstance(ofcs, list):
            _drop("invalid_ofcs", "")
            continue
        ofcs = [str(x).strip() for x in ofcs if str(x).strip()]
        if len(ofcs) < 1:
            _drop("no_ofcs", q)
            continue
        if any(_ofc_garbled(o) for o in ofcs):
            _drop("ofc_garbled", str(ofcs)[:150])
            continue
        if len(ofcs) > 4:
            ofcs = ofcs[:4]

        # Citations: handles ONLY (string[]); enforce allowlist
        if not isinstance(cits_raw, list) or len(cits_raw) < 1:
            _drop("missing_citations", q)
            continue
        handles = []
        for x in cits_raw:
            if isinstance(x, dict):
                cid = str(x.get("chunk_id", "")).strip()
                for h, ref in handle_map.items():
                    if ref.get("chunk_id") == cid:
                        handles.append(h)
                        break
            else:
                h = str(x).strip()
                if h:
                    handles.append(h)
        # All cited handles must be in allowed_handles
        invalid = [h for h in handles if h not in allowed_handles]
        if invalid:
            _drop("invalid_handle", f"citations={handles!r} invalid={invalid!r}")
            continue
        if not handles:
            _drop("missing_citations", q)
            continue
        ref = handle_map.get(handles[0])
        if not ref:
            _drop("invalid_handle", str(handles[:3]))
            continue
        if not _evidence_in_any_chunk(ev, chunks):
            _drop("evidence_not_in_chunks", ev[:100])
            continue

        # required_element_id (optional): must be from allowed list for this standard_key
        req_el = (it.get("required_element_id") or "").strip()
        if req_el and standard_key:
            allowed = ALLOWED_REQUIRED_ELEMENTS_BY_STANDARD.get(standard_key.strip().upper())
            if allowed is not None and len(allowed) > 0 and req_el not in allowed:
                _drop("invalid_required_element", f"required_element_id={req_el!r}")
                continue

        it = dict(it)
        it["ofcs"] = ofcs
        it["source_chunk_id"] = ref.get("chunk_id", "")
        it["source_file"] = ref.get("source_file", "")
        it["page_range"] = ref.get("page_range", "")
        it["citations"] = [{"chunk_id": ref["chunk_id"], "source_file": ref["source_file"], "page_range": ref["page_range"]}]
        cleaned.append(it)

    if not cleaned:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "all_items_dropped",
            "debug_trace": {
                "llm": {"raw_response_chars": len(raw_stripped), "raw_response_preview": raw_stripped[:800]},
                "parsing": {"json_parse_ok": True},
                "extracted": {"questions": len(items), "vulnerabilities": 0, "ofcs": sum(len(it.get("ofcs") or []) for it in items if isinstance(it, dict))},
                "drops": {"total_dropped": len(items), "by_reason": drop_reasons, "examples": drop_examples[:10]},
            },
        }

    out_result: Dict[str, Any] = {
        "module_code": module_code,
        "module_title": module_title,
        "packet_id": packet_id,
        "items": cleaned,
    }
    if drop_reasons:
        out_result["debug_trace"] = {
            "drops": {"total_dropped": len(items) - len(cleaned), "by_reason": drop_reasons, "examples": drop_examples[:5]},
        }
    return out_result


def _parse_module_packet_analyst(
    *,
    model: str,
    module_code: str,
    module_title: str,
    packet_id: str,
    chunks: List[Dict[str, Any]],
    temperature: float = 0.2,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """Run Physical Security Vulnerability Analyst prompt; adapt output to packet schema (finding, citations)."""
    system = _load_analyst_prompt()
    # Single document excerpt: concatenate packet chunk texts with source labels
    doc_parts = []
    for c in chunks:
        label = f"[{c.get('source_file', '')} p.{c.get('page_range', '')}]"
        doc_parts.append(f"{label}\n{c.get('chunk_text', '')}")
    document = "\n\n---\n\n".join(doc_parts)
    payload = {"document": document}

    prompt = system + "\n\n" + json.dumps(payload, ensure_ascii=False)

    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_json=True,
    )
    raw_stripped_a = (raw or "").strip()
    if not raw_stripped_a:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "llm_empty_response"}
    try:
        data = json.loads(raw_stripped_a)
    except Exception:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "json_parse_failed"}

    items = data.get("items", [])
    if not isinstance(items, list):
        items = []
    if not items:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "extractor_returned_zero_items"}

    cleaned = []
    for i, it in enumerate(items[:12]):
        if not isinstance(it, dict):
            continue
        q = str(it.get("question", "")).strip()
        vuln = str(it.get("vulnerability", "")).strip()
        f = str(it.get("finding", "")).strip() or vuln  # adapter: vulnerability -> finding
        ofcs = it.get("ofcs", [])
        ev = str(it.get("evidence_excerpt", "")).strip()

        if _OBJ_BAD_START.search(q) or not _OBJ_OK_START.search(q):
            continue
        if len(q) < 8 or len(f) < 10:
            continue
        if not isinstance(ofcs, list):
            continue
        ofcs = [str(x).strip() for x in ofcs if str(x).strip()]
        if len(ofcs) < 1:
            continue
        if any(_ofc_garbled(o) for o in ofcs):
            continue
        if len(ofcs) > 4:
            ofcs = ofcs[:4]
        if not _evidence_in_any_chunk(ev, chunks):
            continue

        # Build citation from chunk that contains evidence; else first chunk
        ref = _chunk_containing_evidence(ev, chunks) or (chunks[0] if chunks else None)
        cits = (
            [{"chunk_id": ref["chunk_id"], "source_file": ref.get("source_file", ""), "page_range": ref.get("page_range", "")}]
            if ref
            else []
        )
        if not cits:
            continue

        it["finding"] = f
        it["ofcs"] = ofcs
        it["citations"] = cits
        it["id"] = it.get("id") or f"{packet_id}.{i + 1}"
        cleaned.append(it)

    if not cleaned:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "all_items_dropped",
        }
    return {
        "module_code": module_code,
        "module_title": module_title,
        "packet_id": packet_id,
        "items": cleaned,
    }


def _parse_module_packet_ev_analyst(
    *,
    model: str,
    module_code: str,
    module_title: str,
    module_domain: str,  # EV_PARKING | EV_CHARGING
    packet_id: str,
    chunks: List[Dict[str, Any]],
    temperature: float = 0.2,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """Run PSA EV Module Analyst prompt; enforce domain (EV_PARKING vs EV_CHARGING) and YES/NO questions."""
    system = _load_ev_analyst_prompt()
    source_file = chunks[0].get("source_file", "") if chunks else ""
    payload = {
        "module_code": module_code,
        "module_title": module_title,
        "module_domain": module_domain,
        "source_file": source_file,
        "chunks": [
            {"chunk_id": c.get("chunk_id", ""), "page_range": c.get("page_range", ""), "chunk_text": c.get("chunk_text", "")}
            for c in chunks
        ],
    }
    prompt = system + "\n\n" + json.dumps(payload, ensure_ascii=False)

    raw = ollama_chat(
        model=model,
        prompt=prompt,
        temperature=temperature,
        timeout=timeout,
        format_json=True,
    )
    raw_stripped_ev = (raw or "").strip()
    if not raw_stripped_ev:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "llm_empty_response"}
    try:
        data = json.loads(raw_stripped_ev)
    except Exception:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "json_parse_failed"}

    items = data.get("items", [])
    if not isinstance(items, list):
        items = []
    if not items:
        return {"module_code": module_code, "module_title": module_title, "packet_id": packet_id, "items": [], "items_empty_reason": "extractor_returned_zero_items"}

    valid_chunk_ids = {str(c.get("chunk_id", "")).strip() for c in chunks}
    cleaned = []
    for i, it in enumerate(items[:12]):
        if not isinstance(it, dict):
            continue
        q = str(it.get("question", "")).strip()
        f = str(it.get("finding", "")).strip()
        ofcs_raw = it.get("ofcs", [])
        ev = str(it.get("evidence_excerpt", "")).strip()
        cits = it.get("citations") or []

        if _OBJ_BAD_START.search(q) or not _OBJ_OK_START.search(q):
            continue
        if len(q) < 8 or len(f) < 10:
            continue
        if not isinstance(ofcs_raw, list):
            continue
        ofcs = [str(x).strip() for x in ofcs_raw if str(x).strip()]
        if len(ofcs) < 2 or len(ofcs) > 4:
            continue
        if any(_ofc_garbled(o) for o in ofcs):
            continue
        if not _evidence_in_any_chunk(ev, chunks):
            continue
        # Citations must reference chunks in this packet
        if not isinstance(cits, list):
            cits = []
        cits = [c for c in cits if isinstance(c, dict) and str(c.get("chunk_id", "")).strip() in valid_chunk_ids]
        if not cits:
            ref = _chunk_containing_evidence(ev, chunks) or (chunks[0] if chunks else None)
            cits = (
                [{"chunk_id": ref["chunk_id"], "source_file": ref.get("source_file", ""), "page_range": ref.get("page_range", "")}]
                if ref
                else []
            )
        if not cits:
            continue

        it = dict(it)
        it["finding"] = f
        it["ofcs"] = ofcs
        it["citations"] = cits
        it["id"] = it.get("id") or f"{packet_id}.{i + 1}"
        cleaned.append(it)

    if not cleaned:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "packet_id": packet_id,
            "items": [],
            "items_empty_reason": "all_items_dropped",
        }
    return {
        "module_code": module_code,
        "module_title": module_title,
        "packet_id": packet_id,
        "items": cleaned,
    }
