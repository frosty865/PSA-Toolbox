/**
 * Deterministic derivation: WaterAnswers → vulnerabilities, OFCs.
 * Theme-based: up to 2 findings per dependency instead of one-per-trigger.
 */
import type { WaterAnswers } from './infrastructure/water_spec';
import { resolveThemedFindings } from './vulnerabilities/resolveThemes';
import { themedFindingsToDerived } from './vulnerabilities/themedToDerived';
import { resolveKnowledgeGaps } from './knowledge_gaps/resolveGaps';

export type WaterVulnerability = {
  id: string;
  text: string;
  infrastructure: 'Water';
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type WaterOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type WaterDerivedFindings = {
  vulnerabilities: WaterVulnerability[];
  ofcs: WaterOfc[];
  themedFindings?: import('./vulnerabilities/themeTypes').ThemedFinding[];
  knowledgeGaps?: import('./knowledge_gaps/gapTypes').KnowledgeGap[];
};

/** Theme IDs for parity/display (doctrine-aligned). */
export const WATER_VULNERABILITY_TEXTS: Record<string, string> = {
  W_NO_PRIORITY_RESTORATION: 'No priority restoration plan',
  W_NO_ALTERNATE_SOURCE: 'No alternate water source',
  W_ALTERNATE_INSUFFICIENT: 'Alternate water insufficient for core operations',
};

export function getWaterOfcList(): { id: string; text: string; vulnerability_id: string }[] {
  return [
    { id: 'OFC-W_NO_PRIORITY_RESTORATION', text: 'Consider discussing restoration prioritization criteria with the provider and documenting expectations.', vulnerability_id: 'W_NO_PRIORITY_RESTORATION' },
    { id: 'OFC-W_NO_ALTERNATE_SOURCE', text: 'Consider evaluating whether an alternate source is needed for core operations during extended disruptions.', vulnerability_id: 'W_NO_ALTERNATE_SOURCE' },
    { id: 'OFC-W_ALTERNATE_INSUFFICIENT', text: 'Consider evaluating options to augment the current alternate source to better support core operations.', vulnerability_id: 'W_ALTERNATE_INSUFFICIENT' },
  ];
}

export function deriveWaterFindings(answers: WaterAnswers): WaterDerivedFindings {
  const themedFindings = resolveThemedFindings({ category: 'WATER', answers });
  const { vulnerabilities, ofcs } = themedFindingsToDerived(themedFindings, 'Water');
  const knowledgeGaps = resolveKnowledgeGaps({ category: 'WATER', answers });
  return { vulnerabilities, ofcs, themedFindings, knowledgeGaps } as WaterDerivedFindings;
}
