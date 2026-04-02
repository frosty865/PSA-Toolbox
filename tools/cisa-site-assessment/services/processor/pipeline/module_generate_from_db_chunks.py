"""
High-level deterministic generator: route + packetize + parse.
Uses doc + proximity WINDOWS (group by doc, 3 chunks overlap 1) so router and extractor see local context;
citations remain atomic chunk handles. Optional LLM router or lexical, quota-based selection.
Rule: never send whole-doc raw into the model as primary comprehension—use windows + hierarchical summaries only.
"""

from __future__ import annotations

from typing import Any, Dict, List

from .module_chunk_router import (
    MIN_PACKETS_DEFAULT,
    MAX_PACKETS_DEFAULT,
    build_packets_from_selected,
    build_packets_from_selected_windows,
    build_windows_from_chunks,
    route_kind,
    _count_hits,
    select_by_quota,
    router_stats_from_decisions,
)
from ..model.module_packet_parser_client import parse_module_packet

# Hard cap on total items across all packets
MAX_ITEMS_TOTAL = 12
MIN_CHUNK_CHARS_FOR_ROUTER = 200


def _build_doc_summaries_from_items(all_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Optional hierarchical doc summary: derived from extracted items only (no raw-doc LLM).
    Per-doc: key operational capabilities (questions), key OFC themes. Stays grounded and repeatable.
    """
    by_doc: Dict[str, Dict[str, Any]] = {}
    for it in all_items:
        doc_key = (it.get("source_file") or "").strip() or "unknown"
        if doc_key not in by_doc:
            by_doc[doc_key] = {"question_themes": [], "ofc_themes": []}
        q = (it.get("question") or "").strip()
        if q and q not in by_doc[doc_key]["question_themes"]:
            by_doc[doc_key]["question_themes"].append(q[:200])
        for o in it.get("ofcs") or []:
            text = o if isinstance(o, str) else (o.get("text") or o.get("option") or "")
            if text and text.strip():
                t = text.strip()[:150]
                if t not in by_doc[doc_key]["ofc_themes"]:
                    by_doc[doc_key]["ofc_themes"].append(t)
    return dict(by_doc)


def _assign_handles_and_filter(
    chunks: List[Dict[str, Any]], min_chars: int = MIN_CHUNK_CHARS_FOR_ROUTER
) -> List[Dict[str, Any]]:
    """Filter to chunks with text >= min_chars and assign handle C01, C02, ..."""
    out = []
    for i, ch in enumerate(chunks):
        txt = (ch.get("chunk_text") or ch.get("text") or "").strip()
        if len(txt) < min_chars:
            continue
        h = ch.copy()
        h["handle"] = f"C{i + 1:02d}"
        out.append(h)
    return out


def _lexical_decisions(
    chunks_with_handles: List[Dict[str, Any]],
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
) -> List[Dict[str, Any]]:
    """Build KEEP/MAYBE/IGNORE decisions from lexical router (OBJECT/PLAN -> KEEP, else IGNORE). No MAYBE."""
    decisions = []
    for ch in chunks_with_handles:
        handle = ch.get("handle") or ""
        txt = ch.get("chunk_text") or ch.get("text") or ""
        ins = _count_hits(txt, in_scope_terms)
        outs = _count_hits(txt, out_of_scope_terms)
        if outs > 0 and ins == 0:
            decisions.append({"handle": handle, "decision": "IGNORE", "reason": "Out-of-scope terms", "tags": []})
            continue
        if ins == 0:
            decisions.append({"handle": handle, "decision": "IGNORE", "reason": "No in-scope signal", "tags": []})
            continue
        kind = route_kind(txt)
        if kind == "IGNORE":
            decisions.append({"handle": handle, "decision": "IGNORE", "reason": "Lexical gate: no PHYS/GOV", "tags": []})
        else:
            decisions.append({"handle": handle, "decision": "KEEP", "reason": f"Lexical gate: {kind}", "tags": []})
    return decisions


def _lexical_decisions_for_windows(
    windows: List[Dict[str, Any]],
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
) -> List[Dict[str, Any]]:
    """Build KEEP/MAYBE/IGNORE decisions per window from combined window text (lexical)."""
    decisions = []
    for w in windows:
        primary_handle = w.get("primary_handle") or ""
        packet_text = (w.get("packet_text") or "").strip()
        ins = _count_hits(packet_text, in_scope_terms)
        outs = _count_hits(packet_text, out_of_scope_terms)
        if outs > 0 and ins == 0:
            decisions.append({"handle": primary_handle, "decision": "IGNORE", "reason": "Out-of-scope terms", "tags": []})
            continue
        if ins == 0:
            decisions.append({"handle": primary_handle, "decision": "IGNORE", "reason": "No in-scope signal", "tags": []})
            continue
        kind = route_kind(packet_text)
        if kind == "IGNORE":
            decisions.append({"handle": primary_handle, "decision": "IGNORE", "reason": "Lexical gate: no PHYS/GOV", "tags": []})
        else:
            decisions.append({"handle": primary_handle, "decision": "KEEP", "reason": f"Lexical gate: {kind}", "tags": []})
    return decisions


def generate_module_from_chunks(
    *,
    model_object: str,
    model_plan: str,
    module_code: str,
    module_title: str,
    module_kind: str,  # "OBJECT" | "PLAN" — from standard_class; structure, not topic
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
    chunks: List[Dict[str, Any]],  # from DB: chunk_id, chunk_text, page_range, source_file
    max_chunks_per_packet: int = 5,
    timeout: int = 1200,
    use_analyst_prompt: bool = False,  # OBJECT only: use Physical Security Vulnerability Analyst prompt
    standard_key: str | None = None,  # PHYSICAL_SECURITY_MEASURES -> use LLM router + quota
    min_packets: int = MIN_PACKETS_DEFAULT,
    max_packets: int = MAX_PACKETS_DEFAULT,
) -> Dict[str, Any]:
    # Filter to text >= 200 and assign handles (C01, C02, ...)
    chunks_with_handles = _assign_handles_and_filter(chunks)
    N = len(chunks_with_handles)
    forced_kind = module_kind.upper().strip()
    if forced_kind not in ("OBJECT", "PLAN"):
        forced_kind = "OBJECT"

    # When N == 0, only then allow no_packets
    if N == 0:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "items": [],
            "items_empty_reason": "no_packets",
            "router": {"total": 0, "keep": 0, "maybe": 0, "ignore": 0, "examples": {"ignore": [], "maybe": [], "keep": []}},
            "stage_debug": {
                "retrieval": {"chunks_total": 0, "chunks_usable": 0, "windows": 0},
                "router": {"keep": 0, "maybe": 0, "ignore": 0, "selected": 0},
                "packets": {"total": 0, "avg_chunks_per_packet": 0},
                "parser": {"raw_len": 0, "parse_ok": True, "schema_ok": True},
                "extracted": {"questions": 0, "vulns": 0, "ofcs": 0},
                "dropped": {"total": 0, "by_reason": {}, "examples": []},
                "final": {"kept": 0, "empty_reason": "no_packets"},
            },
        }

    # Doc + proximity windows: group by doc, sliding window size 3 overlap 1; router decides per window
    windows = build_windows_from_chunks(chunks_with_handles)
    if not windows:
        return {
            "module_code": module_code,
            "module_title": module_title,
            "items": [],
            "items_empty_reason": "no_packets",
            "router": {"total": 0, "keep": 0, "maybe": 0, "ignore": 0, "examples": {"ignore": [], "maybe": [], "keep": []}},
            "stage_debug": {
                "retrieval": {"chunks_total": N, "chunks_usable": N, "windows": 0},
                "router": {"keep": 0, "maybe": 0, "ignore": 0, "selected": 0},
                "packets": {"total": 0, "avg_chunks_per_packet": 0},
                "parser": {"raw_len": 0, "parse_ok": True, "schema_ok": True},
                "extracted": {"questions": 0, "vulns": 0, "ofcs": 0},
                "dropped": {"total": 0, "by_reason": {}, "examples": []},
                "final": {"kept": 0, "empty_reason": "no_packets"},
            },
        }

    handles_in_order = [w["primary_handle"] for w in windows]
    use_llm_router = (standard_key or "").strip().upper() == "PHYSICAL_SECURITY_MEASURES"
    if use_llm_router:
        from ..model.module_router_llm import route_windows_with_llm
        router_out = route_windows_with_llm(windows, standard_key or "", model=model_object, timeout=min(300, timeout))
        decisions = router_out.get("decisions") or []
    else:
        decisions = _lexical_decisions_for_windows(windows, in_scope_terms, out_of_scope_terms)

    quota = select_by_quota(decisions, handles_in_order, min_packets=min_packets, max_packets=max_packets)
    selected_handles = quota.get("selected_handles") or []
    if not selected_handles:
        router_stats = router_stats_from_decisions(decisions)
        return {
            "module_code": module_code,
            "module_title": module_title,
            "items": [],
            "items_empty_reason": "no_packets",
            "router": {**router_stats, "selected_count": 0, "forced_count": 0, "used_maybe_fallback": False},
            "stage_debug": {
                "retrieval": {"chunks_total": N, "chunks_usable": N, "windows": len(windows)},
                "router": {**router_stats, "selected": 0},
                "packets": {"total": 0, "avg_chunks_per_packet": 0},
                "parser": {"raw_len": 0, "parse_ok": True, "schema_ok": True},
                "extracted": {"questions": 0, "vulns": 0, "ofcs": 0},
                "dropped": {"total": 0, "by_reason": {}, "examples": []},
                "final": {"kept": 0, "empty_reason": "no_packets"},
            },
        }

    # One packet per selected window; each packet's chunks = that window's chunks (parser sees local context)
    packets = build_packets_from_selected_windows(
        windows,
        selected_handles,
        module_code,
        forced_kind,
    )
    router_stats = router_stats_from_decisions(decisions)
    router_stats["selected_count"] = len(selected_handles)
    router_stats["forced_count"] = quota.get("forced_count") or 0
    router_stats["used_maybe_fallback"] = quota.get("used_maybe_fallback") or False

    all_items: List[Dict[str, Any]] = []
    last_empty_reason: str | None = None
    last_debug_trace: Dict[str, Any] | None = None
    packets_run = 0
    # Stage-level debug trace (actionable for 0-item results)
    stage_debug: Dict[str, Any] = {
        "retrieval": {"chunks_total": N, "chunks_usable": N, "windows": len(windows)},
        "router": {
            "keep": router_stats.get("keep", 0),
            "maybe": router_stats.get("maybe", 0),
            "ignore": router_stats.get("ignore", 0),
            "selected": router_stats.get("selected_count", 0),
        },
        "packets": {
            "total": len(packets),
            "avg_chunks_per_packet": round(sum(len(p.chunks) for p in packets) / len(packets), 1) if packets else 0,
        },
        "parser": {"raw_len": 0, "parse_ok": True, "schema_ok": True},
        "extracted": {"questions": 0, "vulns": 0, "ofcs": 0},
        "dropped": {"total": 0, "by_reason": {}, "examples": []},
        "final": {"kept": 0, "empty_reason": ""},
    }
    drop_by_reason: Dict[str, int] = {}
    drop_examples: List[Dict[str, Any]] = []

    for pkt in packets:
        if pkt.kind == "IGNORE":
            continue
        kind = forced_kind
        if kind == "OBJECT":
            out = parse_module_packet(
                model=model_object,
                module_code=module_code,
                module_title=module_title,
                kind="OBJECT",
                packet_id=pkt.packet_id,
                in_scope_terms=in_scope_terms,
                out_of_scope_terms=out_of_scope_terms,
                chunks=pkt.chunks,
                timeout=timeout,
                use_analyst_prompt=use_analyst_prompt,
                standard_key=standard_key or None,
            )
        elif kind == "PLAN":
            out = parse_module_packet(
                model=model_plan,
                module_code=module_code,
                module_title=module_title,
                kind="PLAN",
                packet_id=pkt.packet_id,
                in_scope_terms=in_scope_terms,
                out_of_scope_terms=out_of_scope_terms,
                chunks=pkt.chunks,
                timeout=timeout,
                standard_key=standard_key or None,
            )
        else:
            continue

        packets_run += 1
        if out.get("items_empty_reason"):
            last_empty_reason = out["items_empty_reason"]
            if out.get("debug_trace"):
                last_debug_trace = out["debug_trace"]
        dt = out.get("debug_trace") or {}
        if dt.get("llm"):
            stage_debug["parser"]["raw_len"] = stage_debug["parser"]["raw_len"] + (dt["llm"].get("raw_response_chars") or 0)
        if dt.get("parsing") is not None and dt["parsing"].get("json_parse_ok") is False:
            stage_debug["parser"]["parse_ok"] = False
        for reason, count in ((dt.get("drops") or {}).get("by_reason") or {}).items():
            drop_by_reason[reason] = drop_by_reason.get(reason, 0) + count
        for ex in (dt.get("drops") or {}).get("examples") or []:
            if len(drop_examples) < 15:
                drop_examples.append(ex)

        for it in out.get("items", []):
            # Normalize to API shape: source_chunk_id, source_file, page_range from first citation
            cits = it.get("citations") or []
            if cits:
                first = cits[0] if isinstance(cits[0], dict) else {}
                it["source_chunk_id"] = first.get("chunk_id") or ""
                it["source_file"] = first.get("source_file") or ""
                it["page_range"] = first.get("page_range") or ""
            all_items.append(it)

        if len(all_items) >= MAX_ITEMS_TOTAL:
            all_items = all_items[:MAX_ITEMS_TOTAL]
            break

    # Finalize stage debug: extracted, dropped, final
    stage_debug["extracted"] = {
        "questions": len(all_items),
        "vulns": 0,
        "ofcs": sum(len(it.get("ofcs") or []) for it in all_items),
    }
    stage_debug["dropped"] = {
        "total": sum(drop_by_reason.values()),
        "by_reason": drop_by_reason,
        "examples": drop_examples[:10],
    }
    empty_reason = (
        last_empty_reason
        if last_empty_reason
        else ("all_items_dropped" if packets_run > 0 else "no_packets")
    )
    # Normalize to specific reasons for actionable 0-item feedback
    if empty_reason == "llm_empty_response":
        empty_reason = "parser_empty_response"
    stage_debug["final"] = {"kept": len(all_items), "empty_reason": empty_reason}

    result: Dict[str, Any] = {
        "module_code": module_code,
        "module_title": module_title,
        "items": all_items,
        "router": router_stats,
        "stage_debug": stage_debug,
    }
    if all_items:
        result["doc_summaries"] = _build_doc_summaries_from_items(all_items)
    if not all_items:
        result["items_empty_reason"] = empty_reason
        if last_debug_trace:
            result["debug_trace"] = last_debug_trace
    return result
