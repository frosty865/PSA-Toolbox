#!/usr/bin/env python3
"""
PHASE 3: ENFORCEMENT GUARDS
Validation script to ensure baseline publish readiness.

This script MUST:
1. Fail if any subtype lacks subtype_code
2. Fail if any baseline question references an invalid subtype
3. Fail if ANY placeholder language exists anywhere in baseline artifacts
4. Fail if any response enum outside YES/NO/N_A is detected
5. Exit non-zero on failure with explicit error messages

AUTHORITATIVE: This is the gatekeeper for baseline publish readiness.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Expected counts
EXPECTED_SUBTYPE_COUNT = 104
EXPECTED_QUESTION_COUNT = 416

# Placeholder patterns (case-insensitive)
PLACEHOLDER_PATTERNS = [
    r'placeholder',
    r'example',
    r'\btbd\b',
    r'to be determined',
    r'lorem',
    r'ipsum',
    r'\[.*?\]',  # Bracketed placeholders
    r'<.*?>',    # Angle bracket placeholders
]

# Valid response enum values
VALID_RESPONSES = {'YES', 'NO', 'N_A'}


def load_taxonomy(taxonomy_path: str) -> Dict:
    """Load taxonomy file."""
    if not os.path.exists(taxonomy_path):
        return None
    
    with open(taxonomy_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_baseline_questions(baseline_path: str) -> Dict:
    """Load baseline questions registry."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_subtype_codes(taxonomy: Dict) -> Tuple[bool, List[str]]:
    """
    Check 1: Fail if any subtype lacks subtype_code
    Returns (is_valid, error_messages)
    """
    errors = []
    
    if not taxonomy:
        errors.append("Taxonomy file not found - cannot validate subtype codes")
        return False, errors
    
    subtypes = taxonomy.get('subtypes', [])
    
    if len(subtypes) != EXPECTED_SUBTYPE_COUNT:
        errors.append(
            f"Expected {EXPECTED_SUBTYPE_COUNT} subtypes, found {len(subtypes)}"
        )
    
    missing_codes = []
    for subtype in subtypes:
        subtype_code = subtype.get('subtype_code') or subtype.get('code')
        if not subtype_code or subtype_code.strip() == '':
            missing_codes.append(
                f"Subtype '{subtype.get('name', 'unknown')}' (ID: {subtype.get('id', 'unknown')})"
            )
    
    if missing_codes:
        errors.append(
            f"VIOLATION: {len(missing_codes)} subtypes missing subtype_code:"
        )
        for code in missing_codes[:10]:  # Show first 10
            errors.append(f"  - {code}")
        if len(missing_codes) > 10:
            errors.append(f"  ... and {len(missing_codes) - 10} more")
    
    # Check for duplicates
    subtype_codes = {}
    for subtype in subtypes:
        code = subtype.get('subtype_code') or subtype.get('code')
        if code:
            if code in subtype_codes:
                errors.append(
                    f"VIOLATION: Duplicate subtype_code '{code}': "
                    f"'{subtype.get('name')}' and '{subtype_codes[code].get('name')}'"
                )
            else:
                subtype_codes[code] = subtype
    
    return len(errors) == 0, errors


def check_question_subtype_references(baseline: Dict, taxonomy: Dict) -> Tuple[bool, List[str]]:
    """
    Check 2: Fail if any baseline question references an invalid subtype
    Returns (is_valid, error_messages)
    """
    errors = []
    
    if not baseline:
        errors.append("Baseline questions file not found")
        return False, errors
    
    if not taxonomy:
        errors.append("Taxonomy file not found - cannot validate subtype references")
        return False, errors
    
    # Build subtype lookup
    subtype_lookup = {}
    for subtype in taxonomy.get('subtypes', []):
        subtype_lookup[subtype['id']] = subtype
    
    questions = baseline.get('required_elements', [])
    invalid_references = []
    
    for question in questions:
        subtype_id = question.get('discipline_subtype_id')
        if not subtype_id:
            invalid_references.append(
                f"Question {question.get('element_id', 'unknown')}: missing discipline_subtype_id"
            )
            continue
        
        if subtype_id not in subtype_lookup:
            invalid_references.append(
                f"Question {question.get('element_id', 'unknown')}: "
                f"references invalid subtype_id '{subtype_id}'"
            )
            continue
        
        subtype = subtype_lookup[subtype_id]
        subtype_code = subtype.get('subtype_code') or subtype.get('code')
        if not subtype_code:
            invalid_references.append(
                f"Question {question.get('element_id', 'unknown')}: "
                f"references subtype '{subtype.get('name')}' which lacks subtype_code"
            )
    
    if invalid_references:
        errors.append(
            f"VIOLATION: {len(invalid_references)} questions have invalid subtype references:"
        )
        for ref in invalid_references[:10]:  # Show first 10
            errors.append(f"  - {ref}")
        if len(invalid_references) > 10:
            errors.append(f"  ... and {len(invalid_references) - 10} more")
    
    return len(errors) == 0, errors


def check_placeholders(baseline: Dict) -> Tuple[bool, List[str]]:
    """
    Check 3: Fail if ANY placeholder language exists anywhere in baseline artifacts
    Returns (is_valid, error_messages)
    """
    errors = []
    
    if not baseline:
        errors.append("Baseline questions file not found")
        return False, errors
    
    questions = baseline.get('required_elements', [])
    placeholder_questions = []
    
    for question in questions:
        question_text = question.get('question_text', '')
        title = question.get('title', '')
        
        # Check question_text
        if question_text:
            for pattern in PLACEHOLDER_PATTERNS:
                if re.search(pattern, question_text, re.IGNORECASE):
                    placeholder_questions.append(
                        f"Question {question.get('element_id', 'unknown')}: "
                        f"question_text contains placeholder pattern"
                    )
                    break
        
        # Check title
        if title:
            for pattern in PLACEHOLDER_PATTERNS:
                if re.search(pattern, title, re.IGNORECASE):
                    placeholder_questions.append(
                        f"Question {question.get('element_id', 'unknown')}: "
                        f"title contains placeholder pattern"
                    )
                    break
    
    if placeholder_questions:
        errors.append(
            f"VIOLATION: {len(placeholder_questions)} questions contain placeholder language:"
        )
        for q in placeholder_questions[:10]:  # Show first 10
            errors.append(f"  - {q}")
        if len(placeholder_questions) > 10:
            errors.append(f"  ... and {len(placeholder_questions) - 10} more")
    
    return len(errors) == 0, errors


def check_response_enums(baseline: Dict) -> Tuple[bool, List[str]]:
    """
    Check 4: Fail if any response enum outside YES/NO/N_A is detected
    Returns (is_valid, error_messages)
    """
    errors = []
    
    if not baseline:
        errors.append("Baseline questions file not found")
        return False, errors
    
    # Note: The baseline questions registry may not explicitly store response enums
    # This check would need to be adapted based on the actual data structure
    # For now, we check if there's a response field and validate it
    
    questions = baseline.get('required_elements', [])
    invalid_responses = []
    
    for question in questions:
        # Check various possible response fields
        response = question.get('response') or question.get('response_type') or question.get('response_enum')
        if response:
            if isinstance(response, list):
                for resp in response:
                    if resp.upper() not in VALID_RESPONSES:
                        invalid_responses.append(
                            f"Question {question.get('element_id', 'unknown')}: "
                            f"invalid response value '{resp}' (must be YES, NO, or N_A)"
                        )
            elif isinstance(response, str):
                if response.upper() not in VALID_RESPONSES:
                    invalid_responses.append(
                        f"Question {question.get('element_id', 'unknown')}: "
                        f"invalid response value '{response}' (must be YES, NO, or N_A)"
                    )
    
    if invalid_responses:
        errors.append(
            f"VIOLATION: {len(invalid_responses)} questions have invalid response enums:"
        )
        for resp in invalid_responses[:10]:  # Show first 10
            errors.append(f"  - {resp}")
        if len(invalid_responses) > 10:
            errors.append(f"  ... and {len(invalid_responses) - 10} more")
    
    return len(errors) == 0, errors


def check_question_count(baseline: Dict) -> Tuple[bool, List[str]]:
    """Check that we have the expected number of questions."""
    errors = []
    
    if not baseline:
        return False, ["Baseline questions file not found"]
    
    questions = baseline.get('required_elements', [])
    count = len(questions)
    
    if count != EXPECTED_QUESTION_COUNT:
        errors.append(
            f"Expected {EXPECTED_QUESTION_COUNT} questions, found {count}"
        )
    
    return len(errors) == 0, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("PHASE 3: BASELINE PUBLISH READINESS VALIDATION")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry.json')
    
    taxonomy_paths = [
        os.path.join(project_root, 'taxonomy', 'discipline_subtypes.json'),
        os.path.join(project_root, 'docs', 'doctrine', 'taxonomy', 'discipline_subtypes.json'),
    ]
    
    taxonomy_path = None
    for path in taxonomy_paths:
        if os.path.exists(path):
            taxonomy_path = path
            break
    
    # Load data
    print("Loading data files...")
    taxonomy = load_taxonomy(taxonomy_path) if taxonomy_path else None
    baseline = load_baseline_questions(baseline_path)
    
    if taxonomy:
        print(f"✓ Loaded taxonomy from: {taxonomy_path}")
    else:
        print(f"⚠ Warning: Taxonomy file not found")
    
    if baseline:
        print(f"✓ Loaded baseline questions from: {baseline_path}")
    else:
        print(f"✗ Error: Baseline questions file not found: {baseline_path}")
        sys.exit(1)
    
    # Run all checks
    print("\nRunning validation checks...")
    print()
    
    all_errors = []
    
    # Check 1: Subtype codes
    print("Check 1: Validating subtype codes...")
    is_valid, errors = check_subtype_codes(taxonomy)
    if is_valid:
        print("  ✓ All subtypes have subtype_code")
    else:
        print("  ✗ FAILED")
        all_errors.extend(errors)
    
    # Check 2: Question subtype references
    print("\nCheck 2: Validating question subtype references...")
    is_valid, errors = check_question_subtype_references(baseline, taxonomy)
    if is_valid:
        print("  ✓ All questions reference valid subtypes")
    else:
        print("  ✗ FAILED")
        all_errors.extend(errors)
    
    # Check 3: Placeholders
    print("\nCheck 3: Checking for placeholder language...")
    is_valid, errors = check_placeholders(baseline)
    if is_valid:
        print("  ✓ No placeholder language found")
    else:
        print("  ✗ FAILED")
        all_errors.extend(errors)
    
    # Check 4: Response enums
    print("\nCheck 4: Validating response enums...")
    is_valid, errors = check_response_enums(baseline)
    if is_valid:
        print("  ✓ All response enums are valid (YES/NO/N_A)")
    else:
        print("  ✗ FAILED")
        all_errors.extend(errors)
    
    # Check 5: Question count
    print("\nCheck 5: Validating question count...")
    is_valid, errors = check_question_count(baseline)
    if is_valid:
        print(f"  ✓ Question count matches expected: {EXPECTED_QUESTION_COUNT}")
    else:
        print("  ✗ FAILED")
        all_errors.extend(errors)
    
    # Final result
    print("\n" + "=" * 80)
    if len(all_errors) == 0:
        print("✓ ALL VALIDATIONS PASSED")
        print("Baseline is publish-ready")
        print("=" * 80)
        sys.exit(0)
    else:
        print("✗ VALIDATION FAILED")
        print("=" * 80)
        print("\nErrors:")
        for error in all_errors:
            print(f"  {error}")
        print("\nFAILING HARD - Fix violations before proceeding")
        sys.exit(1)


if __name__ == '__main__':
    main()

