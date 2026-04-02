"""
Generate module assessment items (questions + OFCs) from chunks using the module parser.

Consolidated flow: ALL chunks from ALL sources are sent in one prompt. The model
understands them, then chooses the BEST supporting chunk for each item. No per-chunk
generation; no fake data or padding.
"""

from __future__ import annotations

from typing import Any, Dict, List

from ..model.module_parser_client import extract_from_all_chunks_module_parser


def generate_module_items_from_chunks(
    *,
    model: str,
    module_code: str,
    module_title: str,
    module_kind: str,  # "OBJECT" | "PLAN"
    chunks: List[Dict[str, Any]],  # each: {chunk_id, chunk_text, page_range, source_file}
    max_chunk_chars: int = 2000,
    in_scope_terms: List[str] | None = None,
    out_of_scope_terms: List[str] | None = None,
    timeout: int = 1200,
) -> Dict[str, Any]:
    """
    Single Ollama call with all chunks. Model reads and understands all, then outputs
    items citing the best chunk for each. Items with invalid citation are dropped; 0–4 OFCs allowed per item.
    Scope terms enforce in-scope/out-of-scope filtering when provided.
    """
    result = extract_from_all_chunks_module_parser(
        model=model,
        module_code=module_code,
        module_title=module_title,
        module_kind=module_kind,
        chunks=chunks,
        max_chunk_chars=max_chunk_chars,
        in_scope_terms=in_scope_terms,
        out_of_scope_terms=out_of_scope_terms,
        timeout=timeout,
    )
    items = result.get("items", [])[:24]
    out = {
        "module_code": result.get("module_code", module_code),
        "module_title": result.get("module_title", module_title),
        "module_kind": module_kind,
        "items": items,
    }
    if not items and result.get("items_empty_reason"):
        out["items_empty_reason"] = result["items_empty_reason"]
    return out
