/**
 * Theme combiner for Information Technology (externally hosted/managed services).
 * Returns up to 3 themed findings.
 * Physical transport: provider diversity ≠ path diversity ≠ route independence. Do not infer from provider count.
 */
import type { EvidenceItem, ThemedFinding, ThemeResolverInput } from '../themeTypes';
import { isNoOrUnknown, isYes } from '../themeUtils';
import { describeTransportConcentration, getTransportConcentrationInput } from '@/app/lib/report/transport_concentration';

function evidence(qid: string, answer?: unknown): EvidenceItem {
  return { question_id: qid, answer: answer as string | boolean | undefined };
}

type ItCategoryInput = {
  supply?: { has_alternate_source?: boolean; sources?: unknown[] };
  it_transport_resilience?: {
    circuit_count?: string;
    carrier_diversity?: string;
    building_entry_diversity?: string;
    physical_path_diversity?: { unknown?: boolean };
  };
  it_hosted_resilience?: Record<string, { survivability?: string }>;
};

export function resolveItThemes(input: ThemeResolverInput): ThemedFinding[] {
  const { answers } = input;
  const findings: ThemedFinding[] = [];
  const categoryInput = input.categoryInput as ItCategoryInput | undefined;
  const hasAlternateSource = categoryInput?.supply?.has_alternate_source === true;
  const transportResilience = categoryInput?.it_transport_resilience;
  const carrierDiversity = transportResilience?.carrier_diversity;
  const buildingEntryDiversity = transportResilience?.building_entry_diversity;
  const pathDiversityUnknown = transportResilience?.physical_path_diversity?.unknown === true;

  // 1a) When IT-3 = yes (multiple connections): do NOT claim concentration. Use traceable narrative only.
  const it3 = answers['IT-3_multiple_connections'];
  if (it3 === 'yes') {
    findings.push({
      id: 'IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN',
      title: 'Multiple IT connections with unverified independence',
      narrative:
        'Multiple IT connections are present, but route, entry, and upstream independence are unverified. Treat these links as potentially shared-failure exposure until independence is confirmed.',
      evidence: [evidence('IT-3_multiple_connections', it3)],
      ofcText:
        'Verify physical separation and route independence for each connection, or implement an alternate transport path that is demonstrably independent.',
    });
  }

  // 1b) IT_PROVIDER_CONCENTRATION — only when single provider/path and data does NOT show multiple carriers/alternate. Otherwise use "Transport independence attributes recorded as UNKNOWN."
  const it1 = answers['IT-1_can_identify_providers'];
  const it3SingleOrUnknown = it3 === 'no' || it3 === 'unknown' || it3 == null;
  const dataSupportsConcentration = !hasAlternateSource && carrierDiversity !== 'DIFFERENT_CARRIERS';
  if ((isNoOrUnknown(it1) || it3SingleOrUnknown) && it3 !== 'yes') {
    if (dataSupportsConcentration) {
      const evidenceList: EvidenceItem[] = [];
      if (isNoOrUnknown(it1)) evidenceList.push(evidence('IT-1', it1));
      if (it3SingleOrUnknown) evidenceList.push(evidence('IT-3_multiple_connections', it3));
      findings.push({
        id: 'IT_PROVIDER_CONCENTRATION',
        title: 'External IT provider dependency is concentrated',
        narrative:
          'Assessment inputs indicate a single provider/path concentration and unresolved transport independence. A single external failure can disrupt multiple critical IT services.',
        evidence: evidenceList,
        ofcText:
          'Evaluate the feasibility of diversifying external IT provider/platform dependencies to reduce single-point-of-failure risk.',
      });
    } else {
      const indEvidence: EvidenceItem[] = [];
      if (hasAlternateSource) indEvidence.push(evidence('supply.has_alternate_source', true));
      if (carrierDiversity === 'DIFFERENT_CARRIERS') indEvidence.push(evidence('it_transport_resilience.carrier_diversity', carrierDiversity));
      if (indEvidence.length === 0) indEvidence.push(evidence('it_transport_resilience', 'independence not documented'));
      findings.push({
        id: 'IT_TRANSPORT_INDEPENDENCE_UNKNOWN',
        title: 'Transport independence remains unknown',
        narrative: 'Transport independence is unresolved for one or more critical links, so common-cause failure cannot be excluded.',
        evidence: indEvidence,
        ofcText:
          'Confirm physical path diversity and route independence for transport circuits and update continuity assumptions to match verified constraints.',
      });
    }
  }

  // 2a) Transport: use ONLY physical fields for concentration. Do not infer path from provider count.
  const transportInput = getTransportConcentrationInput(input.categoryInput as Record<string, unknown>);
  const concentrationSentence = describeTransportConcentration(transportInput);
  const circuitOne = transportResilience?.circuit_count === 'ONE';
  const useTransportTemplate =
    carrierDiversity === 'DIFFERENT_CARRIERS' &&
    buildingEntryDiversity === 'SAME_ENTRY' &&
    pathDiversityUnknown === true;

  if (useTransportTemplate) {
    findings.push({
      id: 'IT_TRANSPORT_DIVERSITY_RECORDED',
      title: 'Transport diversity recorded; path diversity unknown',
      narrative:
        'Two transport circuits are present with different carriers; however, both routes enter through the same building entry and physical path diversity remains unknown.',
      evidence: [
        evidence('it_transport_resilience.carrier_diversity', carrierDiversity),
        evidence('it_transport_resilience.building_entry_diversity', buildingEntryDiversity),
        evidence('it_transport_resilience.physical_path_diversity', { unknown: true }),
      ],
      ofcText:
        'Validate route independence beyond carrier count, including building entry, conduit separation, and upstream POP diversity.',
    });
  } else if (concentrationSentence !== null || circuitOne) {
    const evidenceList: EvidenceItem[] = [];
    if (circuitOne) evidenceList.push(evidence('it_transport_resilience', { circuit_count: 'ONE' }));
    if (concentrationSentence && !circuitOne) evidenceList.push(evidence('it_transport_resilience', 'route/entry not documented'));
    findings.push({
      id: 'IT_TRANSPORT_SINGLE_PATH',
      title: 'Internet transport has single path or limited diversity',
      narrative: concentrationSentence ?? 'Internet transport loss would isolate cloud-based services regardless of cloud-side redundancy. This finding evaluates physical transport resilience (carriers, circuits, diversity) only.',
      evidence: evidenceList,
      ofcText:
        'Evaluate alternate transport path or carrier diversity for internet connectivity; do not conflate with hosted service continuity (internet loss impact), which is evaluated in IT.',
    });
  }

  // 2b) IT hosted continuity — internet connectivity loss (per-service survivability when hosted services unreachable). Transport/ISP evaluated in Communications only.
  const hostedResilience = categoryInput?.it_hosted_resilience ?? {};
  const assets = (input.answers['IT-2_upstream_assets'] as Array<{ service_id?: string; service_other?: string }>) ?? [];
  const anyHostedNoContinuity = assets.some((row) => {
    const sid = (row.service_id ?? '').toString().trim();
    if (!sid) return false;
    const key = sid.toLowerCase() === 'other' ? `other_${(row.service_other ?? '').toString().trim() || 'other'}` : sid;
    const surv = hostedResilience[key]?.survivability;
    return surv === 'NO_CONTINUITY' || surv === 'NONE';
  });
  const anyHostedUnknown = assets.some((row) => {
    const sid = (row.service_id ?? '').toString().trim();
    if (!sid) return false;
    const key = sid.toLowerCase() === 'other' ? `other_${(row.service_other ?? '').toString().trim() || 'other'}` : sid;
    return hostedResilience[key]?.survivability === 'UNKNOWN';
  });
  if (assets.length > 0 && anyHostedNoContinuity) {
    findings.push({
      id: 'IT_HOSTED_VENDOR_NO_CONTINUITY',
      title: 'Hosted service has no continuity when internet is lost',
      narrative:
        'The facility relies on externally hosted services that require internet connectivity. Loss of internet connectivity would render these systems inaccessible and disrupt operations. One or more hosted dependencies have no continuity (no local backup, alternate path, or validated fallback).',
      evidence: [evidence('it_hosted_resilience', 'one or more hosted services have no continuity')],
      ofcText:
        'Evaluate per-service continuity when internet connectivity is lost and the hosted service cannot be reached: alternate provider, local mirror, or validated manual fallback.',
    });
  }
  if (assets.length > 0 && anyHostedUnknown && !anyHostedNoContinuity) {
    findings.push({
      id: 'IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN',
      title: 'Hosted service continuity not evaluated',
      narrative:
        'Continuity behavior during internet loss is unknown for one or more hosted services, leaving outage impact and recovery sequence uncertain.',
      evidence: [evidence('it_hosted_resilience', 'one or more hosted services have survivability unknown')],
      ofcText:
        'Evaluate per-service continuity during internet loss and validate recovery steps for each critical hosted dependency.',
    });
  }

  // 3) IT_CONTINUITY_NOT_DEMONSTRATED — plan exercising only (IT-8/9/10 removed)
  const planExercised = answers['it_plan_exercised'];
  const planExists = answers['it_continuity_plan_exists'];
  const exercisedNo =
    planExercised === 'no' ||
    planExercised === 'unknown' ||
    planExercised === 'yes_over_12_months_ago' ||
    planExercised == null;
  const planNotExercised = isYes(planExists) && exercisedNo;
  if (planNotExercised) {
    findings.push({
      id: 'IT_CONTINUITY_NOT_DEMONSTRATED',
      title: 'Continuity readiness is not demonstrated',
      narrative:
        'Continuity procedures for prolonged external IT disruption have not been tested or exercised. This increases recovery time due to unvalidated assumptions and unclear execution steps.',
      evidence: [evidence('it_plan_exercised', planExercised)],
      ofcText:
        'Establish and maintain a routine testing or exercise schedule for backup IT systems and continuity plans to verify they function as intended when needed.',
    });
  }

  return findings;
}
