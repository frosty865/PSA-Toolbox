#!/usr/bin/env python3
"""
Validation script for baseline question to component mapping.

Validates:
- Every baseline question appears exactly once
- All referenced components exist in canonical library
- No unmapped questions
- No unknown component codes

Fails fast on error.
"""

import json
import sys
from pathlib import Path

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.parent.parent
COMPONENT_LIBRARY = SCRIPT_DIR / "model" / "canonical_library" / "v1" / "physical_security_components.json"
BASELINE_QUESTIONS = SCRIPT_DIR / "app" / "lib" / "fixtures" / "required_elements_baseline.json"
MAPPING_FILE = SCRIPT_DIR / "analytics" / "mappings" / "baseline_question_component_map.json"


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


def validate_mapping():
    """Validate the question-component mapping."""
    print("Loading files...")
    components_data = load_json(COMPONENT_LIBRARY)
    baseline_data = load_json(BASELINE_QUESTIONS)
    mapping_data = load_json(MAPPING_FILE)
    
    # Extract component codes
    component_codes = {comp["code"] for comp in components_data["components"]}
    print(f"Found {len(component_codes)} components in canonical library")
    
    # Extract baseline question codes
    baseline_questions = baseline_data["required_elements"]
    baseline_codes = {q["element_code"] for q in baseline_questions}
    print(f"Found {len(baseline_codes)} baseline questions")
    
    # Extract mapped question codes
    mapped_codes = {m["question_code"] for m in mapping_data["mappings"]}
    print(f"Found {len(mapped_codes)} mapped questions")
    
    # Validation 1: Every baseline question appears exactly once
    print("\nValidation 1: Checking question coverage...")
    unmapped = baseline_codes - mapped_codes
    if unmapped:
        print(f"ERROR: Unmapped baseline questions: {unmapped}")
        sys.exit(1)
    
    extra_mapped = mapped_codes - baseline_codes
    if extra_mapped:
        print(f"ERROR: Mapped questions not in baseline: {extra_mapped}")
        sys.exit(1)
    
    # Check for duplicates
    question_codes_in_mapping = [m["question_code"] for m in mapping_data["mappings"]]
    if len(question_codes_in_mapping) != len(set(question_codes_in_mapping)):
        print("ERROR: Duplicate question codes in mapping")
        sys.exit(1)
    
    print("✓ All baseline questions mapped exactly once")
    
    # Validation 2: All referenced components exist
    print("\nValidation 2: Checking component references...")
    all_referenced_components = set()
    for mapping in mapping_data["mappings"]:
        all_referenced_components.update(mapping["components"])
    
    unknown_components = all_referenced_components - component_codes
    if unknown_components:
        print(f"ERROR: Unknown component codes referenced: {unknown_components}")
        sys.exit(1)
    
    print(f"✓ All {len(all_referenced_components)} referenced components exist in canonical library")
    
    # Validation 3: No empty component lists
    print("\nValidation 3: Checking component list validity...")
    for mapping in mapping_data["mappings"]:
        if not mapping["components"]:
            print(f"ERROR: Question {mapping['question_code']} has no components")
            sys.exit(1)
        if not isinstance(mapping["components"], list):
            print(f"ERROR: Question {mapping['question_code']} components is not a list")
            sys.exit(1)
    
    print("✓ All questions have at least one component")
    
    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUCCESSFUL")
    print("="*60)
    print(f"Baseline questions: {len(baseline_codes)}")
    print(f"Mapped questions: {len(mapped_codes)}")
    print(f"Components referenced: {len(all_referenced_components)}")
    print(f"Total components in library: {len(component_codes)}")
    print("="*60)


if __name__ == "__main__":
    validate_mapping()

