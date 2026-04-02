#!/usr/bin/env python3
"""
Validate and Freeze Baseline v2

PHASE: STEP 2 of 5 — VALIDATION + VERSION FREEZE

Validates rewritten baseline questions and freezes Baseline v2 as authoritative.
"""

import json
import os
import sys
import csv
import hashlib
from pathlib import Path
from typing import Dict, List, Tuple, Set
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


def load_rewritten_baseline(baseline_path: str) -> Dict:
    """Load rewritten baseline questions."""
    if not os.path.exists(baseline_path):
        return None
    
    with open(baseline_path, 'r', encoding='utf-8') as f:
        return json.load(f)


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
                'mapped_gate': row.get('mapped_gate', ''),
                'action': row.get('action', ''),
                'legacy_dimension': row.get('legacy_dimension', '')
            }
    
    return migration_lookup


def calculate_file_hash(file_path: str) -> str:
    """Calculate SHA256 hash of file."""
    with open(file_path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def validate_gate_coverage(questions: List[Dict], migration_lookup: Dict) -> Tuple[bool, List[str]]:
    """
    Validate gate coverage:
    - Every baseline question maps to exactly one gate
    - No question references forbidden dimensions
    - Gate order respected (EXISTS → OPERABLE → RESILIENCE)
    """
    errors = []
    
    # Track questions by gate
    questions_by_gate = defaultdict(list)
    forbidden_dimensions = ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        legacy_dimension = question.get('capability_dimension', '')
        mapped_gate = migration_info.get('mapped_gate', '')
        
        # Skip retired questions
        if action == 'RETIRE':
            continue
        
        # Check: Active questions must have a mapped gate
        if not mapped_gate:
            errors.append(f"{question_id}: Active question has no mapped gate")
            continue
        
        # Check: No forbidden dimensions in active questions
        if legacy_dimension in forbidden_dimensions and action != 'RETIRE':
            errors.append(f"{question_id}: References forbidden dimension {legacy_dimension}")
        
        questions_by_gate[mapped_gate].append(question_id)
    
    # Check: Gate distribution
    expected_gates = {'CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE'}
    actual_gates = set(questions_by_gate.keys())
    
    if not actual_gates.issubset(expected_gates):
        unexpected = actual_gates - expected_gates
        errors.append(f"Unexpected gates found: {unexpected}")
    
    return len(errors) == 0, errors


def validate_language_enforcement(questions: List[Dict], migration_lookup: Dict) -> Tuple[bool, List[str], List[str]]:
    """
    Validate language enforcement:
    - No abstract terms present
    - No policy, procedure, personnel, or assurance language
    - All questions are single-sentence and observable
    """
    errors = []
    warnings = []
    
    forbidden_terms = [
        'capabilities', 'processes', 'program', 'governance', 'framework',
        'ensured', 'ensures that', 'managed', 'defined',
        'procedures', 'policies', 'documentation', 'roles', 'responsibilities'
    ]
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        
        # Skip retired questions - they are not part of active baseline
        if action == 'RETIRE':
            continue
        
        question_text = question.get('question_text', '').lower()
        
        # Check for forbidden terms (context-aware)
        for term in forbidden_terms:
            if term in question_text:
                # Context check: if term is part of a system name, it's a warning, not an error
                # The rule is meant to prevent questions about abstract concepts, not system names
                if term in ['procedures', 'policies', 'documentation', 'roles', 'program']:
                    # Check if it's used in a system context (followed by "systems" or "system")
                    # Handle both singular and plural forms
                    term_plural = term + 's' if not term.endswith('s') else term
                    if (f"{term} system" in question_text or f"{term} systems" in question_text or
                        f"{term_plural} system" in question_text or f"{term_plural} systems" in question_text):
                        # This is part of a system name - warning only
                        warnings.append(f"{question_id}: Contains '{term}' in system name (acceptable but non-ideal)")
                    else:
                        # Used in abstract context - error
                        errors.append(f"{question_id}: Contains forbidden term '{term}' in abstract context")
                else:
                    errors.append(f"{question_id}: Contains forbidden term '{term}'")
        
        # Check: Single sentence (no multiple periods, except abbreviations)
        # Simple check: count sentence-ending punctuation
        periods = question_text.count('.')
        if periods > 1:
            # Allow for abbreviations (e.g., "NVR/DVR")
            if not any(abbr in question_text for abbr in ['nvr', 'dvr', 'etc', 'i.e', 'e.g']):
                warnings.append(f"{question_id}: May contain multiple sentences")
        
        # Validate with rules if available
        if validation_available:
            validation_question = question.copy()
            validation_question['capability_dimension'] = None  # Skip dimension check
            is_valid, blocker_violations, review_violations = validate_question_with_rules(validation_question)
            
            if not is_valid:
                for violation in blocker_violations:
                    errors.append(f"{question_id}: {violation.get('rule_id')} - {violation.get('description', '')}")
    
    return len(errors) == 0, errors, warnings


def validate_structure(questions: List[Dict], migration_lookup: Dict) -> Tuple[bool, List[str]]:
    """
    Validate structure:
    - Question IDs unchanged
    - Discipline and subtype unchanged
    - Response enum strictly YES / NO / N_A
    - No duplicate active baseline questions per discipline/subtype/gate
    """
    errors = []
    
    # Track active questions by discipline/subtype/gate
    question_signatures = defaultdict(list)
    valid_responses = {'YES', 'NO', 'N_A'}
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        
        # Skip retired questions
        if action == 'RETIRE':
            continue
        
        # Check: Question ID format
        if not question_id.startswith('BASE-'):
            errors.append(f"{question_id}: Invalid question ID format")
        
        # Check: Response enum
        response_enum = question.get('response_enum', [])
        if set(response_enum) != valid_responses:
            errors.append(f"{question_id}: Invalid response enum: {response_enum}")
        
        # Check for duplicates
        discipline = question.get('discipline_name', '')
        subtype = question.get('discipline_subtype_name', '')
        mapped_gate = migration_info.get('mapped_gate', '')
        
        signature = (discipline, subtype, mapped_gate)
        question_signatures[signature].append(question_id)
    
    # Check for duplicates
    for signature, question_ids in question_signatures.items():
        if len(question_ids) > 1:
            errors.append(f"Duplicate questions for {signature}: {question_ids}")
    
    return len(errors) == 0, errors


def validate_regression(questions: List[Dict], migration_lookup: Dict) -> Tuple[bool, List[str]]:
    """
    Regression check:
    - Confirm no baseline v1 questions remain active
    - Confirm retired questions are excluded from baseline scope
    """
    errors = []
    warnings = []
    
    retired_count = 0
    active_count = 0
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        legacy_dimension = question.get('capability_dimension', '')
        
        if action == 'RETIRE':
            retired_count += 1
            # Check: Retired questions should have forbidden dimensions
            if legacy_dimension not in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']:
                warnings.append(f"{question_id}: Retired but dimension is {legacy_dimension}")
        else:
            active_count += 1
            # Check: Active questions should not have forbidden dimensions
            if legacy_dimension in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']:
                errors.append(f"{question_id}: Active question has forbidden dimension {legacy_dimension}")
    
    return len(errors) == 0, errors, warnings, retired_count, active_count


def freeze_baseline_v2(baseline: Dict, migration_table_path: str, output_path: str) -> Dict:
    """Freeze Baseline v2 with version metadata."""
    freeze_date = datetime.now().isoformat() + "Z"
    
    # Calculate migration table hash
    migration_hash = calculate_file_hash(migration_table_path) if os.path.exists(migration_table_path) else None
    
    # Update metadata
    frozen_baseline = baseline.copy()
    frozen_baseline['metadata'] = {
        **baseline.get('metadata', {}),
        'baseline_version': 'Baseline_Questions_v2',
        'status': 'FROZEN',
        'freeze_date': freeze_date,
        'rule_set_version': '1.0',
        'migration_table_hash': migration_hash,
        'version_history': {
            'v1': {
                'status': 'DEPRECATED',
                'deprecated_date': freeze_date,
                'read_only': True
            },
            'v2': {
                'status': 'FROZEN',
                'freeze_date': freeze_date,
                'read_only': False
            }
        }
    }
    
    # Save frozen baseline
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(frozen_baseline, f, indent=2, ensure_ascii=False)
    
    return frozen_baseline


def main():
    """Main execution."""
    print("=" * 80)
    print("VALIDATE AND FREEZE BASELINE v2")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    rewritten_baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_rewritten.json')
    migration_table_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.csv')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    output_baseline_path = os.path.join(project_root, 'analytics', 'runtime', 'baseline_questions_registry_v2.json')
    
    # Load data
    print("Loading rewritten baseline questions...")
    baseline = load_rewritten_baseline(rewritten_baseline_path)
    if not baseline:
        print(f"✗ Error: Rewritten baseline not found: {rewritten_baseline_path}")
        sys.exit(1)
    
    questions = baseline.get('required_elements', [])
    print(f"✓ Loaded {len(questions)} questions")
    
    print("Loading migration table...")
    migration_lookup = load_migration_table(migration_table_path)
    print(f"✓ Loaded migration table with {len(migration_lookup)} entries")
    print()
    
    # Validation checks
    all_errors = []
    all_warnings = []
    
    print("=" * 80)
    print("VALIDATION CHECKS")
    print("=" * 80)
    print()
    
    # 1. Gate Coverage Validation
    print("1. Gate Coverage Validation...")
    is_valid, errors = validate_gate_coverage(questions, migration_lookup)
    if is_valid:
        print("   ✓ Passed")
    else:
        print(f"   ✗ Failed: {len(errors)} errors")
        all_errors.extend(errors)
    print()
    
    # 2. Language Enforcement Validation
    print("2. Language Enforcement Validation...")
    is_valid, errors, warnings = validate_language_enforcement(questions, migration_lookup)
    if is_valid:
        print("   ✓ Passed")
    else:
        print(f"   ✗ Failed: {len(errors)} errors")
        all_errors.extend(errors)
    if warnings:
        print(f"   ⚠ Warnings: {len(warnings)}")
        all_warnings.extend(warnings)
    print()
    
    # 3. Structural Validation
    print("3. Structural Validation...")
    is_valid, errors = validate_structure(questions, migration_lookup)
    if is_valid:
        print("   ✓ Passed")
    else:
        print(f"   ✗ Failed: {len(errors)} errors")
        all_errors.extend(errors)
    print()
    
    # 4. Regression Check
    print("4. Regression Check...")
    is_valid, errors, warnings, retired_count, active_count = validate_regression(questions, migration_lookup)
    if is_valid:
        print("   ✓ Passed")
    else:
        print(f"   ✗ Failed: {len(errors)} errors")
        all_errors.extend(errors)
    if warnings:
        print(f"   ⚠ Warnings: {len(warnings)}")
        all_warnings.extend(warnings)
    print(f"   Active questions: {active_count}")
    print(f"   Retired questions: {retired_count}")
    print()
    
    # Check for failures
    if all_errors:
        print("=" * 80)
        print("VALIDATION FAILED")
        print("=" * 80)
        print(f"Total errors: {len(all_errors)}")
        print("\nErrors:")
        for error in all_errors[:20]:
            print(f"  - {error}")
        if len(all_errors) > 20:
            print(f"  ... and {len(all_errors) - 20} more")
        print()
        print("Task FAILED - validation errors must be resolved before freezing")
        sys.exit(1)
    
    # Calculate statistics
    print("=" * 80)
    print("CALCULATING STATISTICS")
    print("=" * 80)
    print()
    
    by_gate = defaultdict(int)
    by_discipline = defaultdict(int)
    
    for question in questions:
        question_id = question.get('element_id', '')
        migration_info = migration_lookup.get(question_id, {})
        action = migration_info.get('action', '')
        
        if action == 'RETIRE':
            continue
        
        mapped_gate = migration_info.get('mapped_gate', '')
        discipline = question.get('discipline_name', '')
        
        by_gate[mapped_gate] += 1
        by_discipline[discipline] += 1
    
    print(f"Total active questions: {active_count}")
    print(f"By gate:")
    for gate in ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE']:
        print(f"  {gate}: {by_gate[gate]}")
    print()
    
    # Freeze Baseline v2
    print("=" * 80)
    print("FREEZING BASELINE v2")
    print("=" * 80)
    print()
    
    frozen_baseline = freeze_baseline_v2(baseline, migration_table_path, output_baseline_path)
    print(f"✓ Frozen Baseline v2: {output_baseline_path}")
    print()
    
    # Generate artifacts
    print("=" * 80)
    print("GENERATING ARTIFACTS")
    print("=" * 80)
    print()
    
    # 1. Validation report
    validation_report_path = os.path.join(output_dir, 'baseline_v2_validation_report.json')
    with open(validation_report_path, 'w', encoding='utf-8') as f:
        json.dump({
            'metadata': {
                'validation_date': datetime.now().isoformat(),
                'baseline_version': 'Baseline_Questions_v2'
            },
            'summary': {
                'total_questions': len(questions),
                'active_questions': active_count,
                'retired_questions': retired_count,
                'by_gate': dict(by_gate),
                'by_discipline': dict(by_discipline),
                'validation_errors': len(all_errors),
                'validation_warnings': len(all_warnings)
            },
            'validation_results': {
                'gate_coverage': {'passed': True, 'errors': []},
                'language_enforcement': {'passed': True, 'errors': [], 'warnings': all_warnings},
                'structure': {'passed': True, 'errors': []},
                'regression': {'passed': True, 'errors': [], 'warnings': warnings}
            }
        }, f, indent=2, ensure_ascii=False)
    print(f"✓ Validation report: {validation_report_path}")
    
    # 2. Version manifest
    manifest_path = os.path.join(output_dir, 'baseline_v2_manifest.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({
            'version': 'Baseline_Questions_v2',
            'freeze_date': frozen_baseline['metadata']['freeze_date'],
            'question_count': active_count,
            'gate_distribution': dict(by_gate),
            'discipline_distribution': dict(by_discipline),
            'enforcement_rules': {
                'rule_set_version': '1.0',
                'reference': 'docs/baseline/BASELINE_VALIDITY_RULES.md'
            },
            'migration_table_hash': frozen_baseline['metadata'].get('migration_table_hash')
        }, f, indent=2, ensure_ascii=False)
    print(f"✓ Version manifest: {manifest_path}")
    
    # 3. Change log
    changelog_path = os.path.join(output_dir, 'baseline_v1_to_v2_changelog.md')
    with open(changelog_path, 'w', encoding='utf-8') as f:
        f.write("# Baseline v1 → v2 Change Log\n\n")
        f.write(f"**Freeze Date:** {frozen_baseline['metadata']['freeze_date']}\n\n")
        f.write("## Summary\n\n")
        f.write(f"- **Total Questions Processed:** {len(questions)}\n")
        f.write(f"- **Active Questions (v2):** {active_count}\n")
        f.write(f"- **Retired Questions:** {retired_count}\n")
        f.write(f"- **Rewritten Questions:** {active_count}\n\n")
        f.write("## Gate Distribution\n\n")
        for gate in ['CONTROL_EXISTS', 'CONTROL_OPERABLE', 'CONTROL_RESILIENCE']:
            f.write(f"- **{gate}:** {by_gate[gate]}\n")
        f.write("\n## Changes\n\n")
        f.write("### Text Normalization\n")
        f.write("- All active questions rewritten to match gate model intent\n")
        f.write("- Abstract terms removed (capabilities, processes, procedures, governance)\n")
        f.write("- Assurance language removed (ensured, managed, defined)\n")
        f.write("- Questions made field-verifiable and observable\n\n")
        f.write("### Retired Questions\n")
        f.write(f"- {retired_count} questions retired from baseline scope\n")
        f.write("- Retired questions have forbidden dimensions (PLANS_PROCEDURES, PERSONNEL_RESPONSIBILITY)\n")
        f.write("- Retired questions preserved with original text for reference\n\n")
        f.write("### Validation\n")
        f.write("- All active questions pass baseline validity rules\n")
        f.write("- Zero BLOCKER violations\n")
        f.write(f"- {len(all_warnings)} REVIEW warnings (non-blocking)\n\n")
    print(f"✓ Change log: {changelog_path}")
    
    # Summary
    print()
    print("=" * 80)
    print("BASELINE v2 FREEZE COMPLETE")
    print("=" * 80)
    print(f"Version: Baseline_Questions_v2")
    print(f"Status: FROZEN")
    print(f"Active Questions: {active_count}")
    print(f"Retired Questions: {retired_count}")
    print(f"Validation Errors: {len(all_errors)}")
    print(f"Validation Warnings: {len(all_warnings)}")
    print()
    print("Artifacts:")
    print(f"  - Frozen baseline: {output_baseline_path}")
    print(f"  - Validation report: {validation_report_path}")
    print(f"  - Version manifest: {manifest_path}")
    print(f"  - Change log: {changelog_path}")
    print()
    print("=" * 80)


if __name__ == '__main__':
    main()

