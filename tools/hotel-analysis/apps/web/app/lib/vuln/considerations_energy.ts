/**
 * Electric Power Considerations
 */

import type { AnalyticalConsideration } from './consideration_types';

export const CONSIDERATIONS_ELECTRIC_POWER: Record<string, AnalyticalConsideration> = {
  EP_C1: {
    id: 'EP_C1',
    title: 'Utility and substation visibility',
    narrative:
      'Operational resilience depends on understanding which upstream utilities and substations influence site service. Limited visibility reduces awareness of shared upstream risks and complicates outage attribution. This gap also limits the ability to align expectations with utility restoration sequencing.',
    citations: [],
  },
  EP_C2: {
    id: 'EP_C2',
    title: 'Service connection diversity',
    narrative:
      'Multiple, independently routed service connections reduce single-event disruption risk. When connections share corridors or entry points, a localized incident can disable all feeds simultaneously. Diverse routing improves survivability during external incidents.',
    citations: [],
  },
  EP_C3: {
    id: 'EP_C3',
    title: 'Independent load capability',
    narrative:
      'If no single connection can support core operations, a partial loss can degrade critical functions. Independent capability increases tolerance for line failures or staged restoration. This consideration is central to sustaining mission-critical loads.',
    citations: [],
  },
  EP_C4: {
    id: 'EP_C4',
    title: 'Exterior component exposure',
    narrative:
      'Exterior electrical assets face exposure to impact, tampering, and weather damage. When components are accessible without physical protection, outages can occur from localized incidents. Exposure increases the likelihood of unplanned service interruption.',
    citations: [],
  },
  EP_C5: {
    id: 'EP_C5',
    title: 'Vehicle impact vulnerability',
    narrative:
      'Assets located near traffic paths are vulnerable to vehicle strikes. A single impact can disable transformers, switches, or feeders with limited warning. This exposure shortens time-to-impact and can amplify outage severity.',
    citations: [],
  },
  EP_C6: {
    id: 'EP_C6',
    title: 'Backup power coverage depth',
    narrative:
      'Backup power capacity defines how much core load can remain operational during grid loss. Limited coverage constrains continuity even when backup systems exist. Load coverage and runtime shape the facility response window.',
    citations: [],
  },
  EP_C7: {
    id: 'EP_C7',
    title: 'Fuel sustainment realism',
    narrative:
      'Extended outages depend on fuel logistics and refueling coordination. When sustainment planning is unclear, expected runtime may be overstated. This uncertainty can affect recovery planning and stakeholder expectations.',
    citations: [],
  },
  EP_C8: {
    id: 'EP_C8',
    title: 'Backup reliability confidence',
    narrative:
      'Operational confidence in backup systems depends on recent testing under load. Without verified performance, outage duration and load-support assumptions may not hold. Reliability uncertainty increases operational risk during emergencies.',
    citations: [],
  },
  EP_C9: {
    id: 'EP_C9',
    title: 'Restoration coordination posture',
    narrative:
      'Restoration prioritization and sequencing are influenced by utility coordination. When coordination is informal or undefined, recovery timelines remain uncertain. This gap can affect operational planning during regional outages.',
    citations: [],
  },
  EP_C10: {
    id: 'EP_C10',
    title: 'Shared corridor exposure',
    narrative:
      'Electrical feeds that share corridors with other utilities inherit multi-utility risk from a single disruption event. A localized incident can create multi-domain service loss. This coupling can accelerate cascading impacts.',
    citations: [],
  },
  EP_C11: {
    id: 'EP_C11',
    title: 'Single-source dependency',
    narrative:
      'Single-source electric service concentrates dependency on one upstream path. The lack of an alternate feed or switching path reduces recovery options. This concentration elevates consequence severity for upstream faults.',
    citations: [],
  },
  EP_C12: {
    id: 'EP_C12',
    title: 'Load shedding constraints',
    narrative:
      'When backup capacity is limited, facility operations rely on staged or partial load support. Critical functions may compete for power during prolonged outages. This constraint can introduce operational prioritization risk.',
    citations: [],
  },
  EP_C13: {
    id: 'EP_C13',
    title: 'Time-to-impact compression',
    narrative:
      'Fast degradation after power loss reduces decision time for operational response. Short windows limit manual mitigation and coordination options. Time compression can increase operational disruption severity.',
    citations: [],
  },
  EP_C14: {
    id: 'EP_C14',
    title: 'Recovery duration sensitivity',
    narrative:
      'Extended recovery timelines increase exposure to secondary impacts such as staffing limitations and resource depletion. Longer restoration windows place greater pressure on continuity plans. This sensitivity elevates operational risk during regional outages.',
    citations: [],
  },
  EP_C15: {
    id: 'EP_C15',
    title: 'External dependency coupling',
    narrative:
      'Electric power disruptions often propagate into other critical dependencies. Coupled reliance increases cascading risk and amplifies total operational loss. This interdependence is a key driver of systemic exposure.',
    citations: [],
  },
};
