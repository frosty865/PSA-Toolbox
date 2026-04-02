#!/usr/bin/env python3
"""
Centralized source kind detection for corpus tools.

Provides canonical classification logic for determining if a source is
MODULE_RESEARCH vs CORPUS, with fallback to legacy string matching.
"""

def is_module_research_source(
    source_kind: str | None,
    title: str | None = None,
    citation_text: str | None = None
) -> bool:
    """
    Canonical classifier for MODULE_RESEARCH sources.
    
    Prefers explicit source_kind when present, falls back to legacy
    string matching for backward compatibility.
    
    Args:
        source_kind: Explicit classification from canonical_sources.source_kind
        title: Source title (fallback detection)
        citation_text: Source citation text (fallback detection)
    
    Returns:
        True if source is MODULE_RESEARCH, False otherwise
    """
    # Prefer explicit source_kind (authoritative)
    if source_kind and source_kind.upper() == "MODULE_RESEARCH":
        return True
    
    # Fallback: legacy string matching (backward compatibility)
    t = (title or "").upper()
    c = (citation_text or "").upper()
    return ("MODULE RESEARCH" in t) or ("MODULE RESEARCH" in c)
