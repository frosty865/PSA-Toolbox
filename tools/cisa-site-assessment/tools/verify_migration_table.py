#!/usr/bin/env python3
"""Quick verification script for migration table."""
import json

with open('analytics/reports/baseline_migration_table.json', 'r') as f:
    data = json.load(f)

resilience = [r for r in data['migration_table'] if r.get('mapped_gate') == 'CONTROL_RESILIENCE']
print(f'Total CONTROL_RESILIENCE: {len(resilience)}')
print('\nSubtypes:')
for r in resilience:
    print(f"  {r['subtype']} ({r['discipline']}) - {r['legacy_question_id']}")

print(f"\nBy Gate Summary:")
for gate, count in data['summary']['by_gate'].items():
    print(f"  {gate}: {count}")

