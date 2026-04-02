#!/usr/bin/env python3
"""
CORPUS: Strict Question Classifier

Classifies questions for strict autoextraction (Phase 1).
Only YES/NO and PLAN CHECKLIST questions within PSA physical security scope are promotable.
"""

import re
from typing import Tuple

# Pattern for YES/NO questions
YESNO = re.compile(r"^(Does|Do|Is|Are|Has|Have|Can|Will|Did|Was|Were)\b", re.I)

# Pattern for open-ended questions (NOT promotable)
OPEN = re.compile(r"^(What|How|Why|When|Where|Who)\b", re.I)

# Pattern for checklist/plan questions
CHECKLIST = re.compile(r"\b(plan|policy|procedure|protocol|program|training|exercise|drill)\b", re.I)

# Pattern for non-physical security topics (NOT promotable)
NON_PHYSICAL = re.compile(
    r"\b(cyber|network|IT systems|data protection|privacy|HIPAA|PCI|PHI)\b", re.I
)

# Pattern for references (NOT promotable)
REFERENCE = re.compile(r"\b(http|www\.|Figure|Table|Journal|Times)\b", re.I)


def classify(text: str) -> Tuple[str, bool]:
    """
    Classify a question text.
    
    Args:
        text: Question text to classify
        
    Returns:
        Tuple of (methodology_type, is_promotable)
        - methodology_type: YESNO, CHECKLIST, OPEN_ENDED, FRAGMENT, NON_PHYSICAL, CONTEXT_ONLY, UNKNOWN
        - is_promotable: True if question is YES/NO or CHECKLIST within PSA scope
    """
    t = (text or "").strip()
    
    # Too short - fragment
    if len(t) < 18:
        return "FRAGMENT", False
    
    # Contains references - context only
    if REFERENCE.search(t):
        return "CONTEXT_ONLY", False
    
    # Non-physical security topic - not promotable
    if NON_PHYSICAL.search(t):
        return "NON_PHYSICAL", False
    
    # YES/NO question with question mark
    if YESNO.match(t) and "?" in t:
        return "YESNO", True
    
    # Checklist/plan question with question mark or colon
    if CHECKLIST.search(t) and ("?" in t or ":" in t):
        return "CHECKLIST", True
    
    # Open-ended question - not promotable
    if OPEN.match(t):
        return "OPEN_ENDED", False
    
    # Unknown type - not promotable
    return "UNKNOWN", False
