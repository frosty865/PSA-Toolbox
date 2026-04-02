#!/usr/bin/env python3
"""
CORPUS: OFC Extractor V2

Extracts capability-level recommendations (OFCs) from authoritative text.
Focuses on WHAT should exist, not HOW to implement it.
"""

import re
from typing import List

# Cues that usually indicate recommendations / standards in CISA-style docs
CUE = re.compile(
    r"\b(consider|should|ensure|establish|implement|maintain|develop|coordinate|train|exercise|verify|review|update|restrict|control|monitor|document)\b",
    re.IGNORECASE
)

# Exclude obvious non-OFC content
EXCLUDE = re.compile(
    r"\b(what is|how does|figure|table|references|appendix|copyright|doi:|http|www\.)\b",
    re.IGNORECASE
)

# Too implementation-specific (we only want WHAT, not HOW)
TOO_HOW = re.compile(
    r"\b(configure|install|set up|step-by-step|vendor|model number|purchase|pricing)\b",
    re.IGNORECASE
)

# Pattern for bullet points
BULLET = re.compile(r"^\s*([•\-\u25AA\u25CF]|\d+\.)\s+")

# Pattern for sentence splitting
SENT_SPLIT = re.compile(r"(?<=[\.\?\!])\s+")


def extract_ofc_snippets(text: str, max_len: int = 360) -> List[str]:
    """
    Extract OFC candidate snippets from text.
    
    Looks for:
    - Recommendation cues (should, ensure, establish, etc.)
    - Imperative verbs
    - Best-practice phrasing
    
    Rejects:
    - Implementation details (brands, step-by-step, procurement)
    - Questions
    - References/figures
    
    Args:
        text: Text to extract OFCs from
        max_len: Maximum length of extracted snippet
        
    Returns:
        List of OFC candidate snippets
    """
    if not text:
        return []
    
    t = text.strip()
    
    # Exclude obvious non-OFC content
    if EXCLUDE.search(t):
        return []
    
    snippets = []
    
    # Prefer bullets (common in CISA-style docs)
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    bullet_lines = [l for l in lines if BULLET.match(l)]
    
    for l in bullet_lines:
        # Check for recommendation cues and reject implementation details
        if CUE.search(l) and not TOO_HOW.search(l) and len(l) >= 30:
            snippets.append(l[:max_len])
    
    # Also scan sentences (narrative recommendations)
    for sent in SENT_SPLIT.split(t):
        s = sent.strip()
        if len(s) < 40:
            continue
        
        # Check for recommendation cues
        if CUE.search(s) and not EXCLUDE.search(s) and not TOO_HOW.search(s):
            # Avoid pure questions
            if s.endswith("?"):
                continue
            snippets.append(s[:max_len])
    
    # Deduplicate by normalized text
    norm = set()
    out = []
    for s in snippets:
        k = re.sub(r"\s+", " ", s.lower()).strip()
        if k in norm:
            continue
        norm.add(k)
        out.append(s)
    
    return out
