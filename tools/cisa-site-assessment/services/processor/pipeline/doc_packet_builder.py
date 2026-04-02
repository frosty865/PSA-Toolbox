"""
Combine chunks into small document packets (2–6 chunks) by term signal.
Used for vulnerability-first pipeline: document packet -> vulnerability extraction.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List


def _count_hits(text: str, terms: List[str]) -> int:
    t = (text or "").lower()
    return sum(1 for x in terms if x and x.lower() in t)


@dataclass(frozen=True)
class DocPacket:
    packet_id: str
    chunks: List[Dict[str, Any]]  # chunk_id, chunk_text, page_range, source_file


def build_doc_packets(
    *,
    module_code: str,
    chunks: List[Dict[str, Any]],
    in_scope_terms: List[str],
    out_of_scope_terms: List[str],
    max_chunks_per_packet: int = 6,
) -> List[DocPacket]:
    """
    Deterministic packetization:
    - keep chunks with >=1 in_scope hit
    - drop chunks where out_of_scope hits >0 AND in_scope hits ==0
    - preserve order
    - packet size capped
    """
    kept: List[Dict[str, Any]] = []
    for ch in chunks:
        txt = ch.get("chunk_text", "") or ""
        ins = _count_hits(txt, in_scope_terms)
        outs = _count_hits(txt, out_of_scope_terms)
        if outs > 0 and ins == 0:
            continue
        if ins == 0:
            continue
        kept.append(ch)

    packets: List[DocPacket] = []
    n = 0
    cur: List[Dict[str, Any]] = []
    for ch in kept:
        if len(cur) >= max_chunks_per_packet:
            n += 1
            packets.append(DocPacket(packet_id=f"{module_code}.docpkt{n:03d}", chunks=cur))
            cur = []
        cur.append(ch)
    if cur:
        n += 1
        packets.append(DocPacket(packet_id=f"{module_code}.docpkt{n:03d}", chunks=cur))
    return packets
