/**
 * Deterministic derivation: CommsAnswers → vulnerabilities, OFCs.
 * Theme-based: 2–3 findings per dependency instead of one-per-trigger.
 */
import type { CommsAnswers } from './infrastructure/comms_spec';
import { resolveThemedFindings } from './vulnerabilities/resolveThemes';
import { themedFindingsToDerived } from './vulnerabilities/themedToDerived';
import { resolveKnowledgeGaps } from './knowledge_gaps/resolveGaps';
import type { GapResolverInput } from './knowledge_gaps/gapTypes';

export type CommsVulnerability = {
  id: string;
  text: string;
  infrastructure: 'Communications';
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type CommsOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type CommsDerivedFindings = {
  vulnerabilities: CommsVulnerability[];
  ofcs: CommsOfc[];
  themedFindings?: import('./vulnerabilities/themeTypes').ThemedFinding[];
  knowledgeGaps?: import('./knowledge_gaps/gapTypes').KnowledgeGap[];
};

/** Theme IDs for parity/display. */
export const COMMS_VULNERABILITY_TEXTS: Record<string, string> = {
  COMMS_DIVERSITY: 'Carrier diversity may be limited',
  COMMS_ALTERNATE_CAPABILITY: 'Alternate communications capability may be insufficient or unverified',
  COMMS_RESTORATION_REALISM: 'Restoration coordination may be unclear',
};

export function getCommsOfcList(): { id: string; text: string; vulnerability_id: string }[] {
  return [
    { id: 'OFC-COMMS_DIVERSITY', text: 'Evaluate the feasibility of establishing additional communications service connections with geographic separation, or diversifying backup capability to use different carriers, routes, or infrastructure.', vulnerability_id: 'COMMS_DIVERSITY' },
    { id: 'OFC-COMMS_ALTERNATE_CAPABILITY', text: 'Evaluate the need for backup or alternate communications capability to support core operations during extended service outages.', vulnerability_id: 'COMMS_ALTERNATE_CAPABILITY' },
    { id: 'OFC-COMMS_RESTORATION_REALISM', text: 'Establish documented coordination with the communications service provider regarding restoration expectations, priority considerations, and communication procedures.', vulnerability_id: 'COMMS_RESTORATION_REALISM' },
  ];
}

export function deriveCommsFindings(
  answers: CommsAnswers,
  categoryInput?: GapResolverInput['categoryInput']
): CommsDerivedFindings {
  const themedFindings = resolveThemedFindings({ category: 'COMMUNICATIONS', answers });
  const { vulnerabilities, ofcs } = themedFindingsToDerived(themedFindings, 'Communications');
  const knowledgeGaps = resolveKnowledgeGaps({
    category: 'COMMUNICATIONS',
    answers,
    categoryInput,
  });
  return { vulnerabilities, ofcs, themedFindings, knowledgeGaps } as CommsDerivedFindings;
}
