#!/usr/bin/env python3
"""
PHASE 3: BASELINE OBSERVABILITY VALIDATION RULESET

Enforcement guards to prevent non-observable questions from entering baseline.

This validation implements the formal baseline validity rules defined in:
docs/baseline/BASELINE_VALIDITY_RULES.md

RULE MAPPING:
- RULE-001 (Observable Condition): Validated by absence of RULE-101, RULE-102, RULE-103, RULE-104
- RULE-002 (Physical/Functional Condition): Validated by absence of RULE-102
- RULE-003 (Meaningful NO): Validated by absence of RULE-101
- RULE-004 (Truthful YES): Validated by absence of RULE-103
- RULE-101 (Policy/Procedure): Pattern matching
- RULE-102 (Abstract Terms): Pattern matching
- RULE-103 (Assurance Language): Pattern matching
- RULE-104 (Roles/Responsibilities): Pattern matching
- RULE-105 (Interpretation Required): Pattern matching (REVIEW severity)

INTEGRATION POINTS:
- Question seeding (regenerate_baseline_questions.py)
- LLM-generated candidate review
- Manual authoring workflow
"""

import re
from typing import Dict, List, Tuple, Optional
from enum import Enum

class ViolationSeverity(Enum):
    """Severity levels for rule violations."""
    BLOCKER = "BLOCKER"  # Must be fixed
    REVIEW = "REVIEW"    # Requires human review

class BaselineRule:
    """Represents a baseline validity rule."""
    def __init__(self, rule_id: str, name: str, severity: ViolationSeverity, patterns: List[str], description: str):
        self.rule_id = rule_id
        self.name = name
        self.severity = severity
        self.patterns = patterns
        self.description = description

# RULE-101: Policy/Procedure Satisfaction (BLOCKER)
RULE_101 = BaselineRule(
    rule_id="RULE-101",
    name="Policy/Procedure Satisfaction",
    severity=ViolationSeverity.BLOCKER,
    patterns=[
        r'documented\s+(procedures?|policies?|plans?)',
        r'procedures?\s+(are\s+)?(in\s+place|documented|established)',
        r'policies?\s+(are\s+)?(in\s+place|documented|established)',
        r'plans?\s+(are\s+)?(in\s+place|documented|established)',
        r'documentation\s+(is\s+)?(in\s+place|available|present)',
    ],
    description="Question is satisfiable by policy, procedure, or documentation alone"
)

# RULE-102: Abstract Terms (BLOCKER)
RULE_102 = BaselineRule(
    rule_id="RULE-102",
    name="Abstract Terms",
    severity=ViolationSeverity.BLOCKER,
    patterns=[
        r'\bcapabilities?\b',
        r'\bprocesses?\b',
        r'\bprogram\b',
        r'\bgovernance\b',
        r'\bframework\b',
    ],
    description="Question asks about 'capabilities', 'processes', 'programs', or 'governance'"
)

# RULE-103: Assurance Language (BLOCKER)
RULE_103 = BaselineRule(
    rule_id="RULE-103",
    name="Assurance Language",
    severity=ViolationSeverity.BLOCKER,
    patterns=[
        r'\bassurance\b',
        r'\bassured\b',
        r'\bmaintained\b',
        r'\bmaintenance\b',
        r'ensures?\s+that',
        r'processes?\s+in\s+place\s+to\s+ensure',
        r'mechanisms?\s+in\s+place',
        r'systems?\s+in\s+place',
        r'controls?\s+in\s+place',
    ],
    description="Question asks whether something is 'ensured', 'managed', or 'defined'"
)

# RULE-104: Roles and Responsibilities (BLOCKER)
RULE_104 = BaselineRule(
    rule_id="RULE-104",
    name="Roles and Responsibilities",
    severity=ViolationSeverity.BLOCKER,
    patterns=[
        r'roles?\s+and\s+responsibilities?\s+(are\s+)?(defined|established|assigned)',
        r'responsibilities?\s+(are\s+)?(defined|established|assigned)',
        r'roles?\s+(are\s+)?(defined|established|assigned)',
        r'personnel\s+(are\s+)?(assigned|designated)',
    ],
    description="Question depends on roles, responsibilities, or organizational structure"
)

# RULE-105: Interpretation Required (REVIEW)
RULE_105 = BaselineRule(
    rule_id="RULE-105",
    name="Interpretation Required",
    severity=ViolationSeverity.REVIEW,
    patterns=[
        r'\beffective\b',
        r'\badequate\b',
        r'\bappropriate\b',
        r'\bsufficient\b',
        r'\bproperly\b',
        r'\bcompliance\b',
        r'\bconformance\b',
        r'\bstandard\b',
        r'\bguideline\b',
        r'best\s+practices?',
        r'industry\s+standard',
    ],
    description="Question requires interpretation, intent, or trust in stated practice"
)

# All rules in order of severity (BLOCKER first, then REVIEW)
ALL_RULES = [RULE_101, RULE_102, RULE_103, RULE_104, RULE_105]


def check_rule_violations(question_text: str) -> List[Dict]:
    """
    Check question against all baseline validity rules.
    
    Args:
        question_text: The question text to validate
    
    Returns:
        List of violation dictionaries with rule_id, severity, matched_pattern, description
    """
    violations = []
    question_lower = question_text.lower()
    
    for rule in ALL_RULES:
        for pattern in rule.patterns:
            match = re.search(pattern, question_lower)
            if match:
                violations.append({
                    'rule_id': rule.rule_id,
                    'rule_name': rule.name,
                    'severity': rule.severity.value,
                    'description': rule.description,
                    'matched_pattern': match.group(0),
                    'matched_text': match.group(0)
                })
                break  # Only report one violation per rule
    
    return violations


def validate_question_observability(question_text: str, capability_dimension: str = None) -> Tuple[bool, List[str]]:
    """
    Validate that a question is observable and field-verifiable.
    
    Args:
        question_text: The question text to validate
        capability_dimension: Optional capability dimension (for context-aware validation)
    
    Returns:
        (is_valid, violation_messages)
    """
    violations = check_rule_violations(question_text)
    
    # Convert to simple violation messages for backward compatibility
    violation_messages = []
    for v in violations:
        violation_messages.append(f"{v['rule_id']}: {v['description']} (matched: '{v['matched_text']}')")
    
    # Context-aware validation: Some capability dimensions are inherently non-observable
    if capability_dimension in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY', 'MAINTENANCE_ASSURANCE']:
        if not violations:
            # These dimensions are inherently problematic for baseline
            violation_messages.append(
                f"Capability dimension '{capability_dimension}' is inherently non-observable. "
                "Baseline questions must be verifiable through physical inspection."
            )
    
    is_valid = len([v for v in violations if v['severity'] == 'BLOCKER']) == 0
    return is_valid, violation_messages


def validate_question_for_baseline(question: Dict) -> Tuple[bool, List[str]]:
    """
    Comprehensive validation for a baseline question.
    
    Args:
        question: Question dictionary with question_text, capability_dimension, etc.
    
    Returns:
        (is_valid, violation_messages)
    """
    question_text = question.get('question_text', '')
    capability_dimension = question.get('capability_dimension', '')
    
    if not question_text:
        return False, ["Question text is required"]
    
    # Run observability validation
    is_valid, violations = validate_question_observability(question_text, capability_dimension)
    
    return is_valid, violations


def validate_question_with_rules(question: Dict) -> Tuple[bool, List[Dict], List[Dict]]:
    """
    Comprehensive validation for a baseline question with detailed rule violations.
    
    Args:
        question: Question dictionary with question_text, capability_dimension, etc.
    
    Returns:
        (is_valid, blocker_violations, review_violations)
        - is_valid: True if no BLOCKER violations
        - blocker_violations: List of BLOCKER severity violations
        - review_violations: List of REVIEW severity violations
    """
    question_text = question.get('question_text', '')
    capability_dimension = question.get('capability_dimension', '')
    
    if not question_text:
        return False, [{'rule_id': 'REQUIRED', 'description': 'Question text is required'}], []
    
    # Check rule violations
    violations = check_rule_violations(question_text)
    
    # Separate by severity
    blocker_violations = [v for v in violations if v['severity'] == 'BLOCKER']
    review_violations = [v for v in violations if v['severity'] == 'REVIEW']
    
    # Context-aware validation: Some capability dimensions are inherently non-observable
    # NOTE: Skip this check if capability_dimension is None (indicates rewritten question validated by gate, not dimension)
    if capability_dimension and capability_dimension in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY', 'MAINTENANCE_ASSURANCE']:
        if not blocker_violations:
            blocker_violations.append({
                'rule_id': 'DIMENSION-001',
                'rule_name': 'Non-Observable Dimension',
                'severity': 'BLOCKER',
                'description': f"Capability dimension '{capability_dimension}' is inherently non-observable. Baseline questions must be verifiable through physical inspection.",
                'matched_pattern': capability_dimension,
                'matched_text': capability_dimension
            })
    
    is_valid = len(blocker_violations) == 0
    return is_valid, blocker_violations, review_violations


def guard_baseline_question(question: Dict) -> None:
    """
    Guard function that raises exception if question violates baseline criteria.
    Use this in question generation/authoring workflows.
    
    Raises:
        ValueError: If question violates baseline observability criteria (BLOCKER violations)
    """
    is_valid, blocker_violations, review_violations = validate_question_with_rules(question)
    
    if not is_valid:
        question_id = question.get('element_id', question.get('element_code', 'unknown'))
        violation_details = []
        for v in blocker_violations:
            violation_details.append(f"{v['rule_id']}: {v['description']}")
        
        violation_text = '; '.join(violation_details)
        raise ValueError(
            f"Baseline question {question_id} violates baseline validity rules (BLOCKER): {violation_text}"
        )
    
    # Warn on REVIEW violations but don't block
    if review_violations:
        question_id = question.get('element_id', question.get('element_code', 'unknown'))
        review_details = [f"{v['rule_id']}: {v['description']}" for v in review_violations]
        print(f"WARNING: Baseline question {question_id} has REVIEW violations: {'; '.join(review_details)}")


# Example usage in question generation
def example_usage():
    """Example of how to use validation in question generation."""
    
    # Example: Valid observable question
    valid_question = {
        'element_id': 'BASE-000',
        'question_text': 'Does the facility have biometric access readers installed at entry points?',
        'capability_dimension': 'SYSTEMS'
    }
    
    is_valid, violations = validate_question_for_baseline(valid_question)
    print(f"Valid question: {is_valid}, Violations: {violations}")
    
    # Example: Invalid non-observable question
    invalid_question = {
        'element_id': 'BASE-001',
        'question_text': 'Are documented procedures in place for biometric access?',
        'capability_dimension': 'PLANS_PROCEDURES'
    }
    
    is_valid, violations = validate_question_for_baseline(invalid_question)
    print(f"Invalid question: {is_valid}, Violations: {violations}")
    
    # Example: Using guard function
    try:
        guard_baseline_question(invalid_question)
    except ValueError as e:
        print(f"Guard caught violation: {e}")


if __name__ == '__main__':
    example_usage()

