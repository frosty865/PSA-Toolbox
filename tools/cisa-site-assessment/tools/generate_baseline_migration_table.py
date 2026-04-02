#!/usr/bin/env python3
"""
Generate Baseline Question Migration Table

Maps existing baseline questions to new baseline gate model:
- CONTROL_EXISTS
- CONTROL_OPERABLE
- CONTROL_RESILIENCE

Applies deterministic rules:
- SYSTEMS → CONTROL_EXISTS
- MAINTENANCE_ASSURANCE → CONTROL_OPERABLE or CONTROL_RESILIENCE
- PLANS_PROCEDURES → RETIRE
- PERSONNEL_RESPONSIBILITY → RETIRE

Determines action based on validity violations:
- KEEP: gate valid and text already observable (rare)
- REWRITE: gate valid but text violates observability
- COLLAPSE: multiple legacy questions map to one gate
- RETIRE: forbidden dimension

OUTPUT:
- CSV migration table
- JSON migration table
- Summary counts
- Verification report
"""

import json
import os
import sys
import csv
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from collections import defaultdict

# Gate mapping rules (global)
GATE_MAPPING = {
    'SYSTEMS': 'CONTROL_EXISTS',
    'MAINTENANCE_ASSURANCE': 'CONTROL_OPERABLE',  # Default, may be CONTROL_RESILIENCE based on context
    'PLANS_PROCEDURES': 'RETIRE',
    'PERSONNEL_RESPONSIBILITY': 'RETIRE'
}

# Forbidden dimensions (always RETIRE)
FORBIDDEN_DIMENSIONS = ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']

# Import validation to check observability
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

try:
    from validate_baseline_observability import validate_question_with_rules
    validation_available = True
except ImportError:
    validation_available = False
    print("WARNING: Baseline observability validation not available")


def load_baseline_questions(baseline_path: str) -> Dict:
    """Load baseline questions registry."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_validity_violations(violations_path: str) -> Dict:
    """Load validity violations report."""
    if not os.path.exists(violations_path):
        return {}
    
    with open(violations_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # Create lookup by question_id
        violations_lookup = {}
        for v in data.get('violations', []):
            question_id = v.get('question_id', '')
            violations_lookup[question_id] = {
                'blocker_violations': v.get('blocker_violations', []),
                'review_violations': v.get('review_violations', [])
            }
        return violations_lookup


def extract_question_id_number(question_id: str) -> int:
    """Extract numeric part from BASE-### ID."""
    try:
        if question_id.startswith('BASE-'):
            return int(question_id.split('-')[1])
        return 999999  # Put non-standard IDs at end
    except (ValueError, IndexError):
        return 999999


def determine_action(question: Dict, violations: Dict, legacy_dimension: str) -> Tuple[str, Optional[str], str]:
    """
    Determine action for a question.
    Returns (action, replacement_id, notes)
    """
    question_id = question.get('element_id', '')
    question_text = question.get('question_text', '')
    
    # Check if dimension is forbidden
    if legacy_dimension in FORBIDDEN_DIMENSIONS:
        return ('RETIRE', None, f'Dimension {legacy_dimension} is forbidden (non-observable)')
    
    # Get mapped gate
    mapped_gate = GATE_MAPPING.get(legacy_dimension)
    if mapped_gate == 'RETIRE':
        return ('RETIRE', None, f'Dimension {legacy_dimension} maps to RETIRE')
    
    # Check validity violations
    blocker_violations = violations.get('blocker_violations', [])
    review_violations = violations.get('review_violations', [])
    
    # If no violations and observable, KEEP (rare)
    if not blocker_violations and not review_violations:
        # Double-check with validation if available
        if validation_available:
            is_valid, blockers, reviews = validate_question_with_rules(question)
            if is_valid and not blockers:
                return ('KEEP', question_id, 'No violations, observable question')
    
    # If has blocker violations, needs REWRITE
    if blocker_violations:
        violation_rules = [v.get('rule_id', '') for v in blocker_violations]
        return ('REWRITE', question_id, f'Has BLOCKER violations: {", ".join(violation_rules)}')
    
    # If only review violations, may need REWRITE or KEEP
    if review_violations:
        return ('REWRITE', question_id, f'Has REVIEW violations (may need rewrite)')
    
    # Default: needs REWRITE (likely has abstract language)
    return ('REWRITE', question_id, 'Likely has observability issues (abstract language)')


def process_questions(baseline: Dict, violations_lookup: Dict) -> List[Dict]:
    """
    Process all questions and generate migration table.
    """
    questions = baseline.get('required_elements', [])
    migration_rows = []
    
    # Group questions by subtype for collapsing
    subtype_groups = defaultdict(list)
    for question in questions:
        subtype_id = question.get('discipline_subtype_id', '')
        legacy_dimension = question.get('capability_dimension', '')
        mapped_gate = GATE_MAPPING.get(legacy_dimension, 'RETIRE')
        
        # Only group questions that map to same gate (for collapsing)
        if mapped_gate != 'RETIRE':
            key = (subtype_id, mapped_gate)
            subtype_groups[key].append(question)
    
    # Process each question
    processed_ids = set()
    
    for question in questions:
        question_id = question.get('element_id', '')
        legacy_dimension = question.get('capability_dimension', '')
        discipline_name = question.get('discipline_name', 'Unknown')
        subtype_name = question.get('discipline_subtype_name', 'Unknown')
        subtype_code = question.get('discipline_subtype_code', 'Unknown')
        
        # Skip if already processed (collapsed)
        if question_id in processed_ids:
            continue
        
        # Get mapped gate
        mapped_gate = GATE_MAPPING.get(legacy_dimension, 'RETIRE')
        
        # Get violations
        violations = violations_lookup.get(question_id, {})
        
        # Determine action
        action, replacement_id, notes = determine_action(question, violations, legacy_dimension)
        
        # Check for collapsing
        if mapped_gate != 'RETIRE' and action != 'RETIRE':
            subtype_id = question.get('discipline_subtype_id', '')
            key = (subtype_id, mapped_gate)
            group = subtype_groups.get(key, [])
            
            # If multiple questions map to same gate, collapse
            if len(group) > 1:
                # Find lowest ID in group
                group_ids = [extract_question_id_number(q.get('element_id', '')) for q in group]
                lowest_idx = group_ids.index(min(group_ids))
                lowest_question = group[lowest_idx]
                lowest_id = lowest_question.get('element_id', '')
                
                # If this is not the lowest ID, mark as COLLAPSE
                if question_id != lowest_id:
                    action = 'COLLAPSE'
                    replacement_id = lowest_id
                    notes = f'Collapsed into {lowest_id} (multiple questions map to {mapped_gate})'
                    processed_ids.add(question_id)
                else:
                    # This is the lowest ID, keep it but note collapsing
                    notes = f'Primary ID for collapse (maps {len(group)} questions to {mapped_gate})'
                    # Mark other questions in group as processed
                    for q in group:
                        if q.get('element_id') != question_id:
                            processed_ids.add(q.get('element_id'))
        
        migration_rows.append({
            'discipline': discipline_name,
            'subtype': subtype_name,
            'legacy_question_id': question_id,
            'legacy_dimension': legacy_dimension,
            'mapped_gate': mapped_gate if mapped_gate != 'RETIRE' else None,
            'action': action,
            'replacement_id': replacement_id,
            'notes': notes
        })
    
    return migration_rows


def generate_summary(migration_rows: List[Dict]) -> Dict:
    """Generate summary statistics."""
    total = len(migration_rows)
    kept = len([r for r in migration_rows if r['action'] == 'KEEP'])
    rewritten = len([r for r in migration_rows if r['action'] == 'REWRITE'])
    collapsed = len([r for r in migration_rows if r['action'] == 'COLLAPSE'])
    retired = len([r for r in migration_rows if r['action'] == 'RETIRE'])
    
    # Count by gate
    by_gate = defaultdict(int)
    for row in migration_rows:
        gate = row.get('mapped_gate')
        if gate:
            by_gate[gate] += 1
    
    # Count by action
    by_action = defaultdict(int)
    for row in migration_rows:
        by_action[row['action']] += 1
    
    return {
        'total_questions_processed': total,
        'kept': kept,
        'rewritten': rewritten,
        'collapsed': collapsed,
        'retired': retired,
        'by_gate': dict(by_gate),
        'by_action': dict(by_action)
    }


def verify_migration(migration_rows: List[Dict]) -> Tuple[bool, List[str]]:
    """Verify migration table."""
    errors = []
    
    # Check: Every remaining baseline question maps to exactly one gate
    remaining_questions = [r for r in migration_rows if r['action'] != 'RETIRE']
    for row in remaining_questions:
        if not row.get('mapped_gate'):
            errors.append(f"Question {row['legacy_question_id']} has no mapped_gate but action is {row['action']}")
    
    # Check: No baseline question maps to a forbidden dimension
    for row in migration_rows:
        legacy_dim = row.get('legacy_dimension', '')
        if legacy_dim in FORBIDDEN_DIMENSIONS and row['action'] != 'RETIRE':
            errors.append(f"Question {row['legacy_question_id']} has forbidden dimension {legacy_dim} but action is {row['action']}")
    
    # Check: All replacement_ids reference valid question IDs
    all_ids = {r['legacy_question_id'] for r in migration_rows}
    for row in migration_rows:
        replacement_id = row.get('replacement_id')
        if replacement_id and replacement_id not in all_ids:
            errors.append(f"Question {row['legacy_question_id']} has invalid replacement_id: {replacement_id}")
    
    is_valid = len(errors) == 0
    return is_valid, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("BASELINE QUESTION MIGRATION TABLE GENERATION")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry.json')
    violations_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_validity_violations.json')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Load data
    print("Loading baseline questions...")
    baseline = load_baseline_questions(baseline_path)
    if not baseline:
        print(f"✗ Error: Baseline questions file not found: {baseline_path}")
        sys.exit(1)
    print(f"✓ Loaded {len(baseline.get('required_elements', []))} baseline questions")
    
    print("Loading validity violations...")
    violations_lookup = load_validity_violations(violations_path)
    if violations_lookup:
        print(f"✓ Loaded violations for {len(violations_lookup)} questions")
    else:
        print("⚠ Warning: Validity violations file not found, proceeding without violation data")
    print()
    
    # Process questions
    print("Processing questions and generating migration table...")
    migration_rows = process_questions(baseline, violations_lookup)
    print(f"✓ Generated {len(migration_rows)} migration rows")
    print()
    
    # Generate summary
    summary = generate_summary(migration_rows)
    
    # Verify
    print("Verifying migration table...")
    is_valid, errors = verify_migration(migration_rows)
    if is_valid:
        print("✓ Verification passed")
    else:
        print("✗ Verification failed:")
        for error in errors:
            print(f"  {error}")
    print()
    
    # Generate outputs
    print("Generating output files...")
    
    # CSV
    csv_path = os.path.join(output_dir, 'baseline_migration_table.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'discipline', 'subtype', 'legacy_question_id', 'legacy_dimension',
            'mapped_gate', 'action', 'replacement_id', 'notes'
        ])
        writer.writeheader()
        writer.writerows(migration_rows)
    print(f"✓ CSV: {csv_path}")
    
    # JSON
    json_output = {
        'metadata': {
            'generated_at': datetime.now().isoformat(),
            'baseline_version': baseline.get('metadata', {}).get('baseline_version', 'unknown'),
            'total_questions': len(migration_rows)
        },
        'summary': summary,
        'migration_table': migration_rows,
        'verification': {
            'is_valid': is_valid,
            'errors': errors
        }
    }
    json_path = os.path.join(output_dir, 'baseline_migration_table.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_output, f, indent=2, ensure_ascii=False)
    print(f"✓ JSON: {json_path}")
    
    # Summary report
    summary_path = os.path.join(output_dir, 'baseline_migration_summary.md')
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write("# Baseline Question Migration Summary\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## Summary Counts\n\n")
        f.write(f"- **Total Questions Processed:** {summary['total_questions_processed']}\n")
        f.write(f"- **Kept:** {summary['kept']}\n")
        f.write(f"- **Rewritten:** {summary['rewritten']}\n")
        f.write(f"- **Collapsed:** {summary['collapsed']}\n")
        f.write(f"- **Retired:** {summary['retired']}\n\n")
        f.write("## By Gate\n\n")
        for gate, count in sorted(summary['by_gate'].items()):
            f.write(f"- **{gate}:** {count}\n")
        f.write("\n## By Action\n\n")
        for action, count in sorted(summary['by_action'].items()):
            f.write(f"- **{action}:** {count}\n")
        f.write("\n## Verification\n\n")
        if is_valid:
            f.write("✅ **Verification Passed**\n\n")
        else:
            f.write("❌ **Verification Failed**\n\n")
            for error in errors:
                f.write(f"- {error}\n")
    print(f"✓ Summary: {summary_path}")
    
    # Print summary
    print()
    print("=" * 80)
    print("MIGRATION SUMMARY")
    print("=" * 80)
    print(f"Total Questions Processed: {summary['total_questions_processed']}")
    print(f"Kept: {summary['kept']}")
    print(f"Rewritten: {summary['rewritten']}")
    print(f"Collapsed: {summary['collapsed']}")
    print(f"Retired: {summary['retired']}")
    print()
    print("By Gate:")
    for gate, count in sorted(summary['by_gate'].items()):
        print(f"  {gate}: {count}")
    print()
    print("By Action:")
    for action, count in sorted(summary['by_action'].items()):
        print(f"  {action}: {count}")
    print()
    print("=" * 80)
    print(f"Output files saved to: {output_dir}")
    print("=" * 80)


if __name__ == '__main__':
    main()

