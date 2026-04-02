#!/usr/bin/env python3
"""
Refine Baseline Migration Table for CONTROL_RESILIENCE Mapping

Updates existing baseline_migration_table to correctly map
MAINTENANCE_ASSURANCE questions to CONTROL_RESILIENCE for resilience-eligible subtypes.

Resilience-eligible subtypes:
- VSS: Recording / Storage (VSS_RECORDING_STORAGE_NVR_DVR), System Architecture (VSS_SYSTEM_ARCHITECTURE)
- ACS: Controllers / Panels (need to identify exact subtype)
- IDS: Alarm Panels (IDS_ALARM_PANELS), Power / Backup (need to identify exact subtype)
- Any subtype with centralized dependency or single-point failure risk

OUTPUT:
- Updated baseline_migration_table.csv
- Updated baseline_migration_table.json
- Updated summary counts
- Verification report
"""

import json
import os
import sys
import csv
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime
from collections import defaultdict

# Resilience-eligible subtypes (by subtype_code or subtype_name)
# Based on user requirements: system-level and failure-sensitive subtypes
RESILIENCE_ELIGIBLE_SUBTYPES = {
    # Video Surveillance Systems
    'VSS_RECORDING_STORAGE_NVR_DVR',
    'VSS_SYSTEM_ARCHITECTURE',
    'Recording / Storage (NVR/DVR)',
    'System Architecture',
    
    # Intrusion Detection Systems
    'IDS_ALARM_PANELS',
    'Alarm Panels',
    
    # Access Control Systems
    # Note: "Electronic Access Control" may include controllers/panels
    # If a specific "Controllers / Panels" subtype exists, it should be added here
    'ACS_ELECTRONIC_ACCESS_CONTROL',  # May include controllers/panels
    'Electronic Access Control',
    
    # IDS Power / Backup - check for power-related subtypes
    # Note: "Backup Communications" is Communications discipline, not IDS
}

# Also check by name patterns for subtypes with centralized dependency or single-point failure risk
RESILIENCE_NAME_PATTERNS = [
    'controller',
    'panel',
    'recording',
    'storage',
    'architecture',
    'backup',
    'power',
    'redundancy',
    'sensitive item storage'  # Centralized dependency
]


def load_migration_table(json_path: str) -> Dict:
    """Load existing migration table."""
    if not os.path.exists(json_path):
        return None
    
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def is_resilience_eligible(subtype_name: str, subtype_code: str = None, discipline_name: str = None) -> bool:
    """
    Check if a subtype is resilience-eligible.
    Based on: system-level and failure-sensitive subtypes with centralized dependency or single-point failure risk.
    """
    # Check exact matches
    if subtype_code and subtype_code in RESILIENCE_ELIGIBLE_SUBTYPES:
        return True
    if subtype_name in RESILIENCE_ELIGIBLE_SUBTYPES:
        return True
    
    # Check name patterns (case-insensitive)
    subtype_lower = subtype_name.lower()
    discipline_lower = (discipline_name or '').lower()
    
    for pattern in RESILIENCE_NAME_PATTERNS:
        if pattern in subtype_lower:
            # Additional context checks
            if 'controller' in subtype_lower or 'panel' in subtype_lower:
                # Must be ACS, IDS, or VSS discipline
                if 'access control' in discipline_lower or 'intrusion detection' in discipline_lower or 'video surveillance' in discipline_lower:
                    return True
            if 'recording' in subtype_lower or 'storage' in subtype_lower:
                # Must be VSS
                if 'video surveillance' in discipline_lower:
                    return True
            if 'architecture' in subtype_lower:
                # Must be VSS
                if 'video surveillance' in discipline_lower:
                    return True
            if 'alarm' in subtype_lower and 'panel' in subtype_lower:
                # Must be IDS
                if 'intrusion detection' in discipline_lower:
                    return True
            if 'backup' in subtype_lower or 'power' in subtype_lower:
                # Must be IDS, Communications, or Emergency Management
                if 'intrusion detection' in discipline_lower or 'communications' in discipline_lower or 'emergency' in discipline_lower:
                    return True
            if 'sensitive item storage' in subtype_lower:
                # Centralized dependency
                return True
            if 'redundancy' in subtype_lower:
                # Redundancy systems
                return True
    
    return False


def refine_migration_table(migration_data: Dict) -> Tuple[List[Dict], Dict]:
    """
    Refine migration table to map resilience-eligible subtypes to CONTROL_RESILIENCE.
    Returns (updated_migration_table, changes_summary)
    """
    migration_table = migration_data.get('migration_table', [])
    changes_summary = {
        'total_updated': 0,
        'updated_questions': [],
        'by_subtype': defaultdict(int)
    }
    
    updated_table = []
    
    for row in migration_table:
        legacy_dimension = row.get('legacy_dimension', '')
        mapped_gate = row.get('mapped_gate')
        subtype_name = row.get('subtype', '')
        question_id = row.get('legacy_question_id', '')
        
        # Only update MAINTENANCE_ASSURANCE questions that currently map to CONTROL_OPERABLE
        if (legacy_dimension == 'MAINTENANCE_ASSURANCE' and 
            mapped_gate == 'CONTROL_OPERABLE' and
            row.get('action') != 'RETIRE'):
            
            # Check if subtype is resilience-eligible
            discipline_name = row.get('discipline', '')
            if is_resilience_eligible(subtype_name, discipline_name=discipline_name):
                # Update to CONTROL_RESILIENCE
                row['mapped_gate'] = 'CONTROL_RESILIENCE'
                changes_summary['total_updated'] += 1
                changes_summary['updated_questions'].append(question_id)
                changes_summary['by_subtype'][subtype_name] += 1
                
                # Update notes if needed
                if 'CONTROL_OPERABLE' in row.get('notes', ''):
                    row['notes'] = row['notes'].replace('CONTROL_OPERABLE', 'CONTROL_RESILIENCE')
                elif not row.get('notes') or row['notes'] == '':
                    row['notes'] = 'Mapped to CONTROL_RESILIENCE (resilience-eligible subtype)'
        
        updated_table.append(row)
    
    return updated_table, changes_summary


def generate_updated_summary(migration_table: List[Dict], original_summary: Dict, changes: Dict) -> Dict:
    """Generate updated summary statistics."""
    # Recalculate by gate
    by_gate = defaultdict(int)
    for row in migration_table:
        gate = row.get('mapped_gate')
        if gate:
            by_gate[gate] += 1
    
    # Recalculate by action
    by_action = defaultdict(int)
    for row in migration_table:
        action = row.get('action', '')
        if action:
            by_action[action] += 1
    
    return {
        'total_questions_processed': original_summary.get('total_questions_processed', len(migration_table)),
        'kept': original_summary.get('kept', 0),
        'rewritten': original_summary.get('rewritten', 0),
        'collapsed': original_summary.get('collapsed', 0),
        'retired': original_summary.get('retired', 0),
        'by_gate': dict(by_gate),
        'by_action': dict(by_action),
        'refinement_changes': changes
    }


def verify_refinement(migration_table: List[Dict]) -> Tuple[bool, List[str]]:
    """Verify refinement changes."""
    errors = []
    
    # Check: At least one CONTROL_RESILIENCE gate exists
    resilience_count = sum(1 for row in migration_table if row.get('mapped_gate') == 'CONTROL_RESILIENCE')
    if resilience_count == 0:
        errors.append("No CONTROL_RESILIENCE gates found - refinement may have failed")
    
    # Check: No forbidden dimensions reintroduced
    for row in migration_table:
        legacy_dim = row.get('legacy_dimension', '')
        if legacy_dim in ['PLANS_PROCEDURES', 'PERSONNEL_RESPONSIBILITY']:
            if row.get('action') != 'RETIRE':
                errors.append(f"Question {row.get('legacy_question_id')} has forbidden dimension {legacy_dim} but action is {row.get('action')}")
    
    # Check: All MAINTENANCE_ASSURANCE questions map to either CONTROL_OPERABLE or CONTROL_RESILIENCE (or RETIRE)
    for row in migration_table:
        if row.get('legacy_dimension') == 'MAINTENANCE_ASSURANCE' and row.get('action') != 'RETIRE':
            gate = row.get('mapped_gate')
            if gate not in ['CONTROL_OPERABLE', 'CONTROL_RESILIENCE']:
                errors.append(f"Question {row.get('legacy_question_id')} has MAINTENANCE_ASSURANCE but maps to {gate}")
    
    is_valid = len(errors) == 0
    return is_valid, errors


def main():
    """Main execution."""
    print("=" * 80)
    print("REFINE BASELINE MIGRATION TABLE FOR CONTROL_RESILIENCE")
    print("=" * 80)
    print()
    
    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, '..')
    
    input_json_path = os.path.join(project_root, 'analytics', 'reports', 'baseline_migration_table.json')
    output_dir = os.path.join(project_root, 'analytics', 'reports')
    
    # Load existing migration table
    print("Loading existing migration table...")
    migration_data = load_migration_table(input_json_path)
    if not migration_data:
        print(f"✗ Error: Migration table not found: {input_json_path}")
        sys.exit(1)
    print(f"✓ Loaded migration table with {len(migration_data.get('migration_table', []))} rows")
    print()
    
    # Refine migration table
    print("Refining migration table for CONTROL_RESILIENCE...")
    updated_table, changes = refine_migration_table(migration_data)
    print(f"✓ Updated {changes['total_updated']} questions to CONTROL_RESILIENCE")
    if changes['by_subtype']:
        print("  By subtype:")
        for subtype, count in sorted(changes['by_subtype'].items()):
            print(f"    {subtype}: {count}")
    print()
    
    # Generate updated summary
    updated_summary = generate_updated_summary(
        updated_table,
        migration_data.get('summary', {}),
        changes
    )
    
    # Verify
    print("Verifying refinement...")
    is_valid, errors = verify_refinement(updated_table)
    if is_valid:
        print("✓ Verification passed")
    else:
        print("✗ Verification failed:")
        for error in errors:
            print(f"  {error}")
    print()
    
    # Generate outputs
    print("Generating updated output files...")
    
    # Update JSON
    updated_data = {
        'metadata': {
            **migration_data.get('metadata', {}),
            'refined_at': datetime.now().isoformat(),
            'refinement_version': '1.0'
        },
        'summary': updated_summary,
        'migration_table': updated_table,
        'verification': {
            'is_valid': is_valid,
            'errors': errors
        }
    }
    
    json_path = os.path.join(output_dir, 'baseline_migration_table.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(updated_data, f, indent=2, ensure_ascii=False)
    print(f"✓ Updated JSON: {json_path}")
    
    # Update CSV
    csv_path = os.path.join(output_dir, 'baseline_migration_table.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'discipline', 'subtype', 'legacy_question_id', 'legacy_dimension',
            'mapped_gate', 'action', 'replacement_id', 'notes'
        ])
        writer.writeheader()
        writer.writerows(updated_table)
    print(f"✓ Updated CSV: {csv_path}")
    
    # Update summary
    summary_path = os.path.join(output_dir, 'baseline_migration_summary.md')
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.write("# Baseline Question Migration Summary\n\n")
        f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Refined:** Yes (CONTROL_RESILIENCE mapping applied)\n\n")
        f.write("## Summary Counts\n\n")
        f.write(f"- **Total Questions Processed:** {updated_summary['total_questions_processed']}\n")
        f.write(f"- **Kept:** {updated_summary['kept']}\n")
        f.write(f"- **Rewritten:** {updated_summary['rewritten']}\n")
        f.write(f"- **Collapsed:** {updated_summary['collapsed']}\n")
        f.write(f"- **Retired:** {updated_summary['retired']}\n\n")
        f.write("## By Gate\n\n")
        for gate, count in sorted(updated_summary['by_gate'].items()):
            f.write(f"- **{gate}:** {count}\n")
        f.write("\n## By Action\n\n")
        for action, count in sorted(updated_summary['by_action'].items()):
            f.write(f"- **{action}:** {count}\n")
        f.write("\n## Refinement Changes\n\n")
        f.write(f"- **Questions Updated to CONTROL_RESILIENCE:** {changes['total_updated']}\n")
        if changes['by_subtype']:
            f.write("\n### By Subtype\n\n")
            for subtype, count in sorted(changes['by_subtype'].items()):
                f.write(f"- **{subtype}:** {count}\n")
        f.write("\n## Verification\n\n")
        if is_valid:
            f.write("✅ **Verification Passed**\n\n")
        else:
            f.write("❌ **Verification Failed**\n\n")
            for error in errors:
                f.write(f"- {error}\n")
    print(f"✓ Updated Summary: {summary_path}")
    
    # Print summary
    print()
    print("=" * 80)
    print("REFINEMENT SUMMARY")
    print("=" * 80)
    print(f"Questions Updated to CONTROL_RESILIENCE: {changes['total_updated']}")
    print()
    print("By Gate (Updated):")
    for gate, count in sorted(updated_summary['by_gate'].items()):
        print(f"  {gate}: {count}")
    print()
    print("=" * 80)
    print(f"Updated files saved to: {output_dir}")
    print("=" * 80)


if __name__ == '__main__':
    main()

