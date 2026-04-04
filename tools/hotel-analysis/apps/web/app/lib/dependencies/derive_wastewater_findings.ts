/**
 * Deterministic derivation: WastewaterAnswers → vulnerabilities, OFCs.
 * Theme-based: up to 2 findings per dependency instead of one-per-trigger.
 */
import type { WastewaterAnswers } from './infrastructure/wastewater_spec';
import { resolveThemedFindings } from './vulnerabilities/resolveThemes';
import { themedFindingsToDerived } from './vulnerabilities/themedToDerived';
import { resolveKnowledgeGaps } from './knowledge_gaps/resolveGaps';

export type WastewaterVulnerability = {
  id: string;
  text: string;
  infrastructure: 'Wastewater';
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type WastewaterOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type WastewaterDerivedFindings = {
  vulnerabilities: WastewaterVulnerability[];
  ofcs: WastewaterOfc[];
  themedFindings?: import('./vulnerabilities/themeTypes').ThemedFinding[];
  knowledgeGaps?: import('./knowledge_gaps/gapTypes').KnowledgeGap[];
};

/** Theme IDs for parity/display (doctrine-aligned). */
export const WASTEWATER_VULNERABILITY_TEXTS: Record<string, string> = {
  WW_NO_PRIORITY_RESTORATION: 'No priority restoration plan',
};

export function getWastewaterOfcList(): { id: string; text: string; vulnerability_id: string }[] {
  return [
    { id: 'OFC-WW_NO_PRIORITY_RESTORATION', text: 'Consider discussing restoration prioritization criteria with the provider and documenting realistic expectations.', vulnerability_id: 'WW_NO_PRIORITY_RESTORATION' },
  ];
}

export function deriveWastewaterFindings(answers: WastewaterAnswers): WastewaterDerivedFindings {
  const themedFindings = resolveThemedFindings({ category: 'WASTEWATER', answers });
  const { vulnerabilities, ofcs } = themedFindingsToDerived(themedFindings, 'Wastewater');
  const knowledgeGaps = resolveKnowledgeGaps({ category: 'WASTEWATER', answers });
  return { vulnerabilities, ofcs, themedFindings, knowledgeGaps } as WastewaterDerivedFindings;
}
