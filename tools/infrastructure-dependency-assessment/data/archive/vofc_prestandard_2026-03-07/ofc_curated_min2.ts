/**
 * Curated OFC supplements to guarantee minimum actionable coverage per vulnerability.
 * Source of truth is curated project content; do not auto-generate or hallucinate entries.
 */

export const CURATED_MIN2_OFCS: Record<string, string[]> = {
  ENERGY_FEED_DIVERSITY: [
    'Document utility feed paths, entry points, and known shared-route constraints with the provider.',
    'Evaluate feasibility of physically separated alternate feed routing for critical operations.',
  ],
  ENERGY_BACKUP_ABSENT: [
    'Assess backup power options sized for critical operations, including required runtime objectives.',
    'Document operational load-shed priorities to sustain core functions during extended grid disruption.',
  ],
  ENERGY_BACKUP_SUSTAIN_TEST: [
    'Establish refuel and sustainment logistics for backup power under multi-day outage conditions.',
    'Run periodic under-load tests and capture corrective actions for backup system reliability.',
  ],
  COMMS_DIVERSITY: [
    'Document carrier/path diversity and identify single-route exposure across communications circuits.',
    'Evaluate additional carrier/path separation to reduce single-point communications outage risk.',
  ],
  COMMS_ALTERNATE_CAPABILITY: [
    'Define alternate communications methods for command and coordination during primary service loss.',
    'Exercise communications failover procedures and validate activation timelines.',
  ],
  COMMS_RESTORATION_REALISM: [
    'Maintain provider escalation contacts and documented restoration coordination procedures.',
    'Align restoration assumptions with provider commitments and internal operating priorities.',
  ],
  IT_PROVIDER_CONCENTRATION: [
    'Document concentration risk across critical externally hosted IT services and providers.',
    'Evaluate practical diversification options for high-impact provider dependencies.',
  ],
  IT_TRANSPORT_INDEPENDENCE_UNKNOWN: [
    'Obtain and record provider confirmation of physical path and route independence.',
    'Track unresolved independence assumptions as explicit continuity planning risks.',
  ],
  IT_TRANSPORT_DIVERSITY_RECORDED: [
    'Maintain current transport diversity documentation, including entry points and path dependencies.',
    'Exercise transport failover scenarios to validate continuity assumptions under outage conditions.',
  ],
  IT_MULTIPLE_CONNECTIONS_INDEPENDENCE_UNKNOWN: [
    'Document whether each external IT connection traverses independent physical routes, entrances, and upstream transport segments.',
    'Obtain provider confirmation of route and facility diversity assumptions and retain it with continuity records.',
    'Treat unconfirmed connection independence as a planning constraint in outage and failover procedures.',
  ],
  IT_FALLBACK_AVAILABILITY: [
    'Define minimum viable operating modes for core workflows when primary IT services are unavailable.',
    'Test and refine alternate operating procedures with responsible business and IT owners.',
  ],
  IT_TRANSPORT_SINGLE_PATH: [
    'Evaluate additional transport path or carrier diversity for internet connectivity.',
    'Document outage procedures for single-path failure and verify stakeholder escalation readiness.',
  ],
  IT_HOSTED_VENDOR_NO_CONTINUITY: [
    'For each critical hosted service, define a validated continuity approach for internet-loss conditions.',
    'Prioritize high-impact services for continuity remediation and periodic continuity testing.',
  ],
  IT_HOSTED_VENDOR_CONTINUITY_UNKNOWN: [
    'Document continuity behavior per hosted service when internet connectivity is unavailable.',
    'Require providers to clarify outage behavior and restoration assumptions for critical services.',
  ],
  IT_CONTINUITY_NOT_DEMONSTRATED: [
    'Run recurring continuity exercises for critical IT services and capture corrective actions.',
    'Update continuity runbooks based on exercise evidence and verified recovery constraints.',
  ],
  W_NO_PRIORITY_RESTORATION: [
    'Document water-service restoration contacts, escalation paths, and priority restoration expectations.',
    'Confirm facility criticality inputs needed for utility restoration prioritization where applicable.',
  ],
  W_NO_ALTERNATE_SOURCE: [
    'Evaluate alternate water-source options that can sustain critical operations during extended outages.',
    'Document activation criteria and operational procedures for alternate source use.',
  ],
  W_SINGLE_CONNECTION_NO_REDUNDANCY: [
    'Document known single-connection exposure, including shared-route and entry-point dependencies.',
    'Evaluate practical route or service diversification options for critical water demand.',
  ],
  W_ALTERNATE_INSUFFICIENT: [
    'Assess alternate-source capacity against minimum operational demand and duration requirements.',
    'Define compensating operational controls when alternate-source capacity is insufficient.',
  ],
  WW_NO_PRIORITY_RESTORATION: [
    'Document wastewater-service restoration escalation contacts and restoration coordination procedures.',
    'Define interim operational controls to reduce impact while restoration is pending.',
  ],
  WW_SINGLE_CONNECTION_NO_REDUNDANCY: [
    'Document wastewater single-connection dependencies and known shared-route constraints.',
    'Evaluate feasible connection or routing diversification options for critical discharge continuity.',
  ],
  WW_CONSTRAINTS_NOT_EVALUATED: [
    'Complete a structured review of regulatory, permit, and operational constraints during prolonged wastewater disruption.',
    'Define pre-approved interim controls and escalation thresholds for extended service interruption scenarios.',
  ],
};
