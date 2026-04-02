#!/usr/bin/env python3
"""
PHASE 2: APPLY BASELINE VALIDITY RULES TO EXISTING BASELINE

Applies formal baseline validity rules (docs/baseline/BASELINE_VALIDITY_RULES.md)
to all existing baseline questions and produces a violations report.

OUTPUT:
- Machine-readable JSON violations report
- Human-readable markdown violations report
- Cross-reference with baseline_integrity_audit.md
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

# Import validation rules
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)
from validate_baseline_observability import validate_question_with_rules, ViolationSeverity

def load_baseline_questions(baseline_path: str) -> Dict:
    """Load baseline questions registry."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def apply_rules_to_questions(baseline: Dict) -> Tuple[List[Dict], Dict]:
    """
    Apply baseline validity rules to all questions.
    Returns (violations_list, summary_stats)
    """
    questions = baseline.get('required_elements', [])
    violations = []
    
    stats = {
        'total_questions': len(questions),
        'questions_with_blocker_violations': 0,
        'questions_with_review_violations': 0,
        'questions_with_no_violations': 0,
        'total_blocker_violations': 0,
        'total_review_violations': 0,
        'by_rule': {},
        'by_discipline': {},
        'by_subtype': {},
        'by_capability_dimension': {},
        'by_severity': {
            'BLOCKER': 0,
            'REVIEW': 0
        }
    }
    
    for question in questions:
        is_valid, blocker_violations, review_violations = validate_question_with_rules(question)
        
        question_id = question.get('element_id', 'unknown')
        question_code = question.get('element_code', 'unknown')
        discipline_name = question.get('discipline_name', 'Unknown')
        subtype_name = question.get('discipline_subtype_name', 'Unknown')
        subtype_code = question.get('discipline_subtype_code', 'Unknown')
        capability_dim = question.get('capability_dimension', 'Unknown')
        
        # Update stats
        if blocker_violations:
            stats['questions_with_blocker_violations'] += 1
            stats['total_blocker_violations'] += len(blocker_violations)
        if review_violations:
            stats['questions_with_review_violations'] += 1
            stats['total_review_violations'] += len(review_violations)
        if not blocker_violations and not review_violations:
            stats['questions_with_no_violations'] += 1
        
        # Track violations by rule
        all_violations = blocker_violations + review_violations
        for violation in all_violations:
            rule_id = violation['rule_id']
            stats['by_rule'][rule_id] = stats['by_rule'].get(rule_id, 0) + 1
            stats['by_severity'][violation['severity']] += 1
        
        # Track by discipline/subtype/capability
        if blocker_violations or review_violations:
            stats['by_discipline'][discipline_name] = stats['by_discipline'].get(discipline_name, 0) + 1
            stats['by_subtype'][subtype_name] = stats['by_subtype'].get(subtype_name, 0) + 1
            stats['by_capability_dimension'][capability_dim] = stats['by_capability_dimension'].get(capability_dim, 0) + 1
        
        # Add to violations list
        if blocker_violations or review_violations:
            violations.append({
                'question_id': question_id,
                'question_code': question_code,
                'title': question.get('title', ''),
                'question_text': question.get('question_text', ''),
                'discipline_id': question.get('discipline_id', ''),
                'discipline_name': discipline_name,
                'subtype_id': question.get('discipline_subtype_id', ''),
                'subtype_name': subtype_name,
                'subtype_code': subtype_code,
                'capability_dimension': capability_dim,
                'blocker_violations': blocker_violations,
                'review_violations': review_violations,
                'total_violations': len(blocker_violations) + len(review_violations)
            })
    
    return violations, stats


def generate_machine_readable_report(violations: List[Dict], stats: Dict, baseline_metadata: Dict) -> Dict:
    """Generate machine-readable JSON report."""
    return {
        'report_metadata': {
            'report_date': datetime.now().isoformat(),
            'baseline_version': baseline_metadata.get('baseline_version', 'unknown'),
            'baseline_status': baseline_metadata.get('status', 'unknown'),
            'ruleset_version': '1.0',
            'ruleset_document': 'docs/baseline/BASELINE_VALIDITY_RULES.md'
        },
        'summary': stats,
        'violations': violations
    }


def generate_human_readable_report(violations: List[Dict], stats: Dict, baseline_metadata: Dict) -> str:
    """Generate human-readable markdown report."""
    lines = []
    lines.append("# Baseline Validity Rules Violations Report")
    lines.append("")
    lines.append(f"**Report Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Baseline Version:** {baseline_metadata.get('baseline_version', 'unknown')}")
    lines.append(f"**Baseline Status:** {baseline_metadata.get('status', 'unknown')}")
    lines.append(f"**Ruleset:** docs/baseline/BASELINE_VALIDITY_RULES.md")
    lines.append("")
    
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(f"- **Total Questions:** {stats['total_questions']}")
    lines.append(f"- **Questions with BLOCKER Violations:** {stats['questions_with_blocker_violations']}")
    lines.append(f"- **Questions with REVIEW Violations:** {stats['questions_with_review_violations']}")
    lines.append(f"- **Questions with No Violations:** {stats['questions_with_no_violations']}")
    lines.append(f"- **Total BLOCKER Violations:** {stats['total_blocker_violations']}")
    lines.append(f"- **Total REVIEW Violations:** {stats['total_review_violations']}")
    lines.append("")
    
    lines.append("### Violations by Rule")
    lines.append("")
    for rule_id, count in sorted(stats['by_rule'].items(), key=lambda x: x[1], reverse=True):
        lines.append(f"- **{rule_id}:** {count}")
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
    
    # Group by severity
    blocker_questions = [v for v in violations if v['blocker_violations']]
    review_questions = [v for v in violations if v['review_violations'] and not v['blocker_violations']]
    
    if blocker_questions:
        lines.append(f"### BLOCKER Violations ({len(blocker_questions)} questions)")
        lines.append("")
        lines.append("**Action Required:** These questions must be rewritten or removed from baseline.")
        lines.append("")
        
        for v in blocker_questions[:50]:  # Show first 50
            lines.append(f"#### {v['question_code']}: {v['title']}")
            lines.append("")
            lines.append(f"- **Question:** {v['question_text']}")
            lines.append(f"- **Discipline:** {v['discipline_name']}")
            lines.append(f"- **Subtype:** {v['subtype_name']} ({v['subtype_code']})")
            lines.append(f"- **Capability Dimension:** {v['capability_dimension']}")
            lines.append(f"- **BLOCKER Violations:**")
            for violation in v['blocker_violations']:
                lines.append(f"  - **{violation['rule_id']}** ({violation['rule_name']}): {violation['description']}")
                lines.append(f"    - Matched: '{violation['matched_text']}'")
            if v['review_violations']:
                lines.append(f"- **REVIEW Violations:**")
                for violation in v['review_violations']:
                    lines.append(f"  - **{violation['rule_id']}** ({violation['rule_name']}): {violation['description']}")
            lines.append("")
        
        if len(blocker_questions) > 50:
            lines.append(f"*... and {len(blocker_questions) - 50} more questions with BLOCKER violations*")
            lines.append("")
    
    if review_questions:
        lines.append(f"### REVIEW Violations ({len(review_questions)} questions)")
        lines.append("")
        lines.append("**Action Required:** These questions require human review. Exceptions must be documented.")
        lines.append("")
        
        for v in review_questions[:20]:  # Show first 20
            lines.append(f"#### {v['question_code']}: {v['title']}")
            lines.append("")
            lines.append(f"- **Question:** {v['question_text']}")
            lines.append(f"- **REVIEW Violations:**")
            for violation in v['review_violations']:
                lines.append(f"  - **{violation['rule_id']}** ({violation['rule_name']}): {violation['description']}")
            lines.append("")
        
        if len(review_questions) > 20:
            lines.append(f"*... and {len(review_questions) - 20} more questions with REVIEW violations*")
            lines.append("")
    
    lines.append("## Cross-Reference with Integrity Audit")
    lines.append("")
    lines.append("This report applies formal baseline validity rules to existing questions.")
    lines.append("For comparison with the integrity audit findings, see:")
    lines.append("- `analytics/reports/baseline_integrity_audit.md`")
    lines.append("- `analytics/reports/BASELINE_INTEGRITY_SUMMARY.md`")
    lines.append("")
    lines.append("**Key Differences:**")
    lines.append("- Integrity audit: Flags abstract language and non-observable patterns")
    lines.append("- Validity rules: Formal rules with explicit severity (BLOCKER | REVIEW)")
    lines.append("- Both identify similar issues but with different categorization")
    lines.append("")
    
    return "\n".join(lines)


def main():
    """Main execution."""
    print("=" * 80)
    print("PHASE 2: APPLY BASELINE VALIDITY RULES")
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
    
    # Apply rules
    print("Applying baseline validity rules...")
    violations, stats = apply_rules_to_questions(baseline)
    print(f"✓ Rules applied: {len(violations)} questions with violations")
    print()
    
    # Generate reports
    print("Generating reports...")
    
    # Machine-readable JSON
    json_report = generate_machine_readable_report(
        violations,
        stats,
        baseline.get('metadata', {})
    )
    json_path = os.path.join(output_dir, 'baseline_validity_violations.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_report, f, indent=2, ensure_ascii=False)
    print(f"✓ Machine-readable report: {json_path}")
    
    # Human-readable Markdown
    md_report = generate_human_readable_report(
        violations,
        stats,
        baseline.get('metadata', {})
    )
    md_path = os.path.join(output_dir, 'baseline_validity_violations.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_report)
    print(f"✓ Human-readable report: {md_path}")
    
    # Summary
    print()
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Questions: {stats['total_questions']}")
    print(f"Questions with BLOCKER Violations: {stats['questions_with_blocker_violations']}")
    print(f"Questions with REVIEW Violations: {stats['questions_with_review_violations']}")
    print(f"Questions with No Violations: {stats['questions_with_no_violations']}")
    print()
    print("Violations by Rule:")
    for rule_id, count in sorted(stats['by_rule'].items(), key=lambda x: x[1], reverse=True):
        print(f"  {rule_id}: {count}")
    print()
    print("=" * 80)
    print(f"Reports saved to: {output_dir}")
    print("=" * 80)


if __name__ == '__main__':
    main()

