/**
 * Knowledge gap resolver for Water (doctrine-aligned).
 */
import type { KnowledgeGap, GapResolverInput } from './gapTypes';
import { isNoOrUnknown } from '../vulnerabilities/themeUtils';

export function resolveWaterGaps(input: GapResolverInput): KnowledgeGap[] {
  const { answers } = input;
  const gaps: KnowledgeGap[] = [];

  const wq8 = answers.W_Q8_alternate_source;
  const wq9 = answers.W_Q9_alternate_supports_core;
  if (wq8 === 'yes' && (wq9 === 'unknown' || wq9 == null)) {
    gaps.push({
      id: 'WATER_ALTERNATE_ADEQUACY_UNKNOWN',
      title: 'Alternate water source adequacy unknown',
      description: 'Alternate water source exists but whether it can support core operations during extended disruption is not documented.',
      question_ids: ['W_Q9'],
      severity: 'MEDIUM',
    });
  }

  const wq7 = answers.W_Q7_contingency_plan;
  if (wq7 === 'unknown' || wq7 == null) {
    gaps.push({
      id: 'WATER_CONTINGENCY_UNKNOWN',
      title: 'Water contingency plan status unknown',
      description: 'Documented contingency/coordination plan with the water provider has not been confirmed.',
      question_ids: ['W_Q7'],
      severity: 'MEDIUM',
    });
  }

  return gaps.slice(0, 6); // cap at 6
}
