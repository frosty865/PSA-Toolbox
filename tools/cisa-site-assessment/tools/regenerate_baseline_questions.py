#!/usr/bin/env python3
"""
REGENERATE BASELINE QUESTIONS — AUTHORITATIVE, DETERMINISTIC, NO PLACEHOLDERS

This script REBUILDS baseline questions from canonical inputs.
This is NOT a patch. This is a clean generation.

Rules:
- 104 subtypes × 4 capability dimensions = 416 questions
- Physical Security ONLY
- Response enum: YES/NO/N_A ONLY
- No placeholders
- No sector language
- Capability-existence focused
- Deterministic IDs
"""

import json
import os
import sys
import hashlib
import uuid
from typing import Dict, List, Tuple
from datetime import datetime

# Capability dimensions (LOCKED)
CAPABILITY_DIMENSIONS = [
    "SYSTEMS",
    "PLANS_PROCEDURES",
    "MAINTENANCE_ASSURANCE",
    "PERSONNEL_RESPONSIBILITY"
]

# Expected counts
EXPECTED_SUBTYPE_COUNT = 104
EXPECTED_QUESTION_COUNT = 416  # 104 subtypes × 4 dimensions

# Question templates by dimension
QUESTION_TEMPLATES = {
    "SYSTEMS": "Does the facility have {subtype_scope} capabilities?",
    "PLANS_PROCEDURES": "Are documented procedures in place for {subtype_scope}?",
    "MAINTENANCE_ASSURANCE": "Are processes in place to ensure {subtype_scope} capabilities are maintained?",
    "PERSONNEL_RESPONSIBILITY": "Are roles and responsibilities defined for {subtype_scope}?"
}


def generate_deterministic_id(subtype_id: str, dimension: str) -> str:
    """
    Generate deterministic UUIDv5-style ID from subtype_id and dimension.
    Uses namespace UUID for baseline questions.
    """
    namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # DNS namespace
    name = f"baseline:{subtype_id}:{dimension}"
    return str(uuid.uuid5(namespace, name))


def generate_subtype_scope(subtype_name: str, discipline_name: str) -> str:
    """
    Generate scope wording for subtype.
    Rules:
    - Use subtype name directly
    - Make it natural language
    - Keep it capability-focused
    - Handle special cases for readability
    """
    # For most subtypes, use the name directly
    scope = subtype_name.lower()
    
    # Handle special cases for natural language
    # Remove redundant "Systems" if discipline already implies it
    if scope.endswith(" systems") and "system" in discipline_name.lower():
        scope = scope[:-8]  # Remove " systems"
    
    # Handle parentheticals - keep them for clarity
    # e.g., "Recording / Storage (NVR/DVR)" -> "recording / storage (NVR/DVR)"
    
    # Handle "&" -> "and" for natural language
    scope = scope.replace(" & ", " and ")
    
    return scope


def generate_question_text(subtype: Dict, dimension: str) -> str:
    """
    Generate question text for a subtype and dimension.
    """
    subtype_name = subtype['name']
    discipline_name = subtype.get('discipline_name', '')
    subtype_scope = generate_subtype_scope(subtype_name, discipline_name)
    
    template = QUESTION_TEMPLATES[dimension]
    question_text = template.format(subtype_scope=subtype_scope)
    
    # Capitalize first letter
    question_text = question_text[0].upper() + question_text[1:]
    
    return question_text


def generate_element_id(subtype_code: str, dimension: str, index: int) -> str:
    """
    Generate deterministic element_id.
    Format: BASE-{index:03d}
    """
    return f"BASE-{index:03d}"


def generate_question(subtype: Dict, dimension: str, order_index: int) -> Dict:
    """
    Generate a single baseline question.
    """
    element_id = generate_element_id(subtype['subtype_code'], dimension, order_index)
    question_text = generate_question_text(subtype, dimension)
    
    question = {
        "element_id": element_id,
        "element_code": element_id,
        "layer": "baseline",
        "title": f"{subtype['name']} - {dimension.replace('_', ' ').title()}",
        "question_text": question_text,
        "discipline_id": subtype['discipline_id'],
        "discipline_name": subtype['discipline_name'],
        "discipline_subtype_id": subtype['id'],
        "discipline_subtype_name": subtype['name'],
        "discipline_subtype_code": subtype['subtype_code'],
        "capability_dimension": dimension,
        "sector_id": None,
        "subsector_id": None,
        "order_index": order_index,
        "response_enum": ["YES", "NO", "N_A"]
    }
    
    return question


def load_taxonomy(taxonomy_path: str) -> List[Dict]:
    """Load taxonomy subtypes."""
    if not os.path.exists(taxonomy_path):
        raise FileNotFoundError(f"Taxonomy file not found: {taxonomy_path}")
    
    with open(taxonomy_path, 'r', encoding='utf-8') as f:
        taxonomy = json.load(f)
    
    subtypes = taxonomy.get('subtypes', [])
    
    if len(subtypes) != EXPECTED_SUBTYPE_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_SUBTYPE_COUNT} subtypes, found {len(subtypes)}"
        )
    
    # Validate all subtypes have required fields
    for subtype in subtypes:
        required_fields = ['id', 'name', 'subtype_code', 'discipline_id', 'discipline_name']
        for field in required_fields:
            if field not in subtype or not subtype[field]:
                raise ValueError(f"Subtype missing required field: {field}")
    
    return subtypes


def generate_all_questions(subtypes: List[Dict]) -> List[Dict]:
    """
    Generate all 416 baseline questions.
    Sorted by discipline → subtype → dimension.
    """
    questions = []
    order_index = 0
    
    # Sort subtypes by discipline_name, then subtype_name
    sorted_subtypes = sorted(
        subtypes,
        key=lambda s: (s.get('discipline_name', ''), s.get('name', ''))
    )
    
    for subtype in sorted_subtypes:
        for dimension in CAPABILITY_DIMENSIONS:
            question = generate_question(subtype, dimension, order_index)
            questions.append(question)
            order_index += 1
    
    if len(questions) != EXPECTED_QUESTION_COUNT:
        raise ValueError(
            f"Generated {len(questions)} questions, expected {EXPECTED_QUESTION_COUNT}"
        )
    
    return questions


def validate_questions(questions: List[Dict]) -> Tuple[bool, List[str]]:
    """
    Validate generated questions.
    Returns (is_valid, error_messages)
    """
    errors = []
    
    # Import observability validation (optional - don't fail if module not found)
    try:
        import sys
        import os
        script_dir = os.path.dirname(os.path.abspath(__file__))
        validate_path = os.path.join(script_dir, 'validate_baseline_observability.py')
        if os.path.exists(validate_path):
            # Add tools directory to path
            sys.path.insert(0, script_dir)
            from validate_baseline_observability import validate_question_for_baseline
            observability_validation_available = True
        else:
            observability_validation_available = False
    except ImportError:
        observability_validation_available = False
    
    # Check count
    if len(questions) != EXPECTED_QUESTION_COUNT:
        errors.append(
            f"Question count mismatch: expected {EXPECTED_QUESTION_COUNT}, found {len(questions)}"
        )
    
    # Check for placeholders
    placeholder_patterns = ['placeholder', 'example', 'tbd', 'to be determined', 'lorem']
    for question in questions:
        question_text = question.get('question_text', '').lower()
        for pattern in placeholder_patterns:
            if pattern in question_text:
                errors.append(
                    f"Question {question.get('element_id')} contains placeholder: '{pattern}'"
                )
    
    # Check required fields
    required_fields = [
        'element_id', 'question_text', 'discipline_id', 'discipline_subtype_id',
        'discipline_subtype_code', 'capability_dimension', 'response_enum'
    ]
    for question in questions:
        for field in required_fields:
            if field not in question or not question[field]:
                errors.append(
                    f"Question {question.get('element_id')} missing required field: {field}"
                )
    
    # Check response enum
    for question in questions:
        response_enum = question.get('response_enum', [])
        if set(response_enum) != {'YES', 'NO', 'N_A'}:
            errors.append(
                f"Question {question.get('element_id')} has invalid response_enum: {response_enum}"
            )
    
    # Check for duplicate element_ids
    element_ids = [q['element_id'] for q in questions]
    if len(element_ids) != len(set(element_ids)):
        duplicates = [eid for eid in element_ids if element_ids.count(eid) > 1]
        errors.append(f"Duplicate element_ids found: {set(duplicates)}")
    
    # PHASE 3: Baseline validity rules validation (if available)
    # Also integrate authoring guard for dimension/gate/language enforcement
    try:
        from baseline_authoring_guard import validate_on_generate
        authoring_guard_available = True
    except ImportError:
        authoring_guard_available = False
        print("WARNING: Baseline authoring guard not available")
    
    if observability_validation_available or authoring_guard_available:
        try:
            from validate_baseline_observability import validate_question_with_rules
            for question in questions:
                question_id = question.get('element_id', 'unknown')
                
                # Use authoring guard if available (includes dimension/gate/language checks)
                if authoring_guard_available:
                    # Determine mapped gate from capability_dimension
                    dimension = question.get('capability_dimension', '')
                    mapped_gate = None
                    if dimension == 'SYSTEMS':
                        mapped_gate = 'CONTROL_EXISTS'
                    elif dimension == 'MAINTENANCE_ASSURANCE':
                        mapped_gate = 'CONTROL_OPERABLE'  # Default, may be CONTROL_RESILIENCE
                    
                    is_allowed, guard_result = validate_on_generate(question, mapped_gate)
                    if not is_allowed:
                        for violation in guard_result.get('blocker_violations', []):
                            errors.append(
                                f"Question {question_id} BLOCKER violation ({violation.get('rule', 'UNKNOWN')}): {violation.get('message', '')}"
                            )
                        # Also check dimension/gate/language errors
                        for error in guard_result.get('dimension_errors', []):
                            errors.append(f"Question {question_id} dimension error: {error}")
                        for error in guard_result.get('gate_errors', []):
                            errors.append(f"Question {question_id} gate error: {error}")
                        for error in guard_result.get('language_errors', []):
                            errors.append(f"Question {question_id} language error: {error}")
                
                # Also run observability validation
                if observability_validation_available:
                    is_valid, blocker_violations, review_violations = validate_question_with_rules(question)
                    if not is_valid:
                        for violation in blocker_violations:
                            errors.append(
                                f"Question {question_id} BLOCKER violation ({violation['rule_id']}): {violation['description']}"
                            )
                        # Warn on REVIEW violations but don't fail
                        if review_violations:
                            for violation in review_violations:
                                print(f"WARNING: Question {question_id} REVIEW violation ({violation['rule_id']}): {violation['description']}")
        except ImportError:
            # Fallback to old validation if new function not available
            for question in questions:
                is_valid, violations = validate_question_for_baseline(question)
                if not is_valid:
                    question_id = question.get('element_id', 'unknown')
                    for violation in violations:
                        errors.append(
                            f"Question {question_id} observability violation: {violation}"
                        )
    
    return len(errors) == 0, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("REGENERATE BASELINE QUESTIONS")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    taxonomy_path = os.path.join(project_root, 'taxonomy', 'discipline_subtypes.json')
    output_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry.json')
    
    # Load taxonomy
    print(f"Loading taxonomy from: {taxonomy_path}")
    try:
        subtypes = load_taxonomy(taxonomy_path)
        print(f"✓ Loaded {len(subtypes)} subtypes")
    except Exception as e:
        print(f"✗ FAILED: {e}")
        sys.exit(1)
    
    # Generate questions
    print(f"\nGenerating {EXPECTED_QUESTION_COUNT} baseline questions...")
    try:
        questions = generate_all_questions(subtypes)
        print(f"✓ Generated {len(questions)} questions")
    except Exception as e:
        print(f"✗ FAILED: {e}")
        sys.exit(1)
    
    # Validate questions
    print("\nValidating generated questions...")
    is_valid, errors = validate_questions(questions)
    if not is_valid:
        print("✗ VALIDATION FAILED:")
        for error in errors:
            print(f"  {error}")
        print("\nFAILING HARD - Fix generation logic")
        sys.exit(1)
    print("✓ All validations passed")
    
    # Prepare output structure
    output_data = {
        "metadata": {
            "baseline_version": "Baseline_Questions_v1",
            "status": "frozen",
            "scope": "baseline",
            "change_policy": "versioned_only",
            "frozen_at": "2025-01-27T00:00:00.000Z",
            "regenerated_at": datetime.utcnow().isoformat() + "Z",
            "generation_method": "deterministic_from_taxonomy",
            "total_questions": len(questions),
            "subtype_count": len(subtypes),
            "capability_dimensions": CAPABILITY_DIMENSIONS
        },
        "required_elements": questions
    }
    
    # Create backup if file exists
    if os.path.exists(output_path):
        backup_path = output_path + '.backup'
        import shutil
        shutil.copy2(output_path, backup_path)
        print(f"\nCreated backup: {backup_path}")
    
    # Write output
    print(f"\nWriting questions to: {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    print(f"✓ Written {len(questions)} questions")
    
    # Run validation script
    print("\n" + "=" * 80)
    print("Running post-generation validation...")
    print("=" * 80)
    
    validation_script = os.path.join(script_dir, 'validate_baseline_publish_ready.py')
    if os.path.exists(validation_script):
        import subprocess
        result = subprocess.run(
            [sys.executable, validation_script],
            cwd=project_root,
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        if result.returncode != 0:
            print("\n✗ POST-GENERATION VALIDATION FAILED")
            print("FAILING HARD - Generated questions do not pass validation")
            sys.exit(1)
        
        print("\n✓ POST-GENERATION VALIDATION PASSED")
    else:
        print(f"⚠ Warning: Validation script not found at {validation_script}")
        print("  Please run validation manually")
    
    print("\n" + "=" * 80)
    print("REGENERATION COMPLETE")
    print("=" * 80)
    print(f"  Total questions: {len(questions)}")
    print(f"  Subtypes covered: {len(subtypes)}")
    print(f"  Capability dimensions: {len(CAPABILITY_DIMENSIONS)}")
    print(f"  Output file: {output_path}")
    print("=" * 80)


if __name__ == '__main__':
    main()

