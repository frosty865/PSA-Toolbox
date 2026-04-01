import {
  type DependencyTopicKey,
  type MappedVulnerability,
  type PriorityRestoration,
  type PriorityRestorationTopic,
  type SlaFailureFlagKey,
  type SlaCategorization,
  isNoEvidenceSelected,
  topicAnchorPrefix,
  topicLabel,
  SLA_FAILURE_FLAG_KEYS,
  getDefaultSlaFailureFlags,
  slaAssessed,
} from '@/app/lib/asset-dependency/priorityRestorationSchema';

type Pair = {
  topic: DependencyTopicKey;
  value: PriorityRestorationTopic;
};

function humanServiceName(topic: DependencyTopicKey): string {
  switch (topic) {
    case 'energy':
      return 'electric power service';
    case 'communications':
      return 'communications services';
    case 'information_technology':
      return 'information technology services';
    case 'water':
      return 'water service';
    case 'wastewater':
      return 'wastewater service';
  }
}

function buildUnknownUndocumentedVuln(
  topic: DependencyTopicKey,
  artifactType: 'PRA' | 'SLA'
): MappedVulnerability {
  const baseAnchor = topicAnchorPrefix(topic);

  if (artifactType === 'PRA') {
    return {
      topic,
      artifact_type: 'PRA',
      anchor_id: `${baseAnchor}-pra`,
      vulnerability_text: `The facility's priority restoration status for ${humanServiceName(topic)} is unknown or undocumented, which may delay restoration planning, escalation, and continuity decisions during an outage.`,
      ofc_stubs: [
        'Coordinate with the service provider to confirm whether the facility is eligible for priority restoration and document the basis for that determination.',
        'Document restoration escalation points of contact and include priority restoration assumptions in continuity planning and incident procedures.',
      ],
    };
  }

  return {
    topic,
    artifact_type: 'SLA',
    anchor_id: `${baseAnchor}-sla`,
    vulnerability_text: `The facility does not have documented service commitments for ${humanServiceName(topic)} (e.g., response/restoration expectations or escalation procedures), limiting the ability to plan around predictable outage durations.`,
    ofc_stubs: [
      'Identify and document any available service commitments, escalation procedures, and restoration expectations for the supporting service(s), and ensure they are accessible to responsible personnel.',
      'Establish an internal process to periodically review and update service commitment documentation and associated continuity assumptions.',
    ],
  };
}

function buildNoSlaDocumentedVuln(topic: DependencyTopicKey): MappedVulnerability {
  const baseAnchor = topicAnchorPrefix(topic);
  return {
    topic,
    artifact_type: 'SLA',
    anchor_id: `${baseAnchor}-sla`,
    vulnerability_text: `No documented service level agreement or service commitment for ${humanServiceName(topic)} was identified, limiting the ability to plan around predictable outage durations.`,
    ofc_stubs: [
      'Document whether any service commitments exist and how restoration expectations are communicated.',
      'If commitments exist, capture and make them accessible to responsible personnel.',
    ],
  };
}

/** Map SlaCategorization reliability field to SlaFailureFlagKey for vulnerability text. */
const SLA_CAT_TO_FLAG: Array<{ key: keyof SlaCategorization; flagKey: SlaFailureFlagKey }> = [
  { key: 'applies_in_widespread_events', flagKey: 'regional_applicability' },
  { key: 'clock_trigger_defined', flagKey: 'clock_defined' },
  { key: 'activation_required_documented', flagKey: 'activation_required_documented' },
  { key: 'escalation_path_documented', flagKey: 'escalation_defined' },
  { key: 'full_component_coverage', flagKey: 'full_component_coverage' },
  { key: 'restoration_validation_defined', flagKey: 'restoration_validation_defined' },
  { key: 'documentation_accessible', flagKey: 'documentation_accessible' },
];

function buildSlaMttrMissingVuln(topic: DependencyTopicKey): MappedVulnerability {
  const baseAnchor = topicAnchorPrefix(topic);
  return {
    topic,
    artifact_type: 'SLA',
    anchor_id: `${baseAnchor}-sla-mttr-missing`,
    vulnerability_text: `A service commitment is reported/documented for ${humanServiceName(topic)}; however, the SLA-defined maximum time to restoration is not captured or verifiable in assessment documentation, limiting outage planning and operational decision-making.`,
    ofc_stubs: [
      'Capture the SLA-defined maximum time to restoration from the service commitment documentation and ensure it is accessible to responsible personnel.',
      'Document escalation procedures and any conditions/exclusions that materially affect restoration expectations.',
    ],
  };
}

/** Vulnerability text and OFC stubs per SLA failure flag (documentation/clarification/validation focus). */
const SLA_FLAG_VULN: Record<
  SlaFailureFlagKey,
  { vulnerability_text: string; ofc_stubs: string[] }
> = {
  regional_applicability: {
    vulnerability_text: 'The service commitment for this dependency does not clearly document regional applicability or scope, which may affect restoration expectations during widespread events.',
    ofc_stubs: [
      'Clarify and document whether the commitment applies across all service regions and under what conditions.',
      'Ensure regional assumptions are documented and accessible for continuity planning.',
    ],
  },
  clock_defined: {
    vulnerability_text: 'The service commitment does not clearly define when the restoration clock starts or stops, creating uncertainty for outage planning and validation.',
    ofc_stubs: [
      'Document how start and stop times for restoration commitments are defined and verified.',
      'Align internal tracking with documented clock definitions for validation.',
    ],
  },
  activation_required_documented: {
    vulnerability_text: 'Activation or trigger requirements for the service commitment are not documented, which may delay or complicate invocation during an outage.',
    ofc_stubs: [
      'Document any activation, declaration, or trigger requirements from the service commitment.',
      'Ensure responsible personnel know how and when to invoke the commitment.',
    ],
  },
  escalation_defined: {
    vulnerability_text: 'Escalation path for the service commitment is not clearly defined or documented, limiting effective follow-up during extended outages.',
    ofc_stubs: [
      'Document escalation contacts, steps, and expected response times from the commitment.',
      'Include escalation procedures in incident and continuity runbooks.',
    ],
  },
  full_component_coverage: {
    vulnerability_text: 'The scope of components or services covered by the commitment is not fully documented, which may leave gaps in restoration expectations.',
    ofc_stubs: [
      'Document which components, circuits, or services are in scope for the commitment.',
      'Identify and document any exclusions or limitations that affect restoration planning.',
    ],
  },
  restoration_validation_defined: {
    vulnerability_text: 'How restoration is validated or confirmed is not defined in the documentation, making it difficult to verify that commitments were met.',
    ofc_stubs: [
      'Document how restoration completion is defined and validated (e.g., testing, confirmation).',
      'Establish internal criteria to verify restoration against documented expectations.',
    ],
  },
  tolerance_reviewed: {
    vulnerability_text: 'Tolerances, exclusions, or conditions that affect the commitment have not been reviewed and documented, which may affect restoration during high-impact events.',
    ofc_stubs: [
      'Review and document any exclusions, force majeure, or conditions that limit the commitment.',
      'Ensure tolerance assumptions are reflected in continuity and outage planning.',
    ],
  },
  documentation_accessible: {
    vulnerability_text: 'Service commitment documentation is not confirmed as accessible to responsible personnel, which may delay response or escalation during an outage.',
    ofc_stubs: [
      'Confirm that commitment documentation is stored where incident and continuity staff can access it.',
      'Establish a process to periodically verify accessibility and update references.',
    ],
  },
};

function buildSlaFailureFlagVuln(topic: DependencyTopicKey, flagKey: SlaFailureFlagKey): MappedVulnerability {
  const baseAnchor = topicAnchorPrefix(topic);
  const copy = SLA_FLAG_VULN[flagKey];
  return {
    topic,
    artifact_type: 'SLA',
    anchor_id: `${baseAnchor}-sla-flag-${flagKey}`,
    vulnerability_text: copy.vulnerability_text,
    ofc_stubs: copy.ofc_stubs,
  };
}

/**
 * Map priority restoration / SLA data to findings only when we have collected data.
 * Do not emit "unknown or undocumented" for topics where no evidence was selected—
 * that would be inferring a vulnerability from uncollected data (a guess, not a fact).
 */
export function autoMapPriorityRestorationFindings(
  priority: PriorityRestoration
): MappedVulnerability[] {
  const pairs: Pair[] = [
    { topic: 'energy', value: priority.energy },
    { topic: 'communications', value: priority.communications },
    { topic: 'information_technology', value: priority.information_technology },
    { topic: 'water', value: priority.water },
    { topic: 'wastewater', value: priority.wastewater },
  ];

  const out: MappedVulnerability[] = [];

  for (const { topic, value } of pairs) {
    const sc = value.sla_categorization;

    if (sc && slaAssessed(sc)) {
      if (sc.sla_in_place === 'NO') {
        out.push(buildNoSlaDocumentedVuln(topic));
      } else if (sc.sla_in_place === 'UNKNOWN') {
        out.push(buildUnknownUndocumentedVuln(topic, 'SLA'));
      } else if (sc.sla_in_place === 'YES') {
        if (sc.mttr_max_hours == null || !Number.isFinite(sc.mttr_max_hours) || sc.mttr_max_hours <= 0) {
          out.push(buildSlaMttrMissingVuln(topic));
        }
        for (const { key, flagKey } of SLA_CAT_TO_FLAG) {
          const v = sc[key];
          if (v === 'NO' || v === 'UNKNOWN') {
            out.push(buildSlaFailureFlagVuln(topic, flagKey));
          }
        }
      }
    } else {
      // When isNoEvidenceSelected(value): we did not collect PRA/SLA status—do not emit
      // "unknown/undocumented" findings (that would be a guess, not a fact).
      if (value.paid_sla === true && (value.sla_mttr_max_hours === null || !Number.isFinite(value.sla_mttr_max_hours))) {
        out.push(buildSlaMttrMissingVuln(topic));
      }
      if (value.paid_sla === true) {
        const flags = value.sla_failure_flags ?? getDefaultSlaFailureFlags();
        for (const flagKey of SLA_FAILURE_FLAG_KEYS) {
          const v = flags[flagKey];
          if (v === 'no' || v === 'unknown') {
            out.push(buildSlaFailureFlagVuln(topic, flagKey));
          }
        }
      }
    }
  }

  return out;
}

/**
 * Merge mapped findings into an existing list without duplicates.
 * Dedupe key: topic + artifact_type + vulnerability_text
 */
export function mergeMappedFindings(
  existing: MappedVulnerability[],
  mapped: MappedVulnerability[]
): MappedVulnerability[] {
  const seen = new Set(
    existing.map((v) => `${v.topic}|${v.artifact_type}|${v.vulnerability_text}`)
  );
  const merged = [...existing];

  for (const v of mapped) {
    const key = `${v.topic}|${v.artifact_type}|${v.vulnerability_text}`;
    if (!seen.has(key)) {
      merged.push(v);
      seen.add(key);
    }
  }
  return merged;
}

/** Display row shape for use in a vulnerability table (e.g. alongside VOFC rows). */
export type MappedVulnerabilityDisplayRow = {
  id: string;
  category: string;
  vulnerability: string;
  option_for_consideration: string;
  source: 'priority_restoration';
  artifact_type: 'PRA' | 'SLA';
};

/**
 * Convert MappedVulnerability[] to table-ready rows. Use when rendering in the same
 * vulnerability table as VOFC items (e.g. Review & Export).
 */
export function mappedFindingsToDisplayRows(mapped: MappedVulnerability[]): MappedVulnerabilityDisplayRow[] {
  return mapped.map((v) => ({
    id: v.anchor_id ?? `${v.topic}-${v.artifact_type}`,
    category: topicLabel(v.topic),
    vulnerability: v.vulnerability_text,
    option_for_consideration: v.ofc_stubs.join(' '),
    source: 'priority_restoration',
    artifact_type: v.artifact_type,
  }));
}
