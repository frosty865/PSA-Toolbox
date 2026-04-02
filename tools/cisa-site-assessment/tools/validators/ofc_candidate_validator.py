#!/usr/bin/env python3
"""
OFC Candidate Validator

Validates candidate text against PSA doctrine:
- PSA scope only (reject cyber/IT/regulatory terms)
- No implementation verbs
- No priorities/cost/timeline language
- No tech/vendor/product naming patterns
- Must be "what capability exists" form
- Length 12-40 words
- Must not restate the question
- Must be subtype-bound
"""

import re
from typing import Dict, List, Tuple, Optional

# PSA scope exclusion terms (cyber/IT/regulatory)
PSA_EXCLUSION_TERMS = [
    'cyber', 'cybersecurity', 'cyber security', 'information security', 'infosec',
    'it security', 'network security', 'data security', 'digital security',
    'encryption', 'encrypted', 'firewall', 'antivirus', 'malware', 'ransomware',
    'phishing', 'vulnerability scan', 'penetration test', 'pen test',
    'iso 27001', 'nist', 'cisa', 'fisma', 'fips', 'hipaa', 'gdpr', 'pci dss',
    'soc 2', 'compliance', 'regulatory', 'regulation', 'audit', 'certification',
    'software', 'application', 'system', 'platform', 'database', 'server',
    'cloud', 'saas', 'iaas', 'paas', 'api', 'endpoint', 'authentication',
    'authorization', 'access control list', 'acl', 'rbac', 'ldap', 'sso',
    'mfa', '2fa', 'token', 'certificate', 'ssl', 'tls', 'vpn', 'ip address'
]

# Implementation verbs (how-to actions)
IMPLEMENTATION_VERBS = [
    'install', 'deploy', 'implement', 'configure', 'setup', 'set up',
    'upgrade', 'update', 'patch', 'integrate', 'connect', 'link',
    'program', 'code', 'develop', 'build', 'create', 'design',
    'customize', 'modify', 'adjust', 'tune', 'optimize', 'calibrate'
]

# Priority/cost/timeline language
PRIORITY_COST_TIMELINE = [
    'priority', 'prioritize', 'urgent', 'immediate', 'asap', 'critical',
    'high priority', 'low priority', 'cost', 'budget', 'expensive', 'cheap',
    'affordable', 'timeline', 'schedule', 'deadline', 'due date',
    'within', 'days', 'weeks', 'months', 'years', 'quarter', 'fiscal year'
]

# Tech/vendor/product patterns
TECH_VENDOR_PATTERNS = [
    r'\b[A-Z][a-z]+ (?:Inc|LLC|Corp|Corporation|Systems|Technologies|Solutions)\b',
    r'\b(?:Microsoft|Oracle|IBM|SAP|Salesforce|Amazon|Google|Apple)\b',
    r'\b(?:Windows|Linux|Unix|MacOS|iOS|Android)\b',
    r'\b(?:SQL|MySQL|PostgreSQL|MongoDB|Redis|Elasticsearch)\b',
    r'\b(?:AWS|Azure|GCP|CloudFlare)\b',
    r'\b(?:v\d+\.\d+|version \d+)\b',  # Version numbers
    r'\b(?:API|REST|SOAP|JSON|XML|HTTP|HTTPS|TCP|IP)\b'
]

# Question restatement patterns (should not appear in OFCs)
QUESTION_PATTERNS = [
    r'\bis\s+(?:a|an|the)\s+\w+\s+implemented\??',
    r'\bis\s+(?:a|an|the)\s+\w+\s+in\s+place\??',
    r'\bdoes\s+\w+\s+exist\??',
    r'\bhas\s+\w+\s+been\s+\w+\??'
]

def normalize_text(text: str) -> str:
    """Normalize text for comparison."""
    return re.sub(r'\s+', ' ', text.lower().strip())

def count_words(text: str) -> int:
    """Count words in text."""
    return len(re.findall(r'\b\w+\b', text))

def validate_psa_scope(text: str) -> Tuple[bool, List[str]]:
    """Check if text contains PSA exclusion terms."""
    text_lower = text.lower()
    violations = []
    
    for term in PSA_EXCLUSION_TERMS:
        if term in text_lower:
            violations.append(f"Contains PSA exclusion term: '{term}'")
    
    return len(violations) == 0, violations

def validate_no_implementation_verbs(text: str) -> Tuple[bool, List[str]]:
    """Check if text contains implementation verbs."""
    text_lower = text.lower()
    violations = []
    
    for verb in IMPLEMENTATION_VERBS:
        # Check for verb in various forms
        pattern = r'\b' + re.escape(verb) + r'(?:s|ed|ing)?\b'
        if re.search(pattern, text_lower):
            violations.append(f"Contains implementation verb: '{verb}'")
    
    return len(violations) == 0, violations

def validate_no_priority_cost_timeline(text: str) -> Tuple[bool, List[str]]:
    """Check if text contains priority/cost/timeline language."""
    text_lower = text.lower()
    violations = []
    
    for term in PRIORITY_COST_TIMELINE:
        if term in text_lower:
            violations.append(f"Contains priority/cost/timeline term: '{term}'")
    
    return len(violations) == 0, violations

def validate_no_tech_vendor_products(text: str) -> Tuple[bool, List[str]]:
    """Check if text contains tech/vendor/product patterns."""
    violations = []
    
    for pattern in TECH_VENDOR_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            violations.append(f"Contains tech/vendor/product pattern: '{pattern}'")
    
    return len(violations) == 0, violations

def validate_capability_form(text: str) -> Tuple[bool, List[str]]:
    """Check if text is in capability form (what exists, not how to do)."""
    text_lower = text.lower()
    
    # Good capability indicators
    capability_indicators = [
        'is implemented', 'are implemented', 'is established', 'are established',
        'is provided', 'are provided', 'is maintained', 'are maintained',
        'is in place', 'are in place', 'exists', 'are available', 'is available',
        'capability', 'capabilities', 'system', 'systems', 'process', 'processes'
    ]
    
    has_capability_indicator = any(indicator in text_lower for indicator in capability_indicators)
    
    # Should not start with imperative verbs
    imperative_start = any(text_lower.startswith(verb) for verb in IMPLEMENTATION_VERBS)
    
    violations = []
    if not has_capability_indicator:
        violations.append("Does not clearly describe a capability (missing capability indicators)")
    if imperative_start:
        violations.append("Starts with imperative verb (how-to form)")
    
    return len(violations) == 0, violations

def validate_length(text: str) -> Tuple[bool, List[str]]:
    """Check if text is 12-40 words."""
    word_count = count_words(text)
    violations = []
    
    if word_count < 12:
        violations.append(f"Too short: {word_count} words (minimum 12)")
    if word_count > 40:
        violations.append(f"Too long: {word_count} words (maximum 40)")
    
    return len(violations) == 0, violations

def validate_not_question_restatement(text: str) -> Tuple[bool, List[str]]:
    """Check if text restates a question."""
    violations = []
    
    for pattern in QUESTION_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            violations.append(f"Restates question pattern: '{pattern}'")
    
    return len(violations) == 0, violations

def validate_subtype_bound(discipline_subtype_id: Optional[str]) -> Tuple[bool, List[str]]:
    """Check if subtype is bound."""
    violations = []
    
    if not discipline_subtype_id:
        violations.append("Missing discipline_subtype_id (must be bound to exactly one subtype)")
    
    return len(violations) == 0, violations

def validate_candidate(
    candidate_text: str,
    discipline_subtype_id: Optional[str] = None
) -> Dict[str, any]:
    """
    Validate an OFC candidate.
    
    Returns:
        {
            'ok': bool,
            'reasons': List[str]  # Empty if ok=True, list of violations if ok=False
        }
    """
    all_reasons = []
    
    # Run all validators
    checks = [
        ('psa_scope', validate_psa_scope(candidate_text)),
        ('no_implementation_verbs', validate_no_implementation_verbs(candidate_text)),
        ('no_priority_cost_timeline', validate_no_priority_cost_timeline(candidate_text)),
        ('no_tech_vendor_products', validate_no_tech_vendor_products(candidate_text)),
        ('capability_form', validate_capability_form(candidate_text)),
        ('length', validate_length(candidate_text)),
        ('not_question_restatement', validate_not_question_restatement(candidate_text)),
        ('subtype_bound', validate_subtype_bound(discipline_subtype_id))
    ]
    
    for check_name, (passed, violations) in checks:
        if not passed:
            all_reasons.extend(violations)
    
    return {
        'ok': len(all_reasons) == 0,
        'reasons': all_reasons
    }

if __name__ == '__main__':
    # Test validator
    test_cases = [
        ("Access control systems are implemented at all entry points.", "9ad62209-3efe-4339-b079-e17f9810f6b0", True),
        ("Install biometric access control systems.", "9ad62209-3efe-4339-b079-e17f9810f6b0", False),  # Implementation verb
        ("Cybersecurity controls are in place.", "9ad62209-3efe-4339-b079-e17f9810f6b0", False),  # Cyber term
        ("Is access control implemented?", "9ad62209-3efe-4339-b079-e17f9810f6b0", False),  # Question form
        ("Access control.", None, False),  # Too short, no subtype
    ]
    
    for text, subtype_id, expected_ok in test_cases:
        result = validate_candidate(text, subtype_id)
        status = "✓" if result['ok'] == expected_ok else "✗"
        print(f"{status} '{text[:50]}...' -> ok={result['ok']}, reasons={result['reasons']}")
