#!/usr/bin/env python3
"""
CORPUS: Build Approved Promotions from Promotable Export

Automatically generates an approval file from EXPANSION lane candidates.
Sequential question codes are assigned.

HARD RULE: Only processes EXPANSION lane items, never baseline or context-only.
"""

import json
import re
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

IN_PATH = Path("analytics/reports/cisa_expansion_promotable.json")
OUT_PATH = Path("analytics/reports/approved_promotions_mass_gathering_expansion_v1.json")

SCOPE_TYPE = "SUBSECTOR"
SCOPE_CODE = "SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES"
EXPANSION_VERSION = "EXPANSION_QUESTIONS_V1"
CODE_PREFIX = "EXP_SUBSECTOR_MASS_GATHERING_PUBLIC_VENUES_Q"

def norm_ws(s: str) -> str:
    """Normalize whitespace."""
    return re.sub(r"\s+", " ", (s or "").strip())

def clean_question_text(text: str) -> str:
    """Clean question text for promotion."""
    # Remove leading numbers/bullets (e.g., "2.1 ", "• ")
    text = re.sub(r'^[\d\.\-\•\*\s]+', '', text)
    # Normalize whitespace
    text = norm_ws(text)
    # Ensure it ends with a question mark if it's a question
    if text and not text.endswith('?') and not text.endswith('.'):
        # If it looks like a question, add question mark
        if any(word in text.lower() for word in ['what', 'how', 'when', 'where', 'who', 'why', 'does', 'do', 'are', 'is', 'can', 'should', 'will']):
            text = text + '?'
    return text

def main():
    """Build approval file from promotable export."""
    if not IN_PATH.exists():
        raise SystemExit(f"Missing input: {IN_PATH}")

    data = json.loads(IN_PATH.read_text(encoding="utf-8"))
    # Expected fields per item:
    # candidate_id, document_id, locator, question_text, context, lane_reason, general_applicability_score

    approved = []
    i = 1
    skipped = 0
    
    for row in data:
        cid = row.get("candidate_id")
        q = row.get("question_text")
        
        if not cid or not q:
            skipped += 1
            continue

        # Clean and normalize question text
        qn = clean_question_text(q)
        
        # Skip anything that is too fragmentary
        if len(qn) < 25:
            skipped += 1
            continue

        approved.append({
            "candidate_id": cid,
            "expansion_version": EXPANSION_VERSION,
            "scope_type": SCOPE_TYPE,
            "scope_code": SCOPE_CODE,
            "question_code": f"{CODE_PREFIX}{i:03d}",
            "question_text": qn
        })
        i += 1

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(approved, indent=2, ensure_ascii=False), encoding="utf-8")
    
    result = {
        "input": str(IN_PATH),
        "output": str(OUT_PATH),
        "approved_count": len(approved),
        "skipped_count": skipped,
        "scope_code": SCOPE_CODE,
        "expansion_version": EXPANSION_VERSION
    }
    
    print(json.dumps(result, indent=2))
    return result

if __name__ == "__main__":
    main()


