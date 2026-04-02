#!/usr/bin/env python3
"""Show lane routing summary."""

import json
from pathlib import Path

exp = json.load(open('analytics/reports/cisa_expansion_promotable.json', 'r', encoding='utf-8'))
base = json.load(open('analytics/reports/cisa_baseline_revision_candidates.json', 'r', encoding='utf-8'))
ctx = json.load(open('analytics/reports/cisa_context_only.json', 'r', encoding='utf-8'))

print('='*80)
print('LANE ROUTING SUMMARY')
print('='*80)

print(f'\nEXPANSION: {len(exp)} candidates')
print('  (Event/venue-specific questions ready for overlay promotion)')
print('  Examples:')
for item in exp[:5]:
    print(f'    - {item["question_text"][:75]}...')
    print(f'      Score: {item["general_applicability_score"]:.2f} | Reason: {item["lane_reason"]}')

print(f'\nBASELINE_REVISION_CANDIDATE: {len(base)} candidates')
print('  (Generally applicable questions for baseline governance review - NO auto-promotion)')
print('  Examples:')
for item in base:
    print(f'    - {item["question_text"]}')
    print(f'      Score: {item["general_applicability_score"]:.2f} | Reason: {item["lane_reason"]}')

print(f'\nCONTEXT_ONLY: {len(ctx)} candidates')
print('  (Facility info questions - not security control questions)')
print('  Examples:')
for item in ctx:
    print(f'    - {item["question_text"]}')
    print(f'      Score: {item["general_applicability_score"]:.2f} | Reason: {item["lane_reason"]}')

print('\n' + '='*80)
print(f'TOTAL: {len(exp) + len(base) + len(ctx)} candidates routed')
print('='*80)

