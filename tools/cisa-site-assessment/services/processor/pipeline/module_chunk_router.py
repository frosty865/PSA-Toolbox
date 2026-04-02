"""
Deterministic router + packetizer for module generation (no embeddings, pure lexical).
Routes chunks to OBJECT (physical) vs PLAN (governance) vs IGNORE; packetizes into
small same-topic packets to reduce duplicates and improve context.

Doc + proximity windows: group chunks by document, build sliding windows (size 3, overlap 1)
so the router and extractor see local context; citations still use atomic chunk handles.

Also provides quota-based selection (KEEP/MAYBE/IGNORE decisions) and build_packets_from_selected
so that when chunks_usable > 0 we never return no_packets (use MAYBE and FORCED fallback).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Literal

ModuleKind = Literal["OBJECT", "PLAN", "IGNORE"]

# Quota: ensure at least this many packets run when we have usable chunks (prevents all-IGNORE)
MIN_PACKETS_DEFAULT = 8
MAX_PACKETS_DEFAULT = 24

# Doc + proximity windows: window_size=3, overlap=1 (step=2)
WINDOW_SIZE_DEFAULT = 3
WINDOW_OVERLAP_DEFAULT = 1
WINDOW_SEP = "\n\n–––\n\n"

GOV = re.compile(
    r"\b(security objectives|organizational controls|charge point operator|CPO|business continuity|"
    r"incident handling processes|management system|governance|audit|policy framework|risk management)\b",
    re.IGNORECASE,
)

PHYS = re.compile(
    r"\b(layout|spacing|separation|standoff|egress|exit|route|lane|approach|staging|access|barrier|"
    r"bollard|curb|exclusion|signage|wayfinding|suppression|containment|isolation|disconnect|shutoff)\b",
    re.IGNORECASE,
)


def _count_hits(text: str, terms: List[str]) -> int:
    t = text.lower()
    return sum(1 for x in terms if x and x.lower() in t)


def route_kind(chunk_text: str) -> ModuleKind:
    has_phys = bool(PHYS.search(chunk_text))
    has_gov = bool(GOV.search(chunk_text))
    if has_phys:
        return "OBJECT"
    if has_gov and not has_phys:
        return "PLAN"
    return "IGNORE"


@dataclass(frozen=True)
class Packet:
    kind: ModuleKind
    packet_id: str
    chunks: List[Dict[str, Any]]  # chunk_id, chunk_text, page_range, source_file


def build_windows_from_chunks(
    chunks_with_handles: List[Dict[str, Any]],
    window_size: int = WINDOW_SIZE_DEFAULT,
    overlap: int = WINDOW_OVERLAP_DEFAULT,
) -> List[Dict[str, Any]]:
    """
    Group chunks by document (doc_id), then create sliding windows of window_size chunks
    with overlap so adjacent windows share overlap chunks. Each window becomes one "packet"
    for routing; primary_handle = center chunk; packet_text = concat of chunk texts with separators.
    Preserves citation handles (Cxx) so the model still cites atomic chunks.
    """
    if not chunks_with_handles:
        return []
    step = max(1, window_size - overlap)
    # Group by doc_id (preserve order within group from input order)
    by_doc: Dict[str, List[Dict[str, Any]]] = {}
    for ch in chunks_with_handles:
        doc_id = (ch.get("doc_id") or "").strip() or "_single"
        by_doc.setdefault(doc_id, []).append(ch)
    windows: List[Dict[str, Any]] = []
    for doc_id, doc_chunks in by_doc.items():
        n = len(doc_chunks)
        for start in range(0, n, step):
            end = min(start + window_size, n)
            win_chunks = doc_chunks[start:end]
            if not win_chunks:
                continue
            # Center chunk for primary_handle (middle of window)
            center_idx = len(win_chunks) // 2
            center = win_chunks[center_idx]
            primary_handle = center.get("handle") or ""
            context_handles = [c.get("handle") or "" for c in win_chunks]
            # Concatenate text with separators and locators for router/extractor
            parts = []
            for c in win_chunks:
                pg = (c.get("page_range") or "").strip()
                txt = (c.get("chunk_text") or c.get("text") or "").strip()
                label = f"[{c.get('handle', '')}]"
                if pg:
                    label += f" (p.{pg})"
                parts.append(f"{label}\n{txt}")
            packet_text = WINDOW_SEP.join(parts)
            # Locator range for window (first–last page)
            pages = [(c.get("page_range") or "").strip() for c in win_chunks if (c.get("page_range") or "").strip()]
            locator_range = (f"{pages[0]}-{pages[-1]}" if len(pages) > 1 else (pages[0] if pages else ""))
            windows.append({
                "primary_handle": primary_handle,
                "context_handles": context_handles,
                "chunks": win_chunks,
                "packet_text": packet_text,
                "doc_id": doc_id if doc_id != "_single" else "",
                "locator_range": locator_range,
                "source_file": center.get("source_file") or "",
            })
    # Sort windows by first chunk's global order (by handle) so router sees stable order
    handle_order = {c.get("handle"): i for i, c in enumerate(chunks_with_handles)}
    windows.sort(key=lambda w: min(handle_order.get(h, 9999) for h in w.get("context_handles", []) if h))
    return windows


def build_packets_from_selected_windows(
    windows: List[Dict[str, Any]],
    selected_primary_handles: List[str],
    module_code: str,
    kind: ModuleKind,
) -> List[Packet]:
    """Build one Packet per selected window; each packet's chunks = that window's chunks (for parser)."""
    by_primary = {w["primary_handle"]: w for w in windows if w.get("primary_handle")}
    selected_set = set(selected_primary_handles)
    order = {h: i for i, h in enumerate(selected_primary_handles)}
    packets: List[Packet] = []
    for i, ph in enumerate(selected_primary_handles):
        if ph not in by_primary:
            continue
        win = by_primary[ph]
        chunks = win.get("chunks") or []
        if not chunks:
            continue
        packets.append(
            Packet(kind=kind, packet_id=f"{module_code}.pkt{i + 1:03d}", chunks=chunks)
        )
    return packets


def build_packets(
    *,
    module_code: str,
    chunks: List[Dict[str, Any]],
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
    max_chunks_per_packet: int = 5,
) -> List[Packet]:
    """
    Deterministic packetization:
    - drop chunks with out_of_scope hits and zero in_scope hits
    - route kind using physical vs governance gates
    - group into packets by kind, preserving input order
    - packets capped to max_chunks_per_packet
    """
    packets: List[Packet] = []
    cur: List[Dict[str, Any]] = []
    cur_kind: ModuleKind = "IGNORE"
    pkt_n = 0

    for ch in chunks:
        txt = ch.get("chunk_text", "") or ""
        ins = _count_hits(txt, in_scope_terms)
        outs = _count_hits(txt, out_of_scope_terms)

        # Scope gate
        if outs > 0 and ins == 0:
            continue
        if ins == 0:
            # No in-scope signal: ignore for module generation
            continue

        kind = route_kind(txt)
        if kind == "IGNORE":
            continue

        # start new packet on kind change or size limit
        if not cur:
            cur_kind = kind
        if kind != cur_kind or len(cur) >= max_chunks_per_packet:
            pkt_n += 1
            packets.append(
                Packet(kind=cur_kind, packet_id=f"{module_code}.pkt{pkt_n:03d}", chunks=cur)
            )
            cur = []
            cur_kind = kind

        cur.append(ch)

    if cur:
        pkt_n += 1
        packets.append(
            Packet(kind=cur_kind, packet_id=f"{module_code}.pkt{pkt_n:03d}", chunks=cur)
        )

    return packets


def select_by_quota(
    decisions: List[Dict[str, Any]],
    handles_in_order: List[str],
    min_packets: int = MIN_PACKETS_DEFAULT,
    max_packets: int = MAX_PACKETS_DEFAULT,
) -> Dict[str, Any]:
    """
    Deterministic selection from router decisions so we run at least min_packets when N > 0.
    1) selected = all KEEP handles (in order)
    2) if len(selected) < min_packets: add MAYBE handles in order until min_packets
    3) if still < min_packets: add top handles by order (FORCED) until min_packets
    4) Cap at max_packets
    Returns: { selected_handles: list, forced_count: int, used_maybe_fallback: bool }
    """
    by_handle = {d["handle"]: d for d in decisions if d.get("handle")}
    keep = [h for h in handles_in_order if by_handle.get(h, {}).get("decision") == "KEEP"]
    maybe = [h for h in handles_in_order if by_handle.get(h, {}).get("decision") == "MAYBE"]
    selected: List[str] = list(keep)
    used_maybe_fallback = False
    forced_count = 0
    if len(selected) < min_packets:
        for h in maybe:
            if len(selected) >= min_packets:
                break
            if h not in selected:
                selected.append(h)
                used_maybe_fallback = True
    if len(selected) < min_packets:
        for h in handles_in_order:
            if len(selected) >= min_packets:
                break
            if h not in selected:
                selected.append(h)
                forced_count += 1
    if len(selected) > max_packets:
        selected = selected[:max_packets]
    return {
        "selected_handles": selected,
        "forced_count": forced_count,
        "used_maybe_fallback": used_maybe_fallback,
    }


def build_packets_from_selected(
    chunks_with_handles: List[Dict[str, Any]],
    selected_handles: List[str],
    module_code: str,
    kind: ModuleKind,
    max_chunks_per_packet: int = 5,
) -> List[Packet]:
    """Build packets from pre-selected handles (order preserved). All packets get the same kind."""
    selected_set = set(selected_handles)
    chosen = [c for c in chunks_with_handles if (c.get("handle") or "") in selected_set]
    # Preserve order by selected_handles
    order = {h: i for i, h in enumerate(selected_handles)}
    chosen.sort(key=lambda c: order.get(c.get("handle", ""), 9999))
    packets: List[Packet] = []
    pkt_n = 0
    for i in range(0, len(chosen), max_chunks_per_packet):
        cur = chosen[i : i + max_chunks_per_packet]
        if not cur:
            continue
        pkt_n += 1
        packets.append(
            Packet(kind=kind, packet_id=f"{module_code}.pkt{pkt_n:03d}", chunks=cur)
        )
    return packets


def router_stats_from_decisions(
    decisions: List[Dict[str, Any]],
    max_ignore_examples: int = 10,
    max_maybe_examples: int = 5,
    max_keep_examples: int = 5,
) -> Dict[str, Any]:
    """Build router stats for API: total, keep, maybe, ignore, examples."""
    keep = [d for d in decisions if d.get("decision") == "KEEP"]
    maybe = [d for d in decisions if d.get("decision") == "MAYBE"]
    ignore = [d for d in decisions if d.get("decision") == "IGNORE"]
    return {
        "total": len(decisions),
        "keep": len(keep),
        "maybe": len(maybe),
        "ignore": len(ignore),
        "examples": {
            "ignore": [{"handle": d["handle"], "reason": d.get("reason", "")} for d in ignore[:max_ignore_examples]],
            "maybe": [{"handle": d["handle"], "reason": d.get("reason", "")} for d in maybe[:max_maybe_examples]],
            "keep": [{"handle": d["handle"], "reason": d.get("reason", "")} for d in keep[:max_keep_examples]],
        },
    }
