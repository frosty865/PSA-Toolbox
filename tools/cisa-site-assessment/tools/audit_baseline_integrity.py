#!/usr/bin/env python3
"""
PHASE 1: BASELINE QUESTION INTEGRITY AUDIT

Scans all baseline questions and flags violations of baseline criteria:
- Questions must be observable through on-site inspection
- Questions must NOT be satisfiable by policies, procedures, or organizational charts
- Questions must NOT use abstract terms (capabilities, processes, program, governance)
- Questions must NOT focus on documentation, roles, or assurance instead of system behavior

OUTPUT:
- Machine-readable JSON report
- Human-readable markdown report
- Structured violation list with recommended handling
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Set
from datetime import datetime

# Violation patterns
ABSTRACT_TERMS = [
    r'\bcapabilities?\b',
    r'\bprocesses?\b',
    r'\bprogram\b',
    r'\bgovernance\b',
    r'\bframework\b',
    r'\bassurance\b',
    r'\bassured\b',
    r'\bmaintained\b',
    r'\bmaintenance\b',
]

POLICY_PROCEDURE_PATTERNS = [
    r'documented\s+(procedures?|policies?|plans?)',
    r'procedures?\s+(are\s+)?(in\s+place|documented|established)',
    r'policies?\s+(are\s+)?(in\s+place|documented|established)',
    r'plans?\s+(are\s+)?(in\s+place|documented|established)',
    r'documentation\s+(is\s+)?(in\s+place|available|present)',
]

ROLE_RESPONSIBILITY_PATTERNS = [
    r'roles?\s+and\s+responsibilities?\s+(are\s+)?(defined|established|assigned)',
    r'responsibilities?\s+(are\s+)?(defined|established|assigned)',
    r'roles?\s+(are\s+)?(defined|established|assigned)',
    r'personnel\s+(are\s+)?(assigned|designated)',
]

NON_OBSERVABLE_PATTERNS = [
    r'ensures?\s+that',
    r'processes?\s+in\s+place\s+to\s+ensure',
    r'mechanisms?\s+in\s+place',
    r'systems?\s+in\s+place',
    r'controls?\s+in\s+place',
]

FRAMEWORK_LANGUAGE = [
    r'compliance',
    r'conformance',
    r'standard',
    r'guideline',
    r'best\s+practices?',
    r'industry\s+standard',
]

def load_baseline_questions(baseline_path: str) -> Dict:
    """Load baseline questions registry."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def check_abstract_terms(question_text: str, capability_dimension: str = None) -> List[str]:
    """Check for abstract terms that violate baseline criteria."""
    violations = []
    question_lower = question_text.lower()
    
    # "capabilities" in SYSTEMS dimension is problematic - should ask about physical systems
    if capability_dimension == 'SYSTEMS':
        if re.search(r'\bcapabilities?\b', question_lower):
            violations.append("Uses abstract term 'capabilities' - should ask about physical systems/components")
    
    # Other abstract terms are always violations
    for pattern in [p for p in ABSTRACT_TERMS if p != r'\bcapabilities?\b']:
        if re.search(pattern, question_lower):
            term = re.search(pattern, question_lower).group(0)
            violations.append(f"Abstract term: '{term}'")
    
    return violations


def check_policy_procedure_focus(question_text: str) -> List[str]:
    """Check if question focuses on policies/procedures rather than observable conditions."""
    violations = []
    question_lower = question_text.lower()
    
    for pattern in POLICY_PROCEDURE_PATTERNS:
        if re.search(pattern, question_lower):
            violations.append("Focuses on documentation/policies/procedures rather than observable system state")
            break
    
    return violations


def check_role_responsibility_focus(question_text: str) -> List[str]:
    """Check if question focuses on roles/responsibilities rather than observable conditions."""
    violations = []
    question_lower = question_text.lower()
    
    for pattern in ROLE_RESPONSIBILITY_PATTERNS:
        if re.search(pattern, question_lower):
            violations.append("Focuses on roles/responsibilities rather than observable system state")
            break
    
    return violations


def check_non_observable(question_text: str) -> List[str]:
    """Check if question can be answered without observing physical conditions."""
    violations = []
    question_lower = question_text.lower()
    
    for pattern in NON_OBSERVABLE_PATTERNS:
        if re.search(pattern, question_lower):
            violations.append("Can be answered YES without observing physical condition")
            break
    
    return violations


def check_framework_language(question_text: str) -> List[str]:
    """Check for framework/governance language."""
    violations = []
    question_lower = question_text.lower()
    
    for pattern in FRAMEWORK_LANGUAGE:
        if re.search(pattern, question_lower):
            term = re.search(pattern, question_lower).group(0)
            violations.append(f"Framework/governance language: '{term}'")
    
    return violations


def assess_question(question: Dict) -> Tuple[bool, List[str], str]:
    """
    Assess a single question for baseline violations.
    Returns (has_violations, violation_reasons, recommended_handling)
    """
    question_text = question.get('question_text', '')
    title = question.get('title', '')
    capability_dimension = question.get('capability_dimension', '')
    
    all_violations = []
    
    # Check question text (pass capability_dimension for context-aware validation)
    all_violations.extend(check_abstract_terms(question_text, capability_dimension))
    all_violations.extend(check_policy_procedure_focus(question_text))
    all_violations.extend(check_role_responsibility_focus(question_text))
    all_violations.extend(check_non_observable(question_text))
    all_violations.extend(check_framework_language(question_text))
    
    # Determine recommended handling
    recommended = "rewrite"
    
    # If it's about documentation/procedures/roles, likely needs rewrite or demotion
    if any("documentation" in v.lower() or "procedures" in v.lower() or "roles" in v.lower() 
           for v in all_violations):
        if capability_dimension in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']:
            recommended = "demote"  # These dimensions are inherently non-observable
        else:
            recommended = "rewrite"
    
    # If it's about maintenance/assurance, likely needs rewrite
    if any("maintenance" in v.lower() or "assurance" in v.lower() or "ensure" in v.lower() 
           for v in all_violations):
        if capability_dimension == 'MAINTENANCE_ASSURANCE':
            recommended = "demote"  # This dimension is inherently non-observable
        else:
            recommended = "rewrite"
    
    # If multiple violations, consider collapse
    if len(all_violations) >= 3:
        recommended = "collapse"
    
    has_violations = len(all_violations) > 0
    return has_violations, all_violations, recommended


def audit_all_questions(baseline: Dict) -> Tuple[List[Dict], Dict]:
    """
    Audit all baseline questions.
    Returns (violations_list, summary_stats)
    """
    questions = baseline.get('required_elements', [])
    violations = []
    
    stats = {
        'total_questions': len(questions),
        'violations_found': 0,
        'by_discipline': {},
        'by_subtype': {},
        'by_capability_dimension': {},
        'by_recommended_handling': {
            'rewrite': 0,
            'collapse': 0,
            'demote': 0
        }
    }
    
    for question in questions:
        has_violations, violation_reasons, recommended = assess_question(question)
        
        if has_violations:
            stats['violations_found'] += 1
            
            discipline_name = question.get('discipline_name', 'Unknown')
            subtype_name = question.get('discipline_subtype_name', 'Unknown')
            capability_dim = question.get('capability_dimension', 'Unknown')
            
            # Update stats
            stats['by_discipline'][discipline_name] = stats['by_discipline'].get(discipline_name, 0) + 1
            stats['by_subtype'][subtype_name] = stats['by_subtype'].get(subtype_name, 0) + 1
            stats['by_capability_dimension'][capability_dim] = stats['by_capability_dimension'].get(capability_dim, 0) + 1
            stats['by_recommended_handling'][recommended] = stats['by_recommended_handling'][recommended] + 1
            
            violations.append({
                'question_id': question.get('element_id', 'unknown'),
                'question_code': question.get('element_code', 'unknown'),
                'title': question.get('title', ''),
                'question_text': question.get('question_text', ''),
                'discipline_id': question.get('discipline_id', ''),
                'discipline_name': discipline_name,
                'subtype_id': question.get('discipline_subtype_id', ''),
                'subtype_name': subtype_name,
                'subtype_code': question.get('discipline_subtype_code', ''),
                'capability_dimension': capability_dim,
                'violation_reasons': violation_reasons,
                'recommended_handling': recommended
            })
    
    return violations, stats


def generate_machine_readable_report(violations: List[Dict], stats: Dict, baseline_metadata: Dict) -> Dict:
    """Generate machine-readable JSON report."""
    return {
        'audit_metadata': {
            'audit_date': datetime.now().isoformat(),
            'baseline_version': baseline_metadata.get('baseline_version', 'unknown'),
            'baseline_status': baseline_metadata.get('status', 'unknown'),
            'auditor_version': '1.0.0'
        },
        'summary': stats,
        'violations': violations
    }


def generate_human_readable_report(violations: List[Dict], stats: Dict, baseline_metadata: Dict) -> str:
    """Generate human-readable markdown report."""
    lines = []
    lines.append("# Baseline Question Integrity Audit Report")
    lines.append("")
    lines.append(f"**Audit Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Baseline Version:** {baseline_metadata.get('baseline_version', 'unknown')}")
    lines.append(f"**Baseline Status:** {baseline_metadata.get('status', 'unknown')}")
    lines.append("")
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"- **Total Questions Audited:** {stats['total_questions']}")
    lines.append(f"- **Violations Found:** {stats['violations_found']}")
    lines.append(f"- **Violation Rate:** {(stats['violations_found'] / stats['total_questions'] * 100):.1f}%")
    lines.append("")
    
    lines.append("### Violations by Recommended Handling")
    lines.append("")
    for handling, count in stats['by_recommended_handling'].items():
        lines.append(f"- **{handling.upper()}:** {count}")
    lines.append("")
    
    lines.append("### Violations by Capability Dimension")
    lines.append("")
    for dim, count in sorted(stats['by_capability_dimension'].items(), key=lambda x: x[1], reverse=True):
        lines.append(f"- **{dim}:** {count}")
    lines.append("")
    
    lines.append("### Top Disciplines with Violations")
    lines.append("")
    top_disciplines = sorted(stats['by_discipline'].items(), key=lambda x: x[1], reverse=True)[:10]
    for disc, count in top_disciplines:
        lines.append(f"- **{disc}:** {count}")
    lines.append("")
    
    lines.append("## Detailed Violations")
    lines.append("")
    
    # Group by recommended handling
    by_handling = {}
    for v in violations:
        handling = v['recommended_handling']
        if handling not in by_handling:
            by_handling[handling] = []
        by_handling[handling].append(v)
    
    for handling in ['rewrite', 'collapse', 'demote']:
        if handling not in by_handling:
            continue
        
        lines.append(f"### {handling.upper()} ({len(by_handling[handling])} questions)")
        lines.append("")
        
        for v in by_handling[handling]:
            lines.append(f"#### {v['question_code']}: {v['title']}")
            lines.append("")
            lines.append(f"- **Question:** {v['question_text']}")
            lines.append(f"- **Discipline:** {v['discipline_name']}")
            lines.append(f"- **Subtype:** {v['subtype_name']} ({v['subtype_code']})")
            lines.append(f"- **Capability Dimension:** {v['capability_dimension']}")
            lines.append(f"- **Violations:**")
            for reason in v['violation_reasons']:
                lines.append(f"  - {reason}")
            lines.append(f"- **Recommended:** {v['recommended_handling']}")
            lines.append("")
    
    return "\n".join(lines)


def main():
    """Main execution."""
    print("=" * 80)
    print("PHASE 1: BASELINE QUESTION INTEGRITY AUDIT")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry.json')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Load baseline questions
    print("Loading baseline questions...")
    baseline = load_baseline_questions(baseline_path)
    
    if not baseline:
        print(f"✗ Error: Baseline questions file not found: {baseline_path}")
        sys.exit(1)
    
    print(f"✓ Loaded {len(baseline.get('required_elements', []))} baseline questions")
    print()
    
    # Run audit
    print("Running integrity audit...")
    violations, stats = audit_all_questions(baseline)
    print(f"✓ Audit complete: {len(violations)} violations found")
    print()
    
    # Generate reports
    print("Generating reports...")
    
    # Machine-readable JSON
    json_report = generate_machine_readable_report(
        violations, 
        stats, 
        baseline.get('metadata', {})
    )
    json_path = os.path.join(output_dir, 'baseline_integrity_audit.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_report, f, indent=2, ensure_ascii=False)
    print(f"✓ Machine-readable report: {json_path}")
    
    # Human-readable Markdown
    md_report = generate_human_readable_report(
        violations,
        stats,
        baseline.get('metadata', {})
    )
    md_path = os.path.join(output_dir, 'baseline_integrity_audit.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_report)
    print(f"✓ Human-readable report: {md_path}")
    
    # Summary
    print()
    print("=" * 80)
    print("AUDIT SUMMARY")
    print("=" * 80)
    print(f"Total Questions: {stats['total_questions']}")
    print(f"Violations Found: {stats['violations_found']}")
    print(f"Violation Rate: {(stats['violations_found'] / stats['total_questions'] * 100):.1f}%")
    print()
    print("By Recommended Handling:")
    for handling, count in stats['by_recommended_handling'].items():
        print(f"  {handling.upper()}: {count}")
    print()
    print("By Capability Dimension:")
    for dim, count in sorted(stats['by_capability_dimension'].items(), key=lambda x: x[1], reverse=True):
        print(f"  {dim}: {count}")
    print()
    print("=" * 80)
    print(f"Reports saved to: {output_dir}")
    print("=" * 80)


if __name__ == '__main__':
    main()

