/**
 * Knowledge gap resolver for Wastewater (doctrine-aligned).
 * Uses new WW_Q1–WW_Q14 answer schema.
 */
import type { KnowledgeGap, GapResolverInput } from './gapTypes';

export function resolveWastewaterGaps(input: GapResolverInput): KnowledgeGap[] {
  const { answers } = input;
  const gaps: KnowledgeGap[] = [];

  if (answers.WW_Q7_contingency_plan === 'no') {
    gaps.push({
      id: 'WASTEWATER_NO_CONTINGENCY_PLAN',
      title: 'No documented contingency plan',
      description: 'Contingency/coordination plan with the wastewater provider for extended disruption is not documented.',
      question_ids: ['WW_Q7'],
      severity: 'MEDIUM',
    });
  }

  return gaps.slice(0, 6);
}
