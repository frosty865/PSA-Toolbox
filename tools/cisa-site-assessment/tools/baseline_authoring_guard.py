#!/usr/bin/env python3
"""
Baseline Authoring Guard

Enforces baseline validity rules at all entry points for baseline question authoring.
Blocks submissions with BLOCKER violations and requires justification for REVIEW warnings.
"""

import json
import os
import sys
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# Import validation
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

try:
    from validate_baseline_observability import validate_question_with_rules
    validation_available = True
except ImportError:
    validation_available = False
    print("WARNING: Baseline observability validation not available")


# Forbidden dimensions (explicitly banned)
FORBIDDEN_DIMENSIONS = [
    'PLANS_PROCEDURES',
    'PERSONNEL_RESPONSIBILITY',
    'MAINTENANCE_ASSURANCE'  # As a dimension, not as a gate
]

# Allowed gates (only these are permitted)
ALLOWED_GATES = [
    'CONTROL_EXISTS',
    'CONTROL_OPERABLE',
    'CONTROL_RESILIENCE'
]

# Forbidden language patterns
FORBIDDEN_LANGUAGE = [
    'governance',
    'program',  # In abstract context
    'framework',
    'capabilities',  # In abstract context
    'processes',  # In abstract context
]


def validate_dimension_ban(question: Dict) -> Tuple[bool, List[str]]:
    """
    Validate that question does not reference forbidden dimensions.
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    capability_dimension = question.get('capability_dimension', '')
    if capability_dimension in FORBIDDEN_DIMENSIONS:
        errors.append(f"Question references forbidden dimension: {capability_dimension}")
    
    # Check question text for forbidden dimension language
    question_text = question.get('question_text', '').lower()
    for dim in FORBIDDEN_DIMENSIONS:
        dim_lower = dim.lower().replace('_', ' ')
        if dim_lower in question_text:
            errors.append(f"Question text contains forbidden dimension language: {dim}")
    
    return len(errors) == 0, errors


def validate_gate_constraints(question: Dict, mapped_gate: str = None) -> Tuple[bool, List[str]]:
    """
    Validate gate constraints:
    - Only allowed gates are permitted
    - One gate per question
    - Gate ordering constraints (if applicable)
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    # If mapped_gate is provided, validate it
    if mapped_gate:
        if mapped_gate not in ALLOWED_GATES:
            errors.append(f"Question references forbidden gate: {mapped_gate}")
    
    # Check for multiple gate references (should not happen)
    question_text = question.get('question_text', '').lower()
    gate_count = sum(1 for gate in ALLOWED_GATES if gate.lower() in question_text)
    if gate_count > 1:
        errors.append(f"Question text references multiple gates")
    
    return len(errors) == 0, errors


def validate_language_ban(question: Dict) -> Tuple[bool, List[str]]:
    """
    Validate that question does not contain forbidden language.
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    warnings = []
    
    question_text = question.get('question_text', '').lower()
    
    for term in FORBIDDEN_LANGUAGE:
        if term in question_text:
            # Check if it's in a system name context (acceptable)
            if f"{term} system" in question_text or f"{term} systems" in question_text:
                warnings.append(f"Question contains '{term}' in system name (acceptable but non-ideal)")
            else:
                errors.append(f"Question contains forbidden language: '{term}'")
    
    return len(errors) == 0, errors, warnings


def guard_baseline_question(question: Dict, mapped_gate: str = None, 
                           require_justification: bool = False,
                           override_flag: bool = False,
                           override_reason: str = None,
                           override_actor: str = None) -> Tuple[bool, Dict]:
    """
    Comprehensive guard for baseline question authoring.
    
    Args:
        question: Question dictionary to validate
        mapped_gate: Gate that question maps to (if applicable)
        require_justification: Whether to require justification for REVIEW warnings
        override_flag: Whether override is enabled
        override_reason: Reason for override (required if override_flag is True)
        override_actor: Actor performing override (required if override_flag is True)
    
    Returns:
        (is_allowed, validation_result)
        - is_allowed: True if question passes all checks
        - validation_result: Detailed validation results
    """
    validation_result = {
        'question_id': question.get('element_id', 'unknown'),
        'timestamp': datetime.now().isoformat(),
        'passed': False,
        'blocker_violations': [],
        'review_warnings': [],
        'dimension_errors': [],
        'gate_errors': [],
        'language_errors': [],
        'override': {
            'enabled': override_flag,
            'reason': override_reason,
            'actor': override_actor
        }
    }
    
    # Override check
    if override_flag:
        if not override_reason or not override_actor:
            validation_result['blocker_violations'].append({
                'rule': 'OVERRIDE-001',
                'message': 'Override flag is true but override_reason or override_actor is missing'
            })
            return False, validation_result
        # Log override but continue validation
        validation_result['override']['logged'] = True
    
    # 1. Dimension ban validation
    is_valid, errors = validate_dimension_ban(question)
    if not is_valid:
        validation_result['dimension_errors'] = errors
        if not override_flag:
            validation_result['blocker_violations'].extend([
                {'rule': 'DIMENSION-BAN', 'message': e} for e in errors
            ])
    
    # 2. Gate constraint validation
    is_valid, errors = validate_gate_constraints(question, mapped_gate)
    if not is_valid:
        validation_result['gate_errors'] = errors
        if not override_flag:
            validation_result['blocker_violations'].extend([
                {'rule': 'GATE-CONSTRAINT', 'message': e} for e in errors
            ])
    
    # 3. Language ban validation
    is_valid, errors, warnings = validate_language_ban(question)
    if not is_valid:
        validation_result['language_errors'] = errors
        if not override_flag:
            validation_result['blocker_violations'].extend([
                {'rule': 'LANGUAGE-BAN', 'message': e} for e in errors
            ])
    if warnings:
        validation_result['review_warnings'] = warnings
    
    # 4. Baseline validity rules validation
    if validation_available:
        # Set capability_dimension to None to skip dimension check (we handle it separately)
        validation_question = question.copy()
        validation_question['capability_dimension'] = None
        
        is_valid, blocker_violations, review_violations = validate_question_with_rules(validation_question)
        
        if not is_valid and not override_flag:
            validation_result['blocker_violations'].extend(blocker_violations)
        if review_violations:
            validation_result['review_warnings'].extend([
                {'rule': v.get('rule_id', 'UNKNOWN'), 'message': v.get('description', '')}
                for v in review_violations
            ])
    
    # Determine if question passes
    has_blockers = len(validation_result['blocker_violations']) > 0
    has_review_warnings = len(validation_result['review_warnings']) > 0
    
    if override_flag and has_blockers:
        # Override allows blockers, but log them
        validation_result['passed'] = True
        validation_result['override']['blockers_overridden'] = len(validation_result['blocker_violations'])
    elif has_blockers:
        validation_result['passed'] = False
    elif has_review_warnings and require_justification:
        # REVIEW warnings require justification
        validation_result['passed'] = False
        validation_result['blocker_violations'].append({
            'rule': 'JUSTIFICATION-REQUIRED',
            'message': f'REVIEW warnings require justification: {len(validation_result["review_warnings"])} warnings'
        })
    else:
        validation_result['passed'] = True
    
    return validation_result['passed'], validation_result


def validate_on_generate(question: Dict, mapped_gate: str = None) -> Tuple[bool, Dict]:
    """
    Validation hook for baseline question generation.
    
    Returns:
        (is_allowed, validation_result)
    """
    return guard_baseline_question(
        question=question,
        mapped_gate=mapped_gate,
        require_justification=False,
        override_flag=False
    )


def validate_on_submit(question: Dict, mapped_gate: str = None,
                       override_flag: bool = False,
                       override_reason: str = None,
                       override_actor: str = None) -> Tuple[bool, Dict]:
    """
    Validation hook for baseline question submission (manual or admin UI).
    
    Returns:
        (is_allowed, validation_result)
    """
    return guard_baseline_question(
        question=question,
        mapped_gate=mapped_gate,
        require_justification=True,
        override_flag=override_flag,
        override_reason=override_reason,
        override_actor=override_actor
    )


def main():
    """Test execution."""
    print("=" * 80)
    print("BASELINE AUTHORING GUARD")
    print("=" * 80)
    print()
    
    # Test with a valid question
    test_question = {
        'element_id': 'TEST-001',
        'question_text': 'Are security cameras installed?',
        'capability_dimension': None,
        'response_enum': ['YES', 'NO', 'N_A']
    }
    
    print("Testing valid question...")
    is_allowed, result = validate_on_generate(test_question, 'CONTROL_EXISTS')
    print(f"Result: {'PASSED' if is_allowed else 'FAILED'}")
    if result['blocker_violations']:
        print("Blockers:")
        for v in result['blocker_violations']:
            print(f"  - {v['message']}")
    if result['review_warnings']:
        print("Warnings:")
        for w in result['review_warnings']:
            print(f"  - {w['message']}")
    print()
    
    # Test with invalid question (forbidden dimension)
    invalid_question = {
        'element_id': 'TEST-002',
        'question_text': 'Are procedures documented?',
        'capability_dimension': 'PLANS_PROCEDURES',
        'response_enum': ['YES', 'NO', 'N_A']
    }
    
    print("Testing invalid question (forbidden dimension)...")
    is_allowed, result = validate_on_generate(invalid_question)
    print(f"Result: {'PASSED' if is_allowed else 'FAILED'}")
    if result['blocker_violations']:
        print("Blockers:")
        for v in result['blocker_violations']:
            msg = v.get('message', str(v))
            print(f"  - {msg}")
    print()


if __name__ == '__main__':
    main()

