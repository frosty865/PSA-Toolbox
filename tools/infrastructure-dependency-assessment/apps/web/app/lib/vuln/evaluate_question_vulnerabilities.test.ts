import { describe, expect, it } from 'vitest';
import { evaluateVulnerabilitiesByCategory } from './evaluate_question_vulnerabilities';

describe('evaluate_question_vulnerabilities IT gap mappings', () => {
  it('emits IT_HOSTED_SERVICES_NOT_IDENTIFIED from IT-2 negative/unknown answers', () => {
    const result = evaluateVulnerabilitiesByCategory(
      'INFORMATION_TECHNOLOGY',
      { answers: { 'IT-2_can_identify_assets': 'no' } },
      { praEnabled: false }
    );
    expect(result.some((v) => v.id === 'IT_HOSTED_SERVICES_NOT_IDENTIFIED')).toBe(true);
  });

  it('emits IT_FALLBACK_CAPABILITY_INSUFFICIENT from IT-5 negative/unknown answers', () => {
    const result = evaluateVulnerabilitiesByCategory(
      'INFORMATION_TECHNOLOGY',
      { answers: { 'IT-5_survivability': 'unknown' } },
      { praEnabled: false }
    );
    expect(result.some((v) => v.id === 'IT_FALLBACK_CAPABILITY_INSUFFICIENT')).toBe(true);
  });

  it('emits IT_CONTINUITY_PLAN_NOT_EXERCISED when plan exercise status is no/unknown', () => {
    const result = evaluateVulnerabilitiesByCategory(
      'INFORMATION_TECHNOLOGY',
      { answers: { it_plan_exercised: 'no' } },
      { praEnabled: false }
    );
    expect(result.some((v) => v.id === 'IT_CONTINUITY_PLAN_NOT_EXERCISED')).toBe(true);
  });
});

