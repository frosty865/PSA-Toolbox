/**
 * Theme combiner for Water dependency (doctrine-aligned).
 * Returns up to 2 themed findings from W_Q* answers.
 */
import type { EvidenceItem, ThemedFinding, ThemeResolverInput } from '../themeTypes';
import { isNoOrUnknown, isYes } from '../themeUtils';

function evidence(qid: string, answer?: unknown): EvidenceItem {
  return { question_id: qid, answer: answer as string | boolean | undefined };
}

export function resolveWaterThemes(input: ThemeResolverInput): ThemedFinding[] {
  const { answers, praSlaEnabled } = input;
  const findings: ThemedFinding[] = [];

  // 1) W_NO_PRIORITY_RESTORATION (external service) — W_Q6 is PRA/SLA-specific
  const wq6 = answers.W_Q6_priority_restoration;
  if (praSlaEnabled === true && wq6 === 'no') {
    findings.push({
      id: 'W_NO_PRIORITY_RESTORATION',
      title: 'No priority restoration plan',
      narrative:
        'The facility does not participate in a priority or coordinated restoration plan with the water provider, delaying restoration during high-impact events.',
      evidence: [evidence('W_Q6', wq6)],
      ofcText:
        'Consider confirming the provider, points of contact, and service area details relevant to the site.',
    });
  }

  // 2) W_NO_ALTERNATE_SOURCE / W_ALTERNATE_INSUFFICIENT (alternate water)
  const wq8 = answers.W_Q8_alternate_source;
  const wq9 = answers.W_Q9_alternate_supports_core;
  const wq8No = isNoOrUnknown(wq8);
  const hasAlternate = isYes(wq8);
  const wq9No = isNoOrUnknown(wq9);
  const alternateWeak = wq8No || (hasAlternate && wq9No);
  if (alternateWeak) {
    const evidenceList: EvidenceItem[] = [];
    if (wq8No) evidenceList.push(evidence('W_Q8', wq8));
    if (hasAlternate && wq9No) evidenceList.push(evidence('W_Q9', wq9));
    findings.push({
      id: wq8No ? 'W_NO_ALTERNATE_SOURCE' : 'W_ALTERNATE_INSUFFICIENT',
      title: wq8No ? 'No alternate water source' : 'Alternate water insufficient for core operations',
      narrative:
        wq8No
          ? 'The facility does not have an alternate/backup water source to use if primary water service is disrupted.'
          : 'The facility has an alternate water source, but it cannot support core operational needs during an extended disruption.',
      evidence: evidenceList,
      ofcText:
        'Consider evaluating whether an alternate source is needed for core operations during extended disruptions.',
    });
  }

  // 3) W_SINGLE_CONNECTION_NO_REDUNDANCY (single utility connection)
  const connCount = typeof answers.W_Q2_connection_count === 'number' ? answers.W_Q2_connection_count : null;
  if (answers.curve_requires_service === true && connCount !== null && connCount <= 1) {
    findings.push({
      id: 'W_SINGLE_CONNECTION_NO_REDUNDANCY',
      title: 'Single water connection with limited redundancy',
      narrative:
        'The facility reports one water service connection, which increases exposure to single-point service disruption if that connection or its route is unavailable.',
      evidence: [evidence('W_Q2', connCount)],
      ofcText:
        'Consider validating feasible options to reduce single-connection exposure for critical operations.',
    });
  }

  return findings.slice(0, 3); // cap at 3
}
