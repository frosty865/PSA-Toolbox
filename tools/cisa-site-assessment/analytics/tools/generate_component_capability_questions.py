#!/usr/bin/env python3
"""
Generate component capability questions from Phase 2 evidence.

For each component observed in Phase 2 evidence, generates one
existence-based question following the component capability layer pattern.
"""

import json
import sys
from pathlib import Path
from typing import Set, Dict, List

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.parent.parent
COMPONENT_LIBRARY = SCRIPT_DIR / "model" / "canonical_library" / "v1" / "physical_security_components.json"
BASELINE_QUESTIONS = SCRIPT_DIR / "app" / "lib" / "fixtures" / "required_elements_baseline.json"
OUTPUT_FILE = SCRIPT_DIR / "analytics" / "candidates" / "component_capability_questions.json"

# Import component identification function
sys.path.insert(0, str(SCRIPT_DIR / "analytics" / "tools"))
from identify_components_from_phase2 import identify_components_from_phase2_evidence


def load_json(filepath):
    """Load JSON file and return parsed data."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_question_text(component: Dict) -> str:
    """Generate question text for a component."""
    component_name = component["name"]
    
    # Use simple pattern: "The facility has <component>."
    # For clarity, add "supporting physical security operations" if needed
    if component_name in ["Security Governance Personnel", "Security Policy Document", 
                          "Incident Reporting Process"]:
        # These are processes/documents, use full pattern
        return f"The facility has {component_name.lower()} supporting physical security operations."
    else:
        # Physical components use simple pattern
        return f"The facility has {component_name.lower()}."


def generate_audit_intent(component: Dict) -> str:
    """Generate audit intent for a component."""
    return "Verify the existence of the specified physical security component."


def exclude_baseline_components(observed_components: Set[str], 
                                baseline_mapping: Dict) -> Set[str]:
    """Exclude components that are already covered by baseline questions."""
    baseline_components = set()
    for mapping in baseline_mapping.get("mappings", []):
        baseline_components.update(mapping.get("components", []))
    
    # Return only components not in baseline
    return observed_components - baseline_components


def generate_questions(phase2_data: Dict, 
                      components_data: Dict,
                      baseline_mapping: Dict) -> List[Dict]:
    """Generate component capability questions from Phase 2 evidence."""
    # Identify components from Phase 2 evidence
    observed_components = identify_components_from_phase2_evidence(phase2_data)
    
    if not observed_components:
        print("WARNING: No components identified from Phase 2 evidence")
        return []
    
    # Exclude baseline components
    component_codes = exclude_baseline_components(observed_components, baseline_mapping)
    
    if not component_codes:
        print("WARNING: All observed components are covered by baseline questions")
        return []
    
    # Build component lookup
    component_lookup = {comp["code"]: comp for comp in components_data["components"]}
    
    # Generate questions
    questions = []
    for component_code in sorted(component_codes):
        if component_code not in component_lookup:
            print(f"WARNING: Component {component_code} not found in canonical library")
            continue
        
        component = component_lookup[component_code]
        questions.append({
            "component_code": component_code,
            "component_name": component["name"],
            "discipline": component["discipline"],
            "question_text": generate_question_text(component),
            "audit_intent": generate_audit_intent(component)
        })
    
    return questions


def main():
    """Main function to generate component capability questions."""
    print("Loading files...")
    components_data = load_json(COMPONENT_LIBRARY)
    baseline_mapping = load_json(SCRIPT_DIR / "analytics" / "mappings" / "baseline_question_component_map.json")
    
    # For now, create empty structure - will be populated when Phase 2 evidence is available
    # In production, this would read from coverage_runs table or Phase 2 files
    phase2_data = {
        "schema_version": "phase2_coverage.v1",
        "disciplines": []
    }
    
    print("Generating component capability questions...")
    questions = generate_questions(phase2_data, components_data, baseline_mapping)
    
    # Create output structure
    output = {
        "layer": "component_capability",
        "source": "phase_2_evidence",
        "baseline_version": "Baseline_Questions_v1",
        "generated_at": str(Path(__file__).stat().st_mtime),
        "description": "Component capability questions generated from Phase 2 evidence. These questions are optional, non-scoring, and evidence-gated.",
        "questions": questions
    }
    
    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\nGenerated {len(questions)} component capability questions")
    print(f"Output written to: {OUTPUT_FILE}")
    
    if questions:
        print("\nGenerated questions:")
        for q in questions:
            print(f"  - {q['component_code']}: {q['question_text']}")
    else:
        print("\nNo questions generated (no components found in Phase 2 evidence or all covered by baseline)")


if __name__ == "__main__":
    main()

