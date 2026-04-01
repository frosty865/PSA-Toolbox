import { describe, it, expect } from 'vitest';
import {
  generateSlaReliabilitySummary,
  getSlaReliabilityDisplayText,
  getSlaReliabilityDerived,
  type SlaReliabilityDerived,
} from './slaReliabilitySummary';
import { DEFAULT_PRIORITY_RESTORATION } from '@/app/lib/asset-dependency/priorityRestorationSchema';

describe('generateSlaReliabilitySummary', () => {
  it('reliabilityCount = 0: both audiences show clear no-limitation language', () => {
    const assessor = generateSlaReliabilitySummary('Energy', 0, 'ASSESSOR');
    const stakeholder = generateSlaReliabilitySummary('Energy', 0, 'STAKEHOLDER');

    expect(assessor).toContain('No reliability limitations were identified');
    expect(assessor).toContain('documented');
    expect(stakeholder).toContain('No limitations');
    expect(stakeholder).toContain('in place');
    expect(stakeholder).not.toContain('gap');
  });

  it('reliabilityCount = 2: assessor includes count and clarification; stakeholder uses "Some conditions"', () => {
    const assessor = generateSlaReliabilitySummary('Communications', 2, 'ASSESSOR');
    const stakeholder = generateSlaReliabilitySummary('Communications', 2, 'STAKEHOLDER');

    expect(assessor).toContain('2 conditions');
    expect(assessor).toContain('need clarification');
    expect(assessor).toContain('documented');
    expect(stakeholder).toContain('Some conditions');
    expect(stakeholder).not.toContain('2');
    expect(stakeholder).not.toContain('gap');
  });

  it('reliabilityCount = 1: assessor uses singular "condition"', () => {
    const text = generateSlaReliabilitySummary('Information Technology', 1, 'ASSESSOR');
    expect(text).toContain('1 condition');
    expect(text).toContain('need clarification');
  });

  it('when conditionLabels provided, assessor summary includes them in parentheses', () => {
    const text = generateSlaReliabilitySummary(
      'Energy',
      2,
      'ASSESSOR',
      ['regional applicability', 'clock (start/stop) definition']
    );
    expect(text).toContain('2 conditions');
    expect(text).toContain('(regional applicability and clock (start/stop) definition)');
    expect(text).toContain('affect restoration');
  });

  it('when conditionLabels provided, stakeholder summary includes them', () => {
    const text = generateSlaReliabilitySummary(
      'Communications',
      1,
      'STAKEHOLDER',
      ['documentation accessibility']
    );
    expect(text).toContain('conditions (documentation accessibility)');
  });
});

describe('getSlaReliabilityDisplayText', () => {
  it('sla_assessed = false: returns "SLA not assessed" (no summary rendered)', () => {
    const derived: SlaReliabilityDerived = {
      topic_label: 'Energy',
      sla_assessed: false,
      sla_in_place: 'UNKNOWN',
      sla_reliability_issue_count: 0,
      reliability_condition_labels: [],
    };
    expect(getSlaReliabilityDisplayText(derived, 'ASSESSOR')).toBe('SLA not assessed');
    expect(getSlaReliabilityDisplayText(derived, 'STAKEHOLDER')).toBe('SLA not assessed');
  });

  it('sla_assessed = true, sla_in_place = NO: returns status only', () => {
    const derived: SlaReliabilityDerived = {
      topic_label: 'Water',
      sla_assessed: true,
      sla_in_place: 'NO',
      sla_reliability_issue_count: 0,
      reliability_condition_labels: [],
    };
    expect(getSlaReliabilityDisplayText(derived, 'ASSESSOR')).toBe('No SLA documented');
  });

  it('sla_assessed = true, sla_in_place = UNKNOWN: returns "SLA unknown"', () => {
    const derived: SlaReliabilityDerived = {
      topic_label: 'Communications',
      sla_assessed: true,
      sla_in_place: 'UNKNOWN',
      sla_reliability_issue_count: 0,
      reliability_condition_labels: [],
    };
    expect(getSlaReliabilityDisplayText(derived, 'ASSESSOR')).toBe('SLA unknown');
  });

  it('sla_assessed = true, sla_in_place = YES: returns generated summary', () => {
    const derived: SlaReliabilityDerived = {
      topic_label: 'Energy',
      sla_assessed: true,
      sla_in_place: 'YES',
      sla_reliability_issue_count: 0,
      reliability_condition_labels: [],
    };
    const text = getSlaReliabilityDisplayText(derived, 'ASSESSOR');
    expect(text).toContain('Energy');
    expect(text).toContain('No reliability limitations');
  });
});

describe('getSlaReliabilityDerived', () => {
  it('returns sla_assessed false and zero count when topic not assessed', () => {
    const pr = DEFAULT_PRIORITY_RESTORATION;
    const derived = getSlaReliabilityDerived(pr, 'energy');
    expect(derived.sla_assessed).toBe(false);
    expect(derived.sla_reliability_issue_count).toBe(0);
    expect(derived.topic_label).toBe('Energy');
  });
});
