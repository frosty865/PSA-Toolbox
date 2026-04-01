import { VULN_TO_CITATION_IDS } from '@/app/lib/vuln/vuln_citation_map';
import { CITATIONS } from '@/app/lib/vuln/citations_registry';
import { QUESTION_VULN_MAP, type VulnTemplate } from '@/app/lib/vuln/question_vuln_map';

export type CuratedOfcSpec = { text: string; citation_id: string };
export type StandardOFC = CuratedOfcSpec & { mode: 'quote' | 'paraphrase'; source_excerpt: string };
export type StandardVulnerabilitySpec = { vuln_id: string; basis: string; basis_citation_ids: string[]; ofcs: StandardOFC[] };

const RAW_CURATED_OFCS_BY_VULN: Record<string, CuratedOfcSpec[]> = {
  ENERGY_FEED_DIVERSITY: [
    {
      text: 'Map each incoming electric feed, substation dependency, and facility entry point, then validate single-feed exposure through an annual utility coordination review.',
      citation_id: 'FEMA_CGC',
    },
    {
      text: 'Evaluate feasibility of a physically separated secondary service path or feeder arrangement for critical loads, including switching and isolation procedures.',
      citation_id: 'NFPA_1600',
    },
  ],
  ENERGY_BACKUP_ABSENT: [
    {
      text: 'Define emergency and standby power coverage for life safety and mission-critical loads, including minimum runtime objectives and transfer expectations.',
      citation_id: 'NFPA_110',
    },
    {
      text: 'Document backup-power operating procedures, restoration priorities, and outage decision points so operators can sustain critical functions during extended grid loss.',
      citation_id: 'FEMA_CGC',
    },
  ],
  ENERGY_BACKUP_SUSTAIN_TEST: [
    {
      text: 'Establish a recurring load-test schedule with acceptance criteria, and record test outcomes for transfer reliability, runtime, and load support.',
      citation_id: 'NFPA_110',
    },
    {
      text: 'Formalize fuel sustainment and resupply coordination for multi-day outages, including vendor contacts, delivery assumptions, and trigger thresholds.',
      citation_id: 'FEMA_CGC',
    },
  ],

  COMMS_DIVERSITY: [
    {
      text: 'Document communications service providers, transport paths, and entry points to identify concentration risk and cross-impact from shared routes.',
      citation_id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    },
    {
      text: 'Evaluate diversified communications architecture using distinct carriers or transport paths where feasible for critical communications functions.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  COMMS_ALTERNATE_CAPABILITY: [
    {
      text: 'Define alternate communications methods for core operations and emergency coordination, including activation conditions and operational limits.',
      citation_id: 'CISA_PUBLIC_SAFETY_COMMS_RESILIENCY',
    },
    {
      text: 'Exercise fallback communications procedures under degraded-service scenarios to confirm operator readiness and continuity effectiveness.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  COMMS_RESTORATION_REALISM: [
    {
      text: 'Document provider escalation paths and restoration expectations for high-impact outages affecting critical communications dependencies.',
      citation_id: 'FCC_TSP_PROGRAM',
    },
    {
      text: 'Evaluate eligibility and use of formal priority restoration mechanisms for qualifying critical communications services.',
      citation_id: 'CISA_TSP_SERVICE',
    },
  ],

  IT_PROVIDER_CONCENTRATION: [
    {
      text: 'Inventory externally hosted and managed IT dependencies by critical business function to identify single-provider concentration and outage impact scope.',
      citation_id: 'NIST_CSF',
    },
    {
      text: 'Evaluate provider diversification strategy for the highest-impact services, including migration constraints and recovery tradeoffs.',
      citation_id: 'ISO_22301',
    },
  ],
  IT_TRANSPORT_INDEPENDENCE_UNKNOWN: [
    {
      text: 'Document internet transport entry points, physical path attributes, and route-independence assumptions for each critical service dependency.',
      citation_id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    },
    {
      text: 'Coordinate with service providers to validate transport-path independence and update continuity plans with verified constraints.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  IT_TRANSPORT_DIVERSITY_RECORDED: [
    {
      text: 'Validate whether recorded carrier diversity is supported by independent building entry and upstream route diversity for critical services.',
      citation_id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    },
    {
      text: 'Maintain transport diversity documentation and review after provider/network changes to preserve continuity assumptions.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  IT_TRANSPORT_SINGLE_PATH: [
    {
      text: 'Prioritize independent internet transport options for critical externally hosted services where single-path loss creates immediate mission impact.',
      citation_id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    },
    {
      text: 'Define outage playbooks for transport-path failure, including service triage, provider escalation, and manual continuity steps.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  IT_HOSTED_VENDOR_NO_CONTINUITY: [
    {
      text: 'For each critical hosted service, define continuity mode during internet loss (local fallback, alternate platform, or validated manual procedure).',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Test hosted-service continuity assumptions through scenario exercises that include internet unavailability and provider-side outage conditions.',
      citation_id: 'NIST_CSF',
    },
  ],
  IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN: [
    {
      text: 'Establish and maintain a continuity assessment for each hosted service dependency, including impact tolerance and recovery expectations.',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Collect provider and internal evidence for continuity controls and validate that assumptions are reflected in incident response procedures.',
      citation_id: 'NIST_CSF',
    },
  ],
  IT_CONTINUITY_NOT_DEMONSTRATED: [
    {
      text: 'Schedule recurring IT continuity exercises and post-exercise corrective actions to verify readiness for prolonged external-service disruption.',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Integrate continuity test outcomes into incident response and recovery governance to reduce uncertainty during real events.',
      citation_id: 'NIST_CSF',
    },
  ],
  IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN: [
    {
      text: 'Verify whether multiple documented IT connections share conduit, entry, or upstream dependencies before treating them as independent resilience layers.',
      citation_id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    },
    {
      text: 'Update continuity assumptions and failure-scenario planning to reflect validated transport independence characteristics.',
      citation_id: 'FCC_CSRIC',
    },
  ],
  IT_HOSTED_SERVICES_NOT_IDENTIFIED: [
    {
      text: 'Document externally hosted services that support core operations, including ownership, dependency criticality, and outage impact assumptions.',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Maintain a service inventory review cycle so continuity procedures reflect current hosted-service dependencies.',
      citation_id: 'NIST_CSF',
    },
  ],
  IT_FALLBACK_CAPABILITY_INSUFFICIENT: [
    {
      text: 'Assess fallback operating levels against minimum continuity requirements for core services during external-service disruption.',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Run fallback exercises and update incident procedures based on observed recovery constraints.',
      citation_id: 'NIST_CSF',
    },
  ],
  IT_CONTINUITY_PLAN_NOT_EXERCISED: [
    {
      text: 'Schedule recurring continuity exercises for critical IT services and capture corrective actions from each exercise cycle.',
      citation_id: 'ISO_22301',
    },
    {
      text: 'Align IT recovery playbooks and governance checkpoints to outcomes from recent continuity exercises.',
      citation_id: 'NIST_CSF',
    },
  ],

  W_NO_PRIORITY_RESTORATION: [
    {
      text: 'Document water-provider restoration coordination expectations for essential operations, including contacts and escalation triggers.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Incorporate restoration-priority assumptions into facility continuity planning and exercise outage coordination workflows.',
      citation_id: 'FEMA_CGC',
    },
  ],
  W_NO_ALTERNATE_SOURCE: [
    {
      text: 'Define minimum water-service requirements for core operations and evaluate alternate source options for sustained disruption scenarios.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Plan operational continuity actions for water-supply loss, including duration assumptions, rationing priorities, and recovery sequencing.',
      citation_id: 'EPA_POWER_RESILIENCE_2023',
    },
  ],
  W_ALTERNATE_INSUFFICIENT: [
    {
      text: 'Assess alternate water source capacity against core operational demand to determine duration and service-level gaps during disruption.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Develop compensating continuity actions where alternate supply cannot sustain required operational levels.',
      citation_id: 'EPA_POWER_RESILIENCE_2023',
    },
  ],
  W_SINGLE_CONNECTION_NO_REDUNDANCY: [
    {
      text: 'Document single-connection dependency and known common-route constraints that could interrupt water delivery to critical operations.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Evaluate feasible service or routing diversification options to reduce single-connection outage exposure.',
      citation_id: 'FEMA_CGC',
    },
  ],

  WW_NO_PRIORITY_RESTORATION: [
    {
      text: 'Document wastewater-service restoration dependencies and provider coordination expectations for high-impact outage scenarios.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Integrate wastewater dependency constraints into continuity planning for prolonged utility disruption conditions.',
      citation_id: 'EPA_POWER_RESILIENCE_2023',
    },
  ],
  WW_SINGLE_CONNECTION_NO_REDUNDANCY: [
    {
      text: 'Document single-connection wastewater dependency and associated route/common-point constraints for continuity planning.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Evaluate practical discharge-path or service diversification options where feasible to reduce single-path interruption risk.',
      citation_id: 'FEMA_CGC',
    },
  ],
  WW_CONSTRAINTS_NOT_EVALUATED: [
    {
      text: 'Complete a wastewater disruption constraints review covering permit limits, temporary handling options, and decision thresholds.',
      citation_id: 'EPA_WATER_SECURITY',
    },
    {
      text: 'Integrate constraint-review outputs into continuity procedures, including escalation triggers for prolonged service disruption.',
      citation_id: 'NIST_CSF',
    },
  ],
};

function assertCitationExists(citationId: string, vulnId: string): void {
  if (!CITATIONS[citationId]) throw new Error(`Missing citation id "${citationId}" for vulnerability "${vulnId}".`);
}

function buildStandardSpec(vuln_id: string): StandardVulnerabilitySpec {
  const ofcs = RAW_CURATED_OFCS_BY_VULN[vuln_id] ?? [];
  if (ofcs.length < 2 || ofcs.length > 3) throw new Error(`Invalid curated OFC set for "${vuln_id}": ${ofcs.length}. Must be 2-3.`);
  const basis_citation_ids = VULN_TO_CITATION_IDS[vuln_id] ?? [];
  if (basis_citation_ids.length === 0) throw new Error(`Missing vulnerability documentation basis citations for "${vuln_id}".`);
  basis_citation_ids.forEach((id) => assertCitationExists(id, vuln_id));
  const normalizedOfcs: StandardOFC[] = ofcs.map((o, idx) => {
    assertCitationExists(o.citation_id, vuln_id);
    const text = (o.text ?? '').trim();
    if (!text) throw new Error(`Empty OFC text for "${vuln_id}".`);
    return {
      ...o,
      mode: 'paraphrase',
      source_excerpt: text,
    };
  });
  return {
    vuln_id,
    basis: `Condition-based vulnerability trigger validated against cited source guidance for ${vuln_id}.`,
    basis_citation_ids,
    ofcs: normalizedOfcs,
  };
}

function toTemplateStandardSpec(template: VulnTemplate): StandardVulnerabilitySpec {
  const vuln_id = (template.id ?? '').trim();
  if (!vuln_id) throw new Error('Template vulnerability id is required for standards registry.');
  const basis = (template.summary ?? '').trim();
  if (!basis) throw new Error(`Missing vulnerability basis summary in template "${vuln_id}".`);
  const basis_citation_ids = (template.citations ?? []).map((id) => String(id ?? '').trim()).filter(Boolean);
  if (basis_citation_ids.length === 0) {
    throw new Error(`Missing citations in template "${vuln_id}".`);
  }
  basis_citation_ids.forEach((id) => assertCitationExists(id, vuln_id));
  const ofcCandidates = (template.ofcs ?? [])
    .map((ofc) => (ofc.text ?? '').trim())
    .filter(Boolean)
    .slice(0, 3);
  if (ofcCandidates.length < 2) {
    throw new Error(`Template "${vuln_id}" must provide at least 2 OFCs.`);
  }
  const ofcs: StandardOFC[] = ofcCandidates.map((text, idx) => {
    const citation_id = basis_citation_ids[idx % basis_citation_ids.length];
    return {
      text,
      citation_id,
      mode: 'paraphrase',
      source_excerpt: text,
    };
  });
  return { vuln_id, basis, basis_citation_ids, ofcs };
}

function buildTemplateStandards(): Record<string, StandardVulnerabilitySpec> {
  const byVuln = new Map<string, VulnTemplate>();
  for (const templates of Object.values(QUESTION_VULN_MAP)) {
    for (const template of templates ?? []) {
      const id = (template.id ?? '').trim();
      if (!id || byVuln.has(id)) continue;
      byVuln.set(id, template);
    }
  }
  const out: Record<string, StandardVulnerabilitySpec> = {};
  for (const [id, template] of byVuln.entries()) {
    out[id] = toTemplateStandardSpec(template);
  }
  return out;
}

export const STANDARD_VOFC_BY_VULN: Record<string, StandardVulnerabilitySpec> = {
  ...buildTemplateStandards(),
  ...Object.fromEntries(
    Object.keys(RAW_CURATED_OFCS_BY_VULN).sort().map((vuln_id) => [vuln_id, buildStandardSpec(vuln_id)])
  ),
};

if (!STANDARD_VOFC_BY_VULN.IT_FALLBACK_AVAILABILITY && STANDARD_VOFC_BY_VULN.IT_FALLBACK_CAPABILITY_INSUFFICIENT) {
  STANDARD_VOFC_BY_VULN.IT_FALLBACK_AVAILABILITY = {
    ...STANDARD_VOFC_BY_VULN.IT_FALLBACK_CAPABILITY_INSUFFICIENT,
    vuln_id: 'IT_FALLBACK_AVAILABILITY',
  };
}

const VULN_ID_ALIASES: Record<string, string> = {
  ENERGY_STRUCT_SINGLE_SERVICE_FEED: 'ENERGY_FEED_DIVERSITY',
  ENERGY_CAP_NO_BACKUP_POWER: 'ENERGY_BACKUP_ABSENT',
  ENERGY_ACTIVATION_MANUAL_TRANSFER_OR_GEN: 'ENERGY_BACKUP_SUSTAIN_TEST',
  ENERGY_GOV_RESTORATION_PRIORITY_NOT_CONFIRMED: 'EP_NO_PRIORITY_RESTORATION',
  COMMS_STRUCT_SINGLE_CARRIER_OR_ENTRY: 'COMMS_DIVERSITY',
  COMMS_STRUCT_TERMINATION_NOT_PROTECTED: 'COMMS_DIVERSITY',
  COMMS_ACTIVATION_MANUAL_FAILOVER: 'COMMS_ALTERNATE_CAPABILITY',
  COMMS_GOV_RESTORATION_PRIORITY_NOT_DOCUMENTED: 'COMMS_RESTORATION_REALISM',
  'IT-TRANSPORT-01': 'IT_TRANSPORT_SINGLE_PATH',
  IT_STRUCT_SINGLE_EXTERNAL_CIRCUIT: 'IT_TRANSPORT_SINGLE_PATH',
  IT_STRUCT_PATH_DIVERSITY_NOT_CONFIRMED: 'IT_TRANSPORT_INDEPENDENCE_UNKNOWN',
  'IT-BACKUP-01': 'IT_FALLBACK_CAPABILITY_INSUFFICIENT',
  IT_GOV_PROVIDER_RESTORATION_NOT_DOCUMENTED: 'IT_NO_RESTORATION_COORDINATION',
  WATER_STRUCT_SINGLE_SERVICE_CONNECTION: 'W_SINGLE_CONNECTION_NO_REDUNDANCY',
  WATER_CAP_NO_ALTERNATE_SOURCE: 'W_NO_ALTERNATE_SOURCE',
  WATER_ACTIVATION_MANUAL_ALT_SOURCE: 'W_ALTERNATE_INSUFFICIENT',
  WATER_GOV_RESTORATION_PRIORITY_NOT_CONFIRMED: 'W_NO_PRIORITY_RESTORATION',
  WW_STRUCT_SINGLE_CONNECTION: 'WW_SINGLE_CONNECTION_NO_REDUNDANCY',
  WW_CAP_NO_ALTERNATE: 'WW_CONSTRAINTS_NOT_EVALUATED',
  WW_ACTIVATION_MANUAL: 'WW_CONSTRAINTS_NOT_EVALUATED',
  WW_GOV_RESTORATION_PRIORITY: 'WW_NO_PRIORITY_RESTORATION',
};

const PRA_SLA_SCOPED_VULN_IDS = new Set<string>([
  'EP_NO_PRIORITY_RESTORATION',
  'W_NO_PRIORITY_RESTORATION',
  'WW_NO_PRIORITY_RESTORATION',
  'IT_NO_RESTORATION_COORDINATION',
  'COMM_NO_PRIORITY_RESTORATION',
  'COMMS_NO_TSP_PRIORITY_RESTORATION',
  'COMMS_RESTORATION_REALISM',
]);

function resolveAlias(vulnId: string): string {
  const direct = VULN_ID_ALIASES[vulnId];
  if (direct) return direct;
  if (vulnId.startsWith('COND_ELECTRIC_POWER_')) {
    if (vulnId.includes('_RESTORATION')) return 'EP_NO_PRIORITY_RESTORATION';
    if (vulnId.includes('_NO_ALTERNATE') || vulnId.includes('_ALTERNATE_')) return 'ENERGY_BACKUP_ABSENT';
    return 'ENERGY_FEED_DIVERSITY';
  }
  if (vulnId.startsWith('COND_COMMUNICATIONS_')) {
    if (vulnId.includes('_RESTORATION')) return 'COMMS_RESTORATION_REALISM';
    if (vulnId.includes('_NO_ALTERNATE') || vulnId.includes('_ALTERNATE_')) return 'COMMS_ALTERNATE_CAPABILITY';
    return 'COMMS_DIVERSITY';
  }
  if (vulnId.startsWith('COND_INFORMATION_TECHNOLOGY_')) {
    if (vulnId.includes('_RESTORATION')) return 'IT_NO_RESTORATION_COORDINATION';
    if (vulnId.includes('_NO_ALTERNATE') || vulnId.includes('_ALTERNATE_')) return 'IT_FALLBACK_CAPABILITY_INSUFFICIENT';
    if (vulnId.includes('_SINGLE_PATH')) return 'IT_TRANSPORT_SINGLE_PATH';
    if (vulnId.includes('_HOSTED_CONTINUITY_UNKNOWN')) return 'IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN';
    if (vulnId.includes('_HOSTED_CONTINUITY_WEAKNESS')) return 'IT_HOSTED_VENDOR_NO_CONTINUITY';
    return 'IT_PROVIDER_CONCENTRATION';
  }
  if (vulnId.startsWith('COND_WATER_')) {
    if (vulnId.includes('_RESTORATION')) return 'W_NO_PRIORITY_RESTORATION';
    if (vulnId.includes('_NO_ALTERNATE') || vulnId.includes('_ALTERNATE_')) return 'W_NO_ALTERNATE_SOURCE';
    return 'W_SINGLE_CONNECTION_NO_REDUNDANCY';
  }
  if (vulnId.startsWith('COND_WASTEWATER_')) {
    if (vulnId.includes('_RESTORATION')) return 'WW_NO_PRIORITY_RESTORATION';
    if (vulnId.includes('_NO_ALTERNATE') || vulnId.includes('_ALTERNATE_')) return 'WW_CONSTRAINTS_NOT_EVALUATED';
    return 'WW_SINGLE_CONNECTION_NO_REDUNDANCY';
  }
  if (vulnId.startsWith('COND_INFORMATION_TECHNOLOGY_HOSTED_CONTINUITY_')) {
    if (vulnId.endsWith('UNKNOWN')) return 'IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN';
    if (vulnId.endsWith('WEAKNESS')) return 'IT_HOSTED_VENDOR_NO_CONTINUITY';
  }
  if (vulnId.startsWith('COND_INFORMATION_TECHNOLOGY_SINGLE_PATH_')) return 'IT_TRANSPORT_SINGLE_PATH';
  if (vulnId.startsWith('COND_COMMUNICATIONS_PACE_')) return 'COMMS_ALTERNATE_CAPABILITY';
  return vulnId;
}

export function resolveStandardVulnerabilityId(vulnId: string): string {
  return resolveAlias((vulnId ?? '').trim());
}

export function isPraSlaScopedVulnerability(vulnId: string): boolean {
  const resolvedId = resolveStandardVulnerabilityId(vulnId);
  return PRA_SLA_SCOPED_VULN_IDS.has(resolvedId);
}

export function getStandardVulnerability(vulnId: string): StandardVulnerabilitySpec {
  const id = (vulnId ?? '').trim();
  const resolvedId = resolveStandardVulnerabilityId(id);
  const spec = STANDARD_VOFC_BY_VULN[resolvedId];
  if (!spec) throw new Error(`Uncurated vulnerability rejected: ${id || '(unknown)'}. Rebuild required in STANDARD_VOFC_BY_VULN.`);
  return spec;
}
