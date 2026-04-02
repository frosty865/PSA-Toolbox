#!/usr/bin/env python3
"""
CORPUS: Heading Extractor

Extracts section headings from document pages using simple heuristics.
Used to improve semantic linkage between questions and OFCs.
"""

import re

# Pattern for ALL CAPS headings
ALLCAPS = re.compile(r"^[A-Z0-9 \-–—/]{8,}$")

# Pattern for numbered headings (e.g., "1.2.3 Title")
NUMBERED = re.compile(r"^\s*\d+(\.\d+)*\s+[A-Za-z].{3,}$")

# Pattern for colon-terminated titles
COLON = re.compile(r"^[A-Za-z].{3,}:\s*$")


def extract_heading(page_text: str) -> str:
    """
    Extract section heading from page text using heuristics.
    
    Args:
        page_text: Text content from a document page/chunk
        
    Returns:
        Heading string if found, None otherwise
    """
    if not page_text:
        return None
    
    lines = [l.strip() for l in page_text.splitlines() if l.strip()]
    
    # Scan top ~12 lines for likely headings
    for l in lines[:12]:
        # Check if line matches heading patterns
        if ALLCAPS.match(l) or NUMBERED.match(l) or COLON.match(l):
            # Reject lines that are too long (likely paragraph)
            if len(l) <= 120:
                return l
    
    return None
