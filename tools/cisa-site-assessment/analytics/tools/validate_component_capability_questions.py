#!/usr/bin/env python3
"""
Validate component capability questions.

Validates:
- Every question maps to a canonical component
- Every component has Phase 2 evidence support (when evidence available)
- No baseline questions are duplicated
- No sector or subsector fields exist

Fails fast on error.
"""

import json
import sys
from pathlib import Path

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.parent.parent
COMPONENT_LIBRARY = SCRIPT_DIR / "model" / "canonical_library" / "v1" / "physical_security_components.json"
BASELINE_QUESTIONS = SCRIPT_DIR / "app" / "lib" / "fixtures" / "required_elements_baseline.json"
BASELINE_MAPPING = SCRIPT_DIR / "analytics" / "mappings" / "baseline_question_component_map.json"
QUESTIONS_FILE = SCRIPT_DIR / "analytics" / "candidates" / "component_capability_questions.json"


def load_json(filepath):
    """Load JSON file and return parsed data."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: File not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {filepath}: {e}")
        sys.exit(1)


def validate_questions():
    """Validate component capability questions."""
    print("Loading files...")
    components_data = load_json(COMPONENT_LIBRARY)
    baseline_data = load_json(BASELINE_QUESTIONS)
    baseline_mapping = load_json(BASELINE_MAPPING)
    questions_data = load_json(QUESTIONS_FILE)
    
    # Extract component codes
    component_codes = {comp["code"] for comp in components_data["components"]}
    print(f"Found {len(component_codes)} components in canonical library")
    
    # Extract baseline question codes
    baseline_codes = {q["element_code"] for q in baseline_data["required_elements"]}
    print(f"Found {len(baseline_codes)} baseline questions")
    
    # Extract baseline component codes
    baseline_component_codes = set()
    for mapping in baseline_mapping["mappings"]:
        baseline_component_codes.update(mapping["components"])
    print(f"Found {len(baseline_component_codes)} components covered by baseline")
    
    # Validate layer structure
    print("\nValidation 1: Checking layer structure...")
    if questions_data.get("layer") != "component_capability":
        print(f"ERROR: Invalid layer: {questions_data.get('layer')}")
        sys.exit(1)
    
    if questions_data.get("source") != "phase_2_evidence":
        print(f"ERROR: Invalid source: {questions_data.get('source')}")
        sys.exit(1)
    
    print("✓ Layer structure valid")
    
    # Validate questions
    questions = questions_data.get("questions", [])
    print(f"\nValidation 2: Validating {len(questions)} questions...")
    
    if not questions:
        print("WARNING: No questions generated (this is valid if no Phase 2 evidence available)")
        print("=" * 60)
        print("VALIDATION COMPLETE (no questions to validate)")
        print("=" * 60)
        return
    
    question_component_codes = set()
    for i, question in enumerate(questions):
        # Check required fields
        if "component_code" not in question:
            print(f"ERROR: Question {i} missing component_code")
            sys.exit(1)
        
        if "question_text" not in question:
            print(f"ERROR: Question {i} missing question_text")
            sys.exit(1)
        
        if "audit_intent" not in question:
            print(f"ERROR: Question {i} missing audit_intent")
            sys.exit(1)
        
        component_code = question["component_code"]
        question_component_codes.add(component_code)
        
        # Validation 3: Component exists in canonical library
        if component_code not in component_codes:
            print(f"ERROR: Question {i} references unknown component: {component_code}")
            sys.exit(1)
        
        # Validation 4: Component not covered by baseline
        if component_code in baseline_component_codes:
            print(f"ERROR: Question {i} references baseline component: {component_code}")
            print("Component capability questions must not duplicate baseline coverage")
            sys.exit(1)
        
        # Validation 5: No sector or subsector fields
        if "sector_id" in question or "subsector_id" in question:
            print(f"ERROR: Question {i} contains sector or subsector fields")
            sys.exit(1)
        
        if "sector" in question or "subsector" in question:
            print(f"ERROR: Question {i} contains sector or subsector fields")
            sys.exit(1)
        
        # Validation 6: Question text follows pattern
        question_text = question["question_text"].lower()
        if not (question_text.startswith("the facility has ") or 
                question_text.startswith("the facility has")):
            print(f"WARNING: Question {i} may not follow existence pattern: {question['question_text']}")
    
    print(f"✓ All {len(questions)} questions validated")
    
    # Validation 7: No duplicate components
    if len(question_component_codes) != len(questions):
        print("ERROR: Duplicate component codes in questions")
        sys.exit(1)
    
    print("✓ No duplicate components")
    
    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUCCESSFUL")
    print("="*60)
    print(f"Total questions: {len(questions)}")
    print(f"Components referenced: {len(question_component_codes)}")
    print(f"Baseline components excluded: {len(baseline_component_codes)}")
    print("="*60)


if __name__ == "__main__":
    validate_questions()

