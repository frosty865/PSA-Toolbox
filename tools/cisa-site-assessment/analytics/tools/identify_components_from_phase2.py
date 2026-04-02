#!/usr/bin/env python3
"""
Identify physical security components from Phase 2 evidence.

Scans Phase 2 evidence for component references and builds a set of
observed components per discipline.

Rules:
- Component must appear in Phase 2 evidence OR
- Component must be directly implied by evidence
- Component must have zero Phase 2 evidence linkage to be excluded
"""

import json
import re
from pathlib import Path
from typing import Set, Dict, List
from collections import defaultdict

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.parent.parent
COMPONENT_LIBRARY = SCRIPT_DIR / "model" / "canonical_library" / "v1" / "physical_security_components.json"


def load_json(filepath):
    """Load JSON file and return parsed data."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_component_keywords(components_data):
    """Build keyword patterns for component detection."""
    keywords = {}
    
    for component in components_data["components"]:
        code = component["code"]
        name = component["name"].lower()
        description = component["description"].lower()
        
        # Extract key terms from name and description
        terms = set()
        
        # Add component name words
        terms.update(name.split())
        
        # Add description keywords
        desc_words = description.split()
        terms.update(desc_words)
        
        # Add common variations
        if "camera" in name:
            terms.update(["camera", "cameras", "cctv", "video", "surveillance"])
        if "sensor" in name:
            terms.update(["sensor", "sensors", "detection", "detector"])
        if "reader" in name:
            terms.update(["reader", "readers", "badge", "card", "credential"])
        if "lock" in name:
            terms.update(["lock", "locks", "locking"])
        if "fence" in name:
            terms.update(["fence", "fencing", "perimeter"])
        if "gate" in name:
            terms.update(["gate", "gates", "access point"])
        if "lighting" in name or "light" in name:
            terms.update(["lighting", "lights", "illumination"])
        if "radio" in name:
            terms.update(["radio", "radios", "communication"])
        if "monitoring" in name or "monitor" in name:
            terms.update(["monitoring", "monitor", "watch", "observe"])
        if "personnel" in name or "guard" in name:
            terms.update(["personnel", "guard", "guards", "security staff"])
        if "policy" in name:
            terms.update(["policy", "policies", "document"])
        if "incident" in name:
            terms.update(["incident", "reporting", "process"])
        
        keywords[code] = {
            "terms": terms,
            "name": name,
            "description": description
        }
    
    return keywords


def find_components_in_text(text: str, component_keywords: Dict) -> Set[str]:
    """Find component codes referenced in text."""
    text_lower = text.lower()
    found_components = set()
    
    for code, keyword_data in component_keywords.items():
        # Check if any keyword appears in text
        for term in keyword_data["terms"]:
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(term) + r'\b'
            if re.search(pattern, text_lower, re.IGNORECASE):
                found_components.add(code)
                break
    
    return found_components


def identify_components_from_phase2_evidence(phase2_data: Dict) -> Set[str]:
    """
    Identify components from Phase 2 evidence structure.
    
    Expected Phase 2 structure:
    {
      "schema_version": "phase2_coverage.v1",
      "disciplines": [
        {
          "discipline": "...",
          "subtypes": [
            {
              "subtype": "...",
              "evidence": [
                {
                  "page": 1,
                  "excerpt": "..."
                }
              ]
            }
          ]
        }
      ]
    }
    """
    component_keywords = build_component_keywords(load_json(COMPONENT_LIBRARY))
    observed_components = set()
    
    # Extract all evidence excerpts
    if "disciplines" in phase2_data:
        for discipline_data in phase2_data["disciplines"]:
            if "subtypes" in discipline_data:
                for subtype_data in discipline_data["subtypes"]:
                    if "evidence" in subtype_data:
                        for evidence in subtype_data["evidence"]:
                            excerpt = evidence.get("excerpt", "")
                            if excerpt:
                                found = find_components_in_text(excerpt, component_keywords)
                                observed_components.update(found)
    
    return observed_components


def identify_components_from_file(evidence_file: Path) -> Set[str]:
    """Identify components from a Phase 2 evidence file."""
    phase2_data = load_json(evidence_file)
    return identify_components_from_phase2_evidence(phase2_data)


if __name__ == "__main__":
    # Example usage - can be extended to read from database or file system
    print("Component identification from Phase 2 evidence")
    print("=" * 60)
    print("This script identifies components from Phase 2 evidence.")
    print("Use identify_components_from_phase2_evidence() function")
    print("with Phase 2 data structure to get observed components.")

