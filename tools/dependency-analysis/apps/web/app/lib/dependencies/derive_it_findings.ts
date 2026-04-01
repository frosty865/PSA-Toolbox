/**
 * Deterministic derivation: ItAnswers → vulnerabilities, OFCs.
 * Theme-based: 2–3 findings per dependency instead of one-per-trigger.
 */
import type { ItAnswers } from './infrastructure/it_spec';
import { resolveThemedFindings } from './vulnerabilities/resolveThemes';
import { themedFindingsToDerived } from './vulnerabilities/themedToDerived';
import { resolveKnowledgeGaps } from './knowledge_gaps/resolveGaps';
import type { GapResolverInput } from './knowledge_gaps/gapTypes';

export type ItVulnerability = {
  id: string;
  text: string;
  infrastructure: 'InformationTechnology';
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type ItOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export type ItDerivedFindings = {
  vulnerabilities: ItVulnerability[];
  ofcs: ItOfc[];
  themedFindings?: import('./vulnerabilities/themeTypes').ThemedFinding[];
  knowledgeGaps?: import('./knowledge_gaps/gapTypes').KnowledgeGap[];
};

/** Theme IDs for parity/display. Transport/ISP (Communications) and hosted service continuity (internet loss) are separate; no cross-trigger. */
export const IT_VULNERABILITY_TEXTS: Record<string, string> = {
  IT_PROVIDER_CONCENTRATION: 'External IT provider dependency may be concentrated',
  IT_TRANSPORT_INDEPENDENCE_UNKNOWN: 'Transport independence attributes not fully documented',
  IT_TRANSPORT_DIVERSITY_RECORDED: 'Transport diversity recorded; path diversity unknown',
  IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN: 'Multiple IT connections; independence not documented',
  IT_FALLBACK_AVAILABILITY: 'Fallback for external IT disruptions may be limited', // legacy; prefer IT_TRANSPORT_SINGLE_PATH / IT_HOSTED_VENDOR_*
  IT_TRANSPORT_SINGLE_PATH: 'Internet transport has single path or limited diversity',
  IT_HOSTED_VENDOR_NO_CONTINUITY: 'Hosted service has no continuity when internet is lost',
  IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN: 'Hosted service continuity not evaluated',
  IT_CONTINUITY_NOT_DEMONSTRATED: 'Continuity readiness may not be demonstrated',
};

export function getItOfcList(): { id: string; text: string; vulnerability_id: string }[] {
  return [
    { id: 'OFC-IT_PROVIDER_CONCENTRATION', text: 'Evaluate the feasibility of diversifying external IT provider/platform dependencies to reduce single-point-of-failure risk.', vulnerability_id: 'IT_PROVIDER_CONCENTRATION' },
    { id: 'OFC-IT_TRANSPORT_INDEPENDENCE_UNKNOWN', text: 'Document physical path diversity and route independence for transport circuits where applicable.', vulnerability_id: 'IT_TRANSPORT_INDEPENDENCE_UNKNOWN' },
    { id: 'OFC-IT_TRANSPORT_DIVERSITY_RECORDED', text: 'Document physical path diversity and route independence where applicable.', vulnerability_id: 'IT_TRANSPORT_DIVERSITY_RECORDED' },
    { id: 'OFC-IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN', text: 'Verify and record route and entry independence for each IT connection; treat unverified links as shared-failure exposure until confirmed.', vulnerability_id: 'IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN' },
    { id: 'OFC-IT_FALLBACK_AVAILABILITY', text: 'Evaluate the need for an alternate method to continue critical operations if primary external IT services are unavailable.', vulnerability_id: 'IT_FALLBACK_AVAILABILITY' },
    { id: 'OFC-IT_TRANSPORT_SINGLE_PATH', text: 'Evaluate alternate transport path or carrier diversity for internet connectivity; do not conflate with hosted service continuity (internet loss impact), which is evaluated in IT.', vulnerability_id: 'IT_TRANSPORT_SINGLE_PATH' },
    { id: 'OFC-IT_HOSTED_VENDOR_NO_CONTINUITY', text: 'Evaluate per-service continuity when internet connectivity is lost and the hosted service cannot be reached: alternate provider, local mirror, or validated manual fallback.', vulnerability_id: 'IT_HOSTED_VENDOR_NO_CONTINUITY' },
    { id: 'OFC-IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN', text: 'Evaluate and document per-service continuity when internet connectivity is lost and the hosted service cannot be reached.', vulnerability_id: 'IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN' },
    { id: 'OFC-IT_CONTINUITY_NOT_DEMONSTRATED', text: 'Establish and maintain a routine testing or exercise schedule for backup IT systems and continuity plans to verify they function as intended when needed.', vulnerability_id: 'IT_CONTINUITY_NOT_DEMONSTRATED' },
  ];
}

export function deriveItFindings(
  answers: ItAnswers,
  categoryInput?: GapResolverInput['categoryInput']
): ItDerivedFindings {
  const cat = typeof categoryInput === 'object' && categoryInput != null && 'categoryInput' in categoryInput
    ? (categoryInput as { categoryInput: unknown }).categoryInput
    : categoryInput;
  const themedFindings = resolveThemedFindings({ category: 'INFORMATION_TECHNOLOGY', answers, categoryInput: cat });
  const { vulnerabilities, ofcs } = themedFindingsToDerived(themedFindings, 'InformationTechnology');
  const knowledgeGaps = resolveKnowledgeGaps({
    category: 'INFORMATION_TECHNOLOGY',
    answers,
    categoryInput,
  });
  return { vulnerabilities, ofcs, themedFindings, knowledgeGaps } as ItDerivedFindings;
}
