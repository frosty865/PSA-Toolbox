import type { Assessment, CategoryCode, VOFC, VOFCCollection } from 'schema';
import { buildCanonicalVulnBlocks } from '@/app/lib/export/canonical_vuln_blocks';
import {
  buildReportThemedFindingsForExport,
  buildSessionsDerivedFromAssessment,
} from '@/app/lib/export/build_report_themed_findings';
import { CITATIONS, type Citation } from '@/app/lib/vuln/citations_registry';
import { VULN_TO_CITATION_IDS } from '@/app/lib/vuln/vuln_citation_map';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

const CATEGORY_CODES = new Set<CategoryCode>([
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
]);

const TOOL_VERSION_FALLBACK = '0.1.0';
export type CuratedOfcSpec = { text: string; citation_id: string };
const PRA_SLA_SCOPED_VULN_IDS = new Set<string>([
  'EP_NO_PRIORITY_RESTORATION',
  'W_NO_PRIORITY_RESTORATION',
  'WW_NO_PRIORITY_RESTORATION',
  'IT_NO_RESTORATION_COORDINATION',
  'COMM_NO_PRIORITY_RESTORATION',
  'COMMS_NO_TSP_PRIORITY_RESTORATION',
  'COMMS_RESTORATION_REALISM',
]);
export const CURATED_OFCS_BY_VULN: Record<string, CuratedOfcSpec[]> = {
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

function cloneAssessment(assessment: Assessment): Assessment {
  const g = globalThis as { structuredClone?: <T>(value: T) => T };
  if (typeof g.structuredClone === 'function') {
    return g.structuredClone(assessment);
  }
  return JSON.parse(JSON.stringify(assessment)) as Assessment;
}

function toSeverity(
  severity: string | undefined
): VOFC['base_severity'] {
  if (severity === 'HIGH') return 'HIGH';
  if (severity === 'LOW') return 'LOW';
  return 'MODERATE';
}

function sanitizeIdPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'UNSPECIFIED';
}

function sortForDoctrine(a: VOFC, b: VOFC): number {
  const rank = (s: VOFC['base_severity']) => (s === 'HIGH' ? 0 : s === 'MODERATE' ? 1 : 2);
  const bySeverity = rank(a.base_severity) - rank(b.base_severity);
  if (bySeverity !== 0) return bySeverity;
  return a.vofc_id.localeCompare(b.vofc_id);
}

function getCitationsForVulnerability(vulnId: string): Citation[] {
  const ids = VULN_TO_CITATION_IDS[vulnId];
  if (!ids || ids.length === 0) return [];
  return ids.map((id) => {
    const citation = CITATIONS[id];
    if (!citation) {
      throw new Error(`Citation id "${id}" not found in citations registry for vulnerability "${vulnId}".`);
    }
    return citation;
  });
}

function getCuratedOfcsForVulnerability(vulnId: string): Array<{ text: string; citation: Citation }> {
  const curated = CURATED_OFCS_BY_VULN[vulnId];
  if (!Array.isArray(curated)) return [];
  if (curated.length < 2 || curated.length > 3) {
    throw new Error(`Invalid curated OFC set for "${vulnId}". Each vulnerability must have at least 2 and fewer than 4 OFCs.`);
  }
  return curated.map((item) => {
    const citation = CITATIONS[item.citation_id];
    if (!citation) {
      throw new Error(`Citation id "${item.citation_id}" not found for vulnerability "${vulnId}".`);
    }
    const text = (item.text ?? '').trim();
    if (!text) {
      throw new Error(`Empty curated OFC text for vulnerability "${vulnId}".`);
    }
    return { text, citation };
  });
}

function splitCanonicalOfcs(ofcText: string): string[] {
  return (ofcText ?? '')
    .replace(/\u00a0/g, ' ')
    .split(/\n+|[\u2022\u2023]\s*|(?:\d+\.)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPraSlaScopedVulnerability(vulnId: string): boolean {
  return PRA_SLA_SCOPED_VULN_IDS.has((vulnId ?? '').trim());
}

/**
 * Build VOFC collection from in-app derived findings (report pipeline), not workbook/library rows.
 * This keeps VOFC output aligned with the current condition-trigger logic and displayed report findings.
 */
export function buildVofcCollectionFromAssessment(assessment: Assessment): VOFCCollection {
  const working = cloneAssessment(assessment);
  const praSlaEnabled = isPraSlaEnabled(working);
  buildReportThemedFindingsForExport(working);
  buildSessionsDerivedFromAssessment(working);
  const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(working);

  const grouped = new Map<CategoryCode, VOFC[]>();

  const eligibleBlocks = canonicalVulnBlocks.filter(
    (block) => praSlaEnabled || !isPraSlaScopedVulnerability(block.vuln_id)
  );
  for (const block of eligibleBlocks) {
    const category = block.domain as CategoryCode;
    if (!CATEGORY_CODES.has(category)) continue;

    const baseSeverity = toSeverity(block.severity);
    const title = (block.title ?? '').trim() || block.vuln_id || 'Untitled vulnerability';
    const vulnerability = (block.narrative ?? '').trim() || title;
    const vulnIdPart = sanitizeIdPart(block.vuln_id || title);
    const vulnId = (block.vuln_id ?? '').trim();
    const vulnCitations = getCitationsForVulnerability(vulnId);
    const curatedOfcs = getCuratedOfcsForVulnerability(vulnId);
    const canonicalOfcs = splitCanonicalOfcs(block.ofcText ?? '');
    const selectedOfcs =
      curatedOfcs.length > 0
        ? curatedOfcs.map((o) => ({ text: o.text, citation: o.citation }))
        : canonicalOfcs.map((text, idx) => ({ text, citation: vulnCitations[idx] ?? vulnCitations[0] }));

    if (selectedOfcs.length < 2 || selectedOfcs.length > 3) {
      throw new Error(
        `Invalid OFC set for "${vulnId || title}": ${selectedOfcs.length}. Each vulnerability must have at least 2 and fewer than 4 OFCs.`
      );
    }

    const current = grouped.get(category) ?? [];

    for (let i = 0; i < selectedOfcs.length; i++) {
      const ofc = selectedOfcs[i];
      const hasSource = /\(\s*Source\s*:/i.test(ofc.text);
      const sourcedOfcText = hasSource
        ? ofc.text
        : ofc.citation
          ? `${ofc.text} (Source: ${ofc.citation.title} — ${ofc.citation.url})`
          : (() => {
              throw new Error(`Missing source citation for vulnerability "${vulnId || title}" OFC #${i + 1}.`);
            })();
      current.push({
        vofc_id: `${category}::${vulnIdPart}::${i + 1}`,
        category,
        title,
        vulnerability,
        impact: null,
        option_for_consideration: sourcedOfcText,
        base_severity: baseSeverity,
        calibrated_severity: baseSeverity,
        calibration_reason: null,
        applicability: 'POTENTIAL',
        origin: 'SOURCE',
        source_ref: ofc.citation?.url,
        source_registry_id: ofc.citation?.id,
        source_publisher: ofc.citation?.publisher,
        source_tier: ofc.citation ? 1 : undefined,
      });
    }

    grouped.set(category, current);
  }

  const items: VOFC[] = [];
  for (const category of grouped.keys()) {
    const rows = grouped.get(category) ?? [];
    rows.sort(sortForDoctrine);
    items.push(...rows);
  }

  return {
    generated_at_iso: new Date().toISOString(),
    tool_version: assessment.meta?.tool_version ?? TOOL_VERSION_FALLBACK,
    items,
  };
}
