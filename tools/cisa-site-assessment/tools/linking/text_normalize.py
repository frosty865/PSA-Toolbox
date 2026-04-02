#!/usr/bin/env python3
"""
Linking: Text Normalizer

Normalizes question and OFC text for better matching.
Removes boilerplate, normalizes verbs, and splits compound prompts.
"""

import re

# Stop phrases to remove (boilerplate)
STOP_PHRASES = [
    "the facility", "the organization", "your organization", "your facility",
    "does the facility", "does the organization", "do you have", "have you",
    "is there", "are there", "will you", "can you"
]

# Whitespace pattern
WS = re.compile(r"\s+")

# Punctuation pattern (keep hyphens and slashes)
PUNCT = re.compile(r"[^\w\s\-\/]")


def normalize(s: str) -> str:
    """
    Normalize text by removing boilerplate and normalizing whitespace.
    
    Args:
        s: Text to normalize
        
    Returns:
        Normalized text
    """
    if not s:
        return ""
    
    t = s.strip().lower()
    
    # Remove stop phrases
    for p in STOP_PHRASES:
        t = t.replace(p, " ")
    
    # Remove punctuation (keep hyphens and slashes)
    t = PUNCT.sub(" ", t)
    
    # Normalize whitespace
    t = WS.sub(" ", t).strip()
    
    return t


def split_compound(s: str) -> list:
    """
    Split compound prompts on "and/or", "and", "or", and semicolons.
    
    Args:
        s: Text to split
        
    Returns:
        List of sub-prompts (including original)
    """
    if not s:
        return []
    
    # Split on conjunctions and semicolons
    parts = re.split(r"\s+(and\/or|and|or)\s+|;", s, flags=re.I)
    
    # Keep only real text parts (not conjunctions)
    cleaned = [
        p.strip() for p in parts
        if p and not re.fullmatch(r"(and\/or|and|or)", p.strip(), flags=re.I)
    ]
    
    # Start with original
    out = [s.strip()]
    
    # Add cleaned parts if they're substantial
    for c in cleaned:
        if len(c) >= 18 and c not in out:
            out.append(c)
    
    return out
