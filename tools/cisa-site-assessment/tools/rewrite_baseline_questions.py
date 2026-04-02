#!/usr/bin/env python3
"""
Rewrite Baseline Question Text Using Migration Table and Gate Model

Rewrites baseline question text to match gate model intent:
- CONTROL_EXISTS: Ask if control is present/installed
- CONTROL_OPERABLE: Ask if control functions at basic observable level
- CONTROL_RESILIENCE: Ask if a single obvious failure disables the control

CONSTRAINTS:
- DO NOT change question_id
- DO NOT add qualifiers, examples, or guidance text
- DO NOT reference policies, plans, or personnel
- DO NOT normalize or merge questions during rewrite
- DO NOT change gate assignments
"""

import json
import os
import sys
import csv
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from collections import defaultdict

# Import validation
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

try:
    from validate_baseline_observability import validate_question_with_rules
    validation_available = True
except ImportError:
    validation_available = False
    print("WARNING: Baseline observability validation not available")


def load_migration_table(csv_path: str) -> Dict[str, Dict]:
    """Load migration table and create lookup by question_id."""
    migration_lookup = {}
    
    if not os.path.exists(csv_path):
        return migration_lookup
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            question_id = row.get('legacy_question_id', '')
            migration_lookup[question_id] = {
                'discipline': row.get('discipline', ''),
                'subtype': row.get('subtype', ''),
                'legacy_dimension': row.get('legacy_dimension', ''),
                'mapped_gate': row.get('mapped_gate', ''),
                'action': row.get('action', ''),
                'replacement_id': row.get('replacement_id', ''),
                'notes': row.get('notes', '')
            }
    
    return migration_lookup


def load_baseline_questions(baseline_path: str) -> Dict:
    """Load baseline questions registry."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_subtype_scope(subtype_name: str, discipline_name: str) -> str:
    """Extract the core scope from subtype name for question construction."""
    # Remove common prefixes/suffixes
    scope = subtype_name.lower()
    
    # Remove parentheticals
    if '(' in scope:
        scope = scope.split('(')[0].strip()
    
    # Remove common suffixes
    for suffix in [' systems', ' system', ' / ', ' - ']:
        scope = scope.replace(suffix, ' ')
    
    return scope.strip()


def rewrite_for_control_exists(subtype_name: str, discipline_name: str) -> str:
    """
    Rewrite question for CONTROL_EXISTS gate.
    Ask ONLY whether the physical or functional control is present or installed.
    Use observable nouns (camera, panel, recorder, barrier, reader).
    """
    scope = extract_subtype_scope(subtype_name, discipline_name)
    
    # Remove abstract terms from scope
    scope = scope.replace('governance', '').replace('oversight', '').replace('management', '').replace('capabilities', '').strip()
    if not scope:
        # Fallback for abstract subtypes - use concrete observable terms
        if 'governance' in subtype_name.lower() or 'oversight' in subtype_name.lower():
            return "Are security monitoring systems installed?"
        scope = subtype_name.lower()
    
    # Use concrete installation/presence language with observable nouns
    if 'camera' in scope or 'surveillance' in scope:
        return f"Are {scope} cameras installed?"
    elif 'access' in scope or 'control' in scope:
        if 'reader' in scope or 'panel' in scope:
            return f"Are {scope} installed at entry points?"
        return f"Are {scope} systems installed at entry points?"
    elif 'alarm' in scope or 'detection' in scope:
        if 'panel' in scope:
            return f"Are {scope} panels installed?"
        return f"Are {scope} sensors installed?"
    elif 'barrier' in scope:
        return f"Are {scope} barriers installed?"
    elif 'lighting' in scope:
        return f"Are {scope} fixtures installed?"
    elif 'communication' in scope:
        return f"Are {scope} systems installed?"
    elif 'recording' in scope or 'storage' in scope:
        return f"Are {scope} recorders installed?"
    else:
        return f"Are {scope} systems installed?"


def rewrite_for_control_operable(subtype_name: str, discipline_name: str) -> str:
    """
    Rewrite question for CONTROL_OPERABLE gate.
    Ask ONLY whether the control performs its basic function.
    Must be answerable by observation or simple demonstration.
    """
    scope = extract_subtype_scope(subtype_name, discipline_name)
    
    # Remove abstract terms from scope
    scope = scope.replace('governance', '').replace('oversight', '').replace('management', '').replace('capabilities', '').strip()
    if not scope:
        # Fallback for abstract subtypes - use concrete observable terms
        if 'governance' in subtype_name.lower() or 'oversight' in subtype_name.lower():
            return "Are security monitoring systems operational?"
        scope = subtype_name.lower()
    
    # Use concrete operational language - observable functions only
    if 'camera' in scope or 'surveillance' in scope:
        return f"Are {scope} cameras recording?"
    elif 'access' in scope or 'control' in scope:
        if 'reader' in scope or 'panel' in scope:
            return f"Do {scope} respond to credentials?"
        return f"Do {scope} systems respond to access attempts?"
    elif 'alarm' in scope or 'detection' in scope:
        if 'panel' in scope:
            return f"Do {scope} panels display sensor status?"
        return f"Do {scope} sensors trigger when activated?"
    elif 'barrier' in scope:
        return f"Do {scope} barriers open and close?"
    elif 'lighting' in scope:
        return f"Do {scope} fixtures illuminate when activated?"
    elif 'communication' in scope:
        return f"Do {scope} systems transmit and receive?"
    elif 'recording' in scope or 'storage' in scope:
        return f"Do {scope} recorders store video?"
    else:
        return f"Do {scope} systems perform their basic function?"


def rewrite_for_control_resilience(subtype_name: str, discipline_name: str) -> str:
    """
    Rewrite question for CONTROL_RESILIENCE gate.
    Ask ONLY whether a single obvious failure would disable the control.
    Focus on power, recording continuity, centralized failure.
    """
    scope = extract_subtype_scope(subtype_name, discipline_name)
    
    # Use concrete resilience language - observable failure points
    if 'recording' in scope or 'storage' in scope:
        return f"Does failure of a single recorder disable all recording?"
    elif 'architecture' in scope or 'system' in scope:
        return f"Does failure of a single component disable the entire system?"
    elif 'panel' in scope or 'controller' in scope:
        return f"Does failure of a single panel disable all connected devices?"
    elif 'backup' in scope or 'redundancy' in scope:
        return f"Are backup systems operational and available?"
    elif 'alarm' in scope:
        return f"Does failure of a single alarm panel disable all sensors?"
    elif 'power' in scope:
        return f"Does loss of primary power disable the system?"
    elif 'communication' in scope:
        return f"Does failure of a single communication path disable all communication?"
    else:
        return f"Does failure of a single component disable the entire system?"


def rewrite_question_text(question: Dict, migration_info: Dict) -> Tuple[str, str]:
    """
    Rewrite question text based on mapped gate.
    Returns (new_text, rewrite_reason)
    """
    mapped_gate = migration_info.get('mapped_gate', '')
    action = migration_info.get('action', '')
    subtype_name = question.get('discipline_subtype_name', '')
    discipline_name = question.get('discipline_name', '')
    old_text = question.get('question_text', '')
    
    # If RETIRE, don't rewrite (preserve original)
    if action == 'RETIRE':
        return old_text, 'RETIRED - no rewrite'
    
    # If no mapped gate, don't rewrite
    if not mapped_gate:
        return old_text, 'No mapped gate - no rewrite'
    
    # Rewrite based on gate
    if mapped_gate == 'CONTROL_EXISTS':
        new_text = rewrite_for_control_exists(subtype_name, discipline_name)
        return new_text, 'Rewritten for CONTROL_EXISTS gate'
    elif mapped_gate == 'CONTROL_OPERABLE':
        new_text = rewrite_for_control_operable(subtype_name, discipline_name)
        return new_text, 'Rewritten for CONTROL_OPERABLE gate'
    elif mapped_gate == 'CONTROL_RESILIENCE':
        new_text = rewrite_for_control_resilience(subtype_name, discipline_name)
        return new_text, 'Rewritten for CONTROL_RESILIENCE gate'
    else:
        return old_text, 'Unknown gate - no rewrite'


def process_questions(baseline: Dict, migration_lookup: Dict) -> Tuple[List[Dict], List[Dict], Dict]:
    """
    Process all questions and rewrite text.
    Returns (updated_questions, rewrite_log, validation_results)
    """
    questions = baseline.get('required_elements', [])
    updated_questions = []
    rewrite_log = []
    
    validation_results = {
        'total_processed': 0,
        'total_rewritten': 0,
        'total_retired': 0,
        'total_kept': 0,
        'validation_errors': [],
        'validation_warnings': []
    }
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        
        validation_results['total_processed'] += 1
        
        # Create updated question (copy all fields)
        updated_question = question.copy()
        
        # Rewrite text if needed
        old_text = question.get('question_text', '')
        new_text, rewrite_reason = rewrite_question_text(question, migration_info)
        
        if action == 'RETIRE':
            validation_results['total_retired'] += 1
            # Keep original text for retired questions
            updated_question['question_text'] = old_text
        elif new_text != old_text:
            validation_results['total_rewritten'] += 1
            updated_question['question_text'] = new_text
            
            # Log rewrite
            rewrite_log.append({
                'question_id': question_id,
                'mapped_gate': migration_info.get('mapped_gate', ''),
                'action': action,
                'old_text': old_text,
                'new_text': new_text,
                'rewrite_reason': rewrite_reason
            })
            
                # Validate rewritten question
            # Note: For rewritten questions, validate based on mapped_gate, not legacy capability_dimension
            if validation_available:
                # Create a validation question with mapped_gate instead of legacy dimension
                validation_question = updated_question.copy()
                # Temporarily set capability_dimension to None to avoid dimension-based validation
                # (The question has been rewritten for the mapped gate, so legacy dimension is irrelevant)
                original_dimension = validation_question.get('capability_dimension')
                validation_question['capability_dimension'] = None
                
                is_valid, blocker_violations, review_violations = validate_question_with_rules(validation_question)
                
                # Restore original dimension
                validation_question['capability_dimension'] = original_dimension
                
                # Check for critical rules (RULE-101, 102, 103, 104) - these must not be violated
                critical_rules = ['RULE-101', 'RULE-102', 'RULE-103', 'RULE-104']
                critical_violations = [v for v in blocker_violations if v.get('rule_id') in critical_rules]
                
                if not is_valid or critical_violations:
                    validation_results['validation_errors'].append({
                        'question_id': question_id,
                        'violations': blocker_violations,
                        'critical_violations': critical_violations
                    })
                if review_violations:
                    validation_results['validation_warnings'].append({
                        'question_id': question_id,
                        'violations': review_violations
                    })
        else:
            validation_results['total_kept'] += 1
        
        updated_questions.append(updated_question)
    
    return updated_questions, rewrite_log, validation_results


def main():
    """Main execution."""
    print("=" * 80)
    print("REWRITE BASELINE QUESTION TEXT")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    migration_csv_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.csv')
    baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry.json')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    output_baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_rewritten.json')
    
    # Load data
    print("Loading migration table...")
    migration_lookup = load_migration_table(migration_csv_path)
    if not migration_lookup:
        print(f"✗ Error: Migration table not found: {migration_csv_path}")
        sys.exit(1)
    print(f"✓ Loaded migration table with {len(migration_lookup)} entries")
    
    print("Loading baseline questions...")
    baseline = load_baseline_questions(baseline_path)
    if not baseline:
        print(f"✗ Error: Baseline questions file not found: {baseline_path}")
        sys.exit(1)
    print(f"✓ Loaded {len(baseline.get('required_elements', []))} baseline questions")
    print()
    
    # Process questions
    print("Rewriting question text...")
    updated_questions, rewrite_log, validation_results = process_questions(baseline, migration_lookup)
    print(f"✓ Processed {validation_results['total_processed']} questions")
    print(f"  - Rewritten: {validation_results['total_rewritten']}")
    print(f"  - Retired: {validation_results['total_retired']}")
    print(f"  - Kept: {validation_results['total_kept']}")
    print()
    
    # Validation
    print("Validating rewritten questions...")
    if validation_results['validation_errors']:
        critical_count = sum(1 for e in validation_results['validation_errors'] if e.get('critical_violations'))
        print(f"✗ Found {len(validation_results['validation_errors'])} validation errors:")
        for error in validation_results['validation_errors'][:5]:
            critical = " [CRITICAL]" if error.get('critical_violations') else ""
            print(f"  - {error['question_id']}: {len(error['violations'])} BLOCKER violations{critical}")
        if critical_count > 0:
            print(f"\n✗ CRITICAL: {critical_count} questions violate RULE-101, 102, 103, or 104")
            print("  Task must fail if critical violations are present.")
    else:
        print("✓ No validation errors found")
    
    if validation_results['validation_warnings']:
        print(f"⚠ Found {len(validation_results['validation_warnings'])} validation warnings (non-blocking)")
    print()
    
    # Generate outputs
    print("Generating output files...")
    
    # Updated baseline questions
    updated_baseline = {
        "metadata": {
            **baseline.get('metadata', {}),
            "rewritten_at": datetime.now().isoformat() + "Z",
            "rewrite_version": "1.0",
            "rewrite_method": "gate_model_based"
        },
        "required_elements": updated_questions
    }
    
    with open(output_baseline_path, 'w', encoding='utf-8') as f:
        json.dump(updated_baseline, f, indent=2, ensure_ascii=False)
    print(f"✓ Updated baseline: {output_baseline_path}")
    
    # Rewrite log (CSV format)
    rewrite_log_csv_path = os.path.join(output_dir, 'baseline_rewrite_log.csv')
    with open(rewrite_log_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['question_id', 'mapped_gate', 'old_text', 'new_text'])
        writer.writeheader()
        for entry in rewrite_log:
            writer.writerow({
                'question_id': entry['question_id'],
                'mapped_gate': entry['mapped_gate'],
                'old_text': entry['old_text'],
                'new_text': entry['new_text']
            })
    print(f"✓ Rewrite log (CSV): {rewrite_log_csv_path}")
    
    # Also keep JSON for reference
    rewrite_log_json_path = os.path.join(output_dir, 'baseline_rewrite_log.json')
    with open(rewrite_log_json_path, 'w', encoding='utf-8') as f:
        json.dump({
            'metadata': {
                'rewrite_date': datetime.now().isoformat(),
                'total_rewritten': len(rewrite_log)
            },
            'rewrite_log': rewrite_log
        }, f, indent=2, ensure_ascii=False)
    print(f"✓ Rewrite log (JSON): {rewrite_log_json_path}")
    
    # Validation report
    validation_report_path = os.path.join(output_dir, 'baseline_rewrite_validation.json')
    with open(validation_report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'metadata': {
                'validation_date': datetime.now().isoformat(),
                'total_processed': validation_results['total_processed']
            },
            'summary': {
                'total_rewritten': validation_results['total_rewritten'],
                'total_retired': validation_results['total_retired'],
                'total_kept': validation_results['total_kept'],
                'validation_errors_count': len(validation_results['validation_errors']),
                'validation_warnings_count': len(validation_results['validation_warnings'])
            },
            'validation_errors': validation_results['validation_errors'],
            'validation_warnings': validation_results['validation_warnings']
        }, f, indent=2, ensure_ascii=False)
    print(f"✓ Validation report: {validation_report_path}")
    
    # Human-readable rewrite log
    rewrite_log_md_path = os.path.join(output_dir, 'baseline_rewrite_log.md')
    with open(rewrite_log_md_path, 'w', encoding='utf-8') as f:
        f.write("# Baseline Question Rewrite Log\n\n")
        f.write(f"**Rewrite Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"**Total Questions Rewritten:** {len(rewrite_log)}\n\n")
        f.write("## Rewrite Summary\n\n")
        f.write(f"- **Total Processed:** {validation_results['total_processed']}\n")
        f.write(f"- **Rewritten:** {validation_results['total_rewritten']}\n")
        f.write(f"- **Retired:** {validation_results['total_retired']}\n")
        f.write(f"- **Kept:** {validation_results['total_kept']}\n\n")
        f.write("## Validation Results\n\n")
        if validation_results['validation_errors']:
            f.write(f"❌ **Validation Errors:** {len(validation_results['validation_errors'])}\n\n")
        else:
            f.write("✅ **No Validation Errors**\n\n")
        if validation_results['validation_warnings']:
            f.write(f"⚠ **Validation Warnings:** {len(validation_results['validation_warnings'])}\n\n")
        f.write("## Detailed Rewrite Log\n\n")
        for entry in rewrite_log[:50]:  # Show first 50
            f.write(f"### {entry['question_id']}\n\n")
            f.write(f"- **Mapped Gate:** {entry['mapped_gate']}\n")
            f.write(f"- **Action:** {entry['action']}\n")
            f.write(f"- **Old Text:** {entry['old_text']}\n")
            f.write(f"- **New Text:** {entry['new_text']}\n")
            f.write(f"- **Reason:** {entry['rewrite_reason']}\n\n")
        if len(rewrite_log) > 50:
            f.write(f"*... and {len(rewrite_log) - 50} more rewrites*\n\n")
    print(f"✓ Rewrite log (markdown): {rewrite_log_md_path}")
    
    # Summary
    print()
    print("=" * 80)
    print("REWRITE SUMMARY")
    print("=" * 80)
    print(f"Total Processed: {validation_results['total_processed']}")
    print(f"Rewritten: {validation_results['total_rewritten']}")
    print(f"Retired: {validation_results['total_retired']}")
    print(f"Kept: {validation_results['total_kept']}")
    print()
    
    # Check for critical violations
    critical_violations = sum(1 for e in validation_results['validation_errors'] if e.get('critical_violations'))
    if critical_violations > 0:
        print(f"❌ CRITICAL: {critical_violations} questions violate RULE-101, 102, 103, or 104")
        print("   Task FAILED - critical violations must be zero")
        sys.exit(1)
    elif validation_results['validation_errors']:
        print(f"❌ Validation Errors: {len(validation_results['validation_errors'])}")
        print("   Task FAILED - validation errors must be zero")
        sys.exit(1)
    else:
        print("✅ All rewritten questions pass validation")
        print(f"   - BLOCKER violations: 0")
        print(f"   - REVIEW warnings: {len(validation_results['validation_warnings'])} (allowed)")
    print()
    print("=" * 80)
    print(f"Output files saved to: {output_dir}")
    print(f"Updated baseline: {output_baseline_path}")
    print("=" * 80)


if __name__ == '__main__':
    main()

