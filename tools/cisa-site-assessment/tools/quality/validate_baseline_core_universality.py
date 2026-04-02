#!/usr/bin/env python3
"""
Quality: Validate Baseline CORE Universality

Hard guardrail: Prevents non-universal questions from being in BASELINE_CORE.

HARD RULE: This script must pass before any baseline core deployment.
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

CORE_INDEX = Path(__file__).parent.parent.parent / 'psa_engine' / 'question_sets' / 'BASELINE_CORE.index.json'

# Simple guardrail list: questions known to be context-dependent should never be in CORE.
# Expand this list as you refine.
DISALLOWED_IN_CORE = {
    'CrowdManagement',
    'Credentialing',
    'PublicInformation',  # Public venues specific
    'Medical',  # Context-dependent
    'InsiderThreat',  # May be context-dependent
    'SuspiciousActivity'  # May be context-dependent
}

def main():
    """Validate baseline core universality."""
    if not CORE_INDEX.exists():
        print(f"FAIL: BASELINE_CORE.index.json not found at {CORE_INDEX}", file=sys.stderr)
        sys.exit(1)
    
    core = json.loads(CORE_INDEX.read_text(encoding='utf-8'))
    
    # Extract all question codes from core
    questions = []
    for g in core.get('groups', []):
        questions.extend(g.get('questions', []))
    
    # Check for disallowed questions
    bad = sorted(set(questions).intersection(DISALLOWED_IN_CORE))
    
    if bad:
        print("FAIL: non-universal questions present in BASELINE_CORE:", bad, file=sys.stderr)
        print("\nThese questions should be moved to MODULES (additive) instead.", file=sys.stderr)
        sys.exit(1)
    
    print("PASS: baseline core universality check")
    print(f"  Total questions in CORE: {len(questions)}")
    print(f"  Disallowed list checked: {len(DISALLOWED_IN_CORE)} questions")
    return 0

if __name__ == '__main__':
    sys.exit(main())


