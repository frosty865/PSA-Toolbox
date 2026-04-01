/**
 * Question-driven vulnerability mapping.
 * Each question maps to a predefined set of vulnerability templates with mandatory citations.
 */

export type FeatureFlags = { praEnabled: boolean };

export type Trigger =
  | { op: 'eq'; questionId: string; value: 'YES' | 'NO' | 'UNKNOWN' | string | number | boolean }
  | { op: 'neq'; questionId: string; value: unknown }
  | { op: 'in'; questionId: string; values: unknown[] }
  | { op: 'present'; questionId: string }
  | { op: 'empty'; questionId: string }
  | { op: 'and'; all: Trigger[] }
  | { op: 'or'; any: Trigger[] }
  | { op: 'not'; inner: Trigger };

export type OFC = { id: string; title: string; text: string; requiresPRA?: boolean };

export type VulnCategory =
  | 'ELECTRIC_POWER'
  | 'COMMUNICATIONS'
  | 'INFORMATION_TECHNOLOGY'
  | 'WATER'
  | 'WASTEWATER'
  | 'CRITICAL_PRODUCTS';

export type VulnTemplate = {
  id: string;
  category: VulnCategory;
  title: string;
  summary: string;
  triggers: Trigger[];
  requiresPRA?: boolean;
  citations: string[];
  ofcs: OFC[];
};

export type QuestionVulnMap = Record<string, VulnTemplate[]>;

/**
 * Maps questionId (short form) to possible answer keys in category data.
 * Category data may store answers under suffixed keys (e.g. E-2_can_identify_substations).
 */
export const QUESTION_ID_TO_ANSWER_KEYS: Record<string, string[]> = {
  'E-2': ['E-2', 'E-2_can_identify_substations'],
  'E-3': ['E-3', 'E-3_more_than_one_connection'],
  'E-4': ['E-4', 'E-4_physically_separated'],
  'E-5': ['E-5', 'E-5_single_supports_core_ops'],
  'E-6': ['E-6', 'E-6_exterior_protected'],
  'E-7': ['E-7', 'E-7_vehicle_impact_exposure'],
  'E-7a': ['E-7a', 'E-7a_vehicle_impact_protection'],
  'E-8': ['E-8', 'E-8_backup_power_available'],
  'E-9': ['E-9', 'E-9_refuel_sustainment_established'],
  'E-10': ['E-10', 'E-10_tested_under_load'],
  'E-11': ['E-11', 'E-11_provider_restoration_coordination'],
  curve_requires_service: ['curve_requires_service'],
  curve_backup_available: ['curve_backup_available', 'curve_backup_available'],
  curve_time_to_impact_hours: ['curve_time_to_impact_hours'],
  curve_loss_fraction_no_backup: ['curve_loss_fraction_no_backup'],
  curve_recovery_time_hours: ['curve_recovery_time_hours'],
  curve_backup_duration_hours: ['curve_backup_duration_hours'],
  'COMM-0': ['COMM-0', 'comm_voice_functions'],
  'COMM-SP1': ['COMM-SP1', 'comm_single_point_voice_failure'],
  'COMM-SP2': ['COMM-SP2', 'comm_interoperability'],
  'COMM-SP3': ['COMM-SP3', 'comm_restoration_coordination'],
  'IT-1': ['IT-1', 'IT-1_can_identify_providers'],
  'IT-2': ['IT-2', 'IT-2_can_identify_assets'],
  'IT-3': ['IT-3', 'IT-3_multiple_connections'],
  'IT-5': ['IT-5', 'IT-5_survivability'],
  'IT-7': ['IT-7', 'IT-7_installation_location', 'IT-7_vehicle_impact_exposure'],
  'IT-7a': ['IT-7a', 'IT-7a_vehicle_impact_protection', 'IT-7_vehicle_impact_exposure'],
  'IT-11': ['IT-11', 'IT-11_restoration_coordination'],
  it_plan_exercised: ['it_plan_exercised'],
  'W_Q2': ['W_Q2', 'W_Q2_connection_count'],
  'W_Q3': ['W_Q3', 'W_Q3_same_geographic_location'],
  'W_Q1': ['W_Q1', 'W_Q1_municipal_supply'],
  'W_Q4': ['W_Q4', 'W_Q4_collocated_corridor'],
  'W_Q6': ['W_Q6', 'W_Q6_priority_restoration'],
  'W_Q7': ['W_Q7', 'W_Q7_contingency_plan'],
  'W_Q8': ['W_Q8', 'W_Q8_alternate_source'],
  'W_Q9': ['W_Q9', 'W_Q9_alternate_supports_core'],
  'W_Q10': ['W_Q10', 'W_Q10_alternate_depends_on_power'],
  'W_Q11': ['W_Q11', 'W_Q11_water_based_suppression'],
  'W_Q12': ['W_Q12', 'W_Q12_fire_secondary_supply'],
  'W_Q13': ['W_Q13', 'W_Q13_fire_impact_evaluated'],
  'W_Q14': ['W_Q14', 'W_Q14_onsite_pumping'],
  'W_Q16': ['W_Q16', 'W_Q16_manual_override'],
  'W_Q17': ['W_Q17', 'W_Q17_pump_alarming'],
  'W_Q18': ['W_Q18', 'W_Q18_dual_source_parts'],
  'WW_Q2': ['WW_Q2', 'WW_Q2_connection_count'],
  'WW_Q1': ['WW_Q1', 'WW_Q1_discharge_to_sewer'],
  'WW_Q3': ['WW_Q3', 'WW_Q3_same_geographic_location'],
  'WW_Q4': ['WW_Q4', 'WW_Q4_collocated_corridor'],
  'WW_Q6': ['WW_Q6', 'WW_Q6_priority_restoration'],
  'WW_Q7': ['WW_Q7', 'WW_Q7_contingency_plan'],
  'WW_Q8': ['WW_Q8', 'WW_Q8_onsite_pumping'],
  'WW_Q10': ['WW_Q10', 'WW_Q10_manual_override'],
  'WW_Q11': ['WW_Q11', 'WW_Q11_pump_alarming'],
  'WW_Q12': ['WW_Q12', 'WW_Q12_dual_source_parts'],
  'WW_Q13': ['WW_Q13', 'WW_Q13_holding_capacity'],
  'WW_Q14': ['WW_Q14', 'WW_Q14_constraints_evaluated'],
  comm_restoration_coordination: ['comm_restoration_coordination'],
  comm_single_point_voice_failure: ['comm_single_point_voice_failure'],
  'COMM-PRA_priority_restoration': ['comm_restoration_coordination', 'COMM-PRA_priority_restoration'],
  'COMM-SP3_provider_coordination': ['comm_restoration_coordination', 'COMM-SP3_provider_coordination'],
  'COMM-SP1_single_point_of_failure': ['comm_single_point_voice_failure', 'COMM-SP1_single_point_of_failure'],
  W_Q15_backup_power_pumps: ['W_Q15_backup_power_pumps'],
  'W_Q15': ['W_Q15', 'W_Q15_backup_power_pumps'],
  WW_Q9_backup_power_pumps: ['WW_Q9_backup_power_pumps'],
  'WW_Q9': ['WW_Q9', 'WW_Q9_backup_power_pumps'],
};

export const QUESTION_VULN_MAP: QuestionVulnMap = {
  'E-2': [
    {
      id: 'EP_UPSTREAM_SUBSTATION_UNKNOWN',
      category: 'ELECTRIC_POWER',
      title: 'Upstream Substation Unknown',
      summary:
        'Key upstream substations influencing service delivery are not identified, reducing awareness of shared upstream risks.',
      triggers: [
        { op: 'eq', questionId: 'E-2', value: 'NO' },
        { op: 'eq', questionId: 'E-2', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'DOE_ENERGY_RESILIENCY'],
      ofcs: [
        {
          id: 'OFC_EP_E2_1',
          title: 'Document and validate upstream dependencies',
          text: 'Document upstream utilities, substations, and service paths. Validate that records align with physical configuration and utility-provided information.',
        },
        {
          id: 'OFC_EP_E2_2',
          title: 'Evaluate service path diversity options',
          text: 'Evaluate options for alternate service paths or feeder diversity where utility infrastructure supports it. Consider IEEE reliability practices for distribution design.',
        },
        {
          id: 'OFC_EP_E2_3',
          title: 'Clarify restoration coordination',
          text: 'Clarify restoration sequencing and escalation procedures with the electric utility. Document expected restoration timelines for critical circuits.',
        },
        {
          id: 'OFC_EP_E2_4',
          title: 'Exercise outage response procedures',
          text: 'Exercise continuity procedures that assume loss of primary service. Validate situational awareness and communication paths during simulated outages.',
        },
      ],
    },
  ],
  'E-3': [
    {
      id: 'EP_SINGLE_SERVICE_CONNECTION',
      category: 'ELECTRIC_POWER',
      title: 'Single Service Connection',
      summary:
        'The facility relies on a single electric service connection, creating a single point of failure for power supply.',
      triggers: [
        { op: 'eq', questionId: 'E-3', value: 'NO' },
        { op: 'eq', questionId: 'E-3', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'NFPA_1600'],
      ofcs: [
        {
          id: 'OFC_EP_E3_1',
          title: 'Document load priorities and workarounds',
          text: 'Document essential loads, load-shed priorities, and operational workarounds for sustained electrical disruption. Validate alignment with utility restoration sequencing.',
        },
        {
          id: 'OFC_EP_E3_2',
          title: 'Evaluate second service path feasibility',
          text: 'Coordinate with the electric utility to evaluate a second service connection or alternate feeder path where feasible. Consider physically separated routing per NFPA 70.',
        },
        {
          id: 'OFC_EP_E3_3',
          title: 'Clarify restoration prioritization',
          text: 'Clarify and, where feasible, strengthen restoration prioritization with the utility. Document escalation paths for critical circuits.',
        },
        {
          id: 'OFC_EP_E3_4',
          title: 'Exercise single-path loss scenarios',
          text: 'Exercise continuity procedures that assume loss of the sole electrical service connection. Validate backup power coverage and manual workarounds.',
        },
      ],
    },
  ],
  'E-3_more_than_one_connection': [
    {
      id: 'EP_SINGLE_CONNECTION_SPOF',
      category: 'ELECTRIC_POWER',
      title: 'Single electrical service connection concentrates outage risk',
      summary:
        'A single utility service connection creates a single point of failure; a localized fault or upstream outage can rapidly degrade essential operations.',
      triggers: [
        { op: 'eq', questionId: 'E-3_more_than_one_connection', value: 'NO' },
        { op: 'eq', questionId: 'E-3_more_than_one_connection', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_EP_SPOF_1',
          title: 'Document load priorities for degraded operations',
          text: 'Define essential loads, load-shed priorities, and operational workarounds for sustained electrical disruption. Validate alignment with facility recovery objectives.',
        },
        {
          id: 'OFC_EP_SPOF_2',
          title: 'Evaluate second service path feasibility',
          text: 'Coordinate with the electric utility to evaluate a second service connection or alternate feeder path where feasible. Consider physically separated routing.',
        },
        {
          id: 'OFC_EP_SPOF_3',
          title: 'Clarify restoration coordination',
          text: 'Clarify restoration prioritization and escalation procedures with the utility. Document expected restoration sequencing for critical circuits.',
        },
        {
          id: 'OFC_EP_SPOF_4',
          title: 'Exercise single-path loss scenarios',
          text: 'Exercise continuity procedures that assume loss of the sole electrical service connection. Validate backup power coverage and manual workarounds.',
        },
      ],
    },
  ],
  'E-4': [
    {
      id: 'EP_CONNECTION_ROUTING_NOT_SEPARATED',
      category: 'ELECTRIC_POWER',
      title: 'Service connections are not physically separated',
      summary:
        'Multiple service connections enter through shared paths or collocated routes, leaving the facility exposed to common-cause disruption.',
      triggers: [
        { op: 'eq', questionId: 'E-4', value: 'NO' },
        { op: 'eq', questionId: 'E-4', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_EP_E4_1',
          title: 'Document current entry points and shared corridors',
          text: 'Document connection entry points, shared corridor exposure, and known common-cause hazards across service paths.',
        },
        {
          id: 'OFC_EP_E4_2',
          title: 'Evaluate physically distinct routing options',
          text: 'Evaluate routing options that reduce shared-path exposure between service connections serving critical operations.',
        },
        {
          id: 'OFC_EP_E4_3',
          title: 'Exercise single-corridor failure scenarios',
          text: 'Exercise continuity actions for corridor-level disruption and verify fallback operating limits during path loss.',
        },
      ],
    },
  ],
  'E-5': [
    {
      id: 'EP_NO_CONNECTION_CAN_SUSTAIN_CORE_LOAD',
      category: 'ELECTRIC_POWER',
      title: 'No single connection can sustain core operations',
      summary:
        'No individual service connection can support core operational load, increasing outage impact during partial service loss.',
      triggers: [
        { op: 'eq', questionId: 'E-5', value: 'NO' },
        { op: 'eq', questionId: 'E-5', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'NFPA_1600'],
      ofcs: [
        {
          id: 'OFC_EP_E5_1',
          title: 'Define minimum core-load profile',
          text: 'Define minimum core-load requirements and map which functions remain available under single-connection conditions.',
        },
        {
          id: 'OFC_EP_E5_2',
          title: 'Prioritize load transfer sequencing',
          text: 'Prioritize transfer sequencing for critical circuits to reduce disruption when one connection is unavailable.',
        },
        {
          id: 'OFC_EP_E5_3',
          title: 'Test degraded single-connection operations',
          text: 'Test degraded operations with one connection unavailable and record measured operational constraints.',
        },
      ],
    },
  ],
  'E-6': [
    {
      id: 'EP_EXTERIOR_COMPONENT_PROTECTION_GAP',
      category: 'ELECTRIC_POWER',
      title: 'Exterior electrical components are not protected',
      summary:
        'Exterior electrical assets lack documented protective measures, increasing susceptibility to accidental or intentional damage.',
      triggers: [
        { op: 'eq', questionId: 'E-6', value: 'NO' },
        { op: 'eq', questionId: 'E-6', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_EP_E6_1',
          title: 'Inventory exposed exterior components',
          text: 'Inventory exposed exterior components and record proximity to traffic, public access, and known impact hazards.',
        },
        {
          id: 'OFC_EP_E6_2',
          title: 'Evaluate layered physical safeguards',
          text: 'Evaluate layered safeguards such as standoff, barriers, enclosures, and controlled access around exposed components.',
        },
        {
          id: 'OFC_EP_E6_3',
          title: 'Track inspection and maintenance coverage',
          text: 'Track inspection intervals and maintenance status for protective features tied to exterior electrical infrastructure.',
        },
      ],
    },
  ],
  'E-7': [
    {
      id: 'EP_VEHICLE_IMPACT_EXPOSURE',
      category: 'ELECTRIC_POWER',
      title: 'Exterior electrical infrastructure is exposed to vehicle impact',
      summary:
        'Electrical infrastructure is positioned where vehicle movement can create impact risk with potential for immediate service disruption.',
      triggers: [{ op: 'eq', questionId: 'E-7', value: 'YES' }],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_EP_E7_1',
          title: 'Map vehicle approach paths near critical assets',
          text: 'Map vehicle approach paths, turning radii, and loading movements near critical exterior electrical components.',
        },
        {
          id: 'OFC_EP_E7_2',
          title: 'Define temporary traffic control measures',
          text: 'Define temporary traffic controls and exclusion zones during maintenance or high-activity site operations.',
        },
        {
          id: 'OFC_EP_E7_3',
          title: 'Exercise rapid isolation and response actions',
          text: 'Exercise rapid isolation and response actions for electrical asset strike events and verify communication sequence.',
        },
      ],
    },
  ],
  'E-7a': [
    {
      id: 'EP_VEHICLE_IMPACT_PROTECTION_NOT_IN_PLACE',
      category: 'ELECTRIC_POWER',
      title: 'Vehicle-impact protection is not in place for exposed components',
      summary:
        'Vehicle-impact exposure is present and documented protective measures are not in place or not confirmed.',
      triggers: [
        {
          op: 'and',
          all: [
            { op: 'eq', questionId: 'E-7', value: 'YES' },
            { op: 'eq', questionId: 'E-7a', value: 'NO' },
          ],
        },
        {
          op: 'and',
          all: [
            { op: 'eq', questionId: 'E-7', value: 'YES' },
            { op: 'eq', questionId: 'E-7a', value: 'UNKNOWN' },
          ],
        },
      ],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_EP_E7A_1',
          title: 'Document protection status by component',
          text: 'Document protection status by exposed component and note where barriers or standoff controls are absent.',
        },
        {
          id: 'OFC_EP_E7A_2',
          title: 'Prioritize high-consequence exposure points',
          text: 'Prioritize high-consequence exposure points where impact would affect core operations or emergency functions.',
        },
        {
          id: 'OFC_EP_E7A_3',
          title: 'Validate protection coverage after site changes',
          text: 'Validate protection coverage after construction, parking reconfiguration, or traffic-flow changes near assets.',
        },
      ],
    },
  ],
  'E-8': [
    {
      id: 'EP_NO_BACKUP_POWER',
      category: 'ELECTRIC_POWER',
      title: 'No Backup Power',
      summary:
        'Backup power capability is not present or not documented, limiting the facility response window during grid loss.',
      triggers: [
        { op: 'eq', questionId: 'E-8', value: 'NO' },
        { op: 'eq', questionId: 'E-8', value: 'UNKNOWN' },
      ],
      citations: ['NFPA_110', 'FEMA_CGC'],
      ofcs: [
        {
          id: 'OFC_EP_E8_1',
          title: 'Document critical load requirements',
          text: 'Document essential loads, runtime requirements, and fuel dependencies. Validate that records align with physical systems per NFPA 110.',
        },
        {
          id: 'OFC_EP_E8_2',
          title: 'Evaluate backup power options',
          text: 'Evaluate options for on-site generation, UPS, or alternate power sources that can support critical loads during grid loss. Consider NFPA 110 and IEEE 1100.',
        },
        {
          id: 'OFC_EP_E8_3',
          title: 'Clarify restoration and refuel coordination',
          text: 'Clarify refuel logistics, supplier arrangements, and restoration coordination for extended outages. Document runtime limits and operational priorities.',
        },
        {
          id: 'OFC_EP_E8_4',
          title: 'Exercise backup activation procedures',
          text: 'Exercise backup power activation and load transfer under simulated outage conditions. Validate runtime and fuel consumption assumptions.',
        },
      ],
    },
  ],
  'E-9': [
    {
      id: 'EP_REFUEL_SUSTAINMENT_GAP',
      category: 'ELECTRIC_POWER',
      title: 'Backup refuel or sustainment planning is not defined',
      summary:
        'Backup power sustainment inputs such as fuel source, supplier coordination, or resupply timing are not defined for extended outages.',
      triggers: [
        { op: 'eq', questionId: 'E-9', value: 'NO' },
        { op: 'eq', questionId: 'E-9', value: 'UNKNOWN' },
      ],
      citations: ['NFPA_110', 'FEMA_CGC'],
      ofcs: [
        {
          id: 'OFC_EP_E9_1',
          title: 'Document fuel source and runtime assumptions',
          text: 'Document fuel source, runtime assumptions, and consumption rates for backup assets supporting critical functions.',
        },
        {
          id: 'OFC_EP_E9_2',
          title: 'Map supplier dependencies and delivery constraints',
          text: 'Map supplier dependencies, delivery constraints, and access limitations affecting multi-day outage sustainment.',
        },
        {
          id: 'OFC_EP_E9_3',
          title: 'Exercise extended-outage sustainment procedures',
          text: 'Exercise extended-outage sustainment procedures and record timing gaps in refuel or logistics coordination.',
        },
      ],
    },
  ],
  'E-10': [
    {
      id: 'EP_BACKUP_TESTING_UNDER_LOAD_GAP',
      category: 'ELECTRIC_POWER',
      title: 'Backup power testing under load is not routine',
      summary:
        'Backup power systems are not routinely tested under operational load, reducing confidence in outage performance.',
      triggers: [
        { op: 'eq', questionId: 'E-10', value: 'NO' },
        { op: 'eq', questionId: 'E-10', value: 'UNKNOWN' },
      ],
      citations: ['NFPA_110', 'FEMA_CGC'],
      ofcs: [
        {
          id: 'OFC_EP_E10_1',
          title: 'Define load-test cadence and scope',
          text: 'Define load-test cadence, scope, and acceptance criteria for backup systems serving critical operations.',
        },
        {
          id: 'OFC_EP_E10_2',
          title: 'Record test outcomes and unresolved issues',
          text: 'Record test outcomes, observed anomalies, and unresolved issues affecting expected backup performance.',
        },
        {
          id: 'OFC_EP_E10_3',
          title: 'Track corrective actions to closure',
          text: 'Track corrective actions from backup testing and confirm closure before subsequent validation cycles.',
        },
      ],
    },
  ],
  'E-11': [
    {
      id: 'EP_NO_PRIORITY_RESTORATION',
      category: 'ELECTRIC_POWER',
      title: 'No Priority Restoration Agreement',
      summary:
        'Facility does not participate in priority restoration or coordinated restoration plan with utility.',
      triggers: [
        { op: 'eq', questionId: 'E-11', value: 'NO' },
        { op: 'eq', questionId: 'E-11', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'NFPA_1600'],
      ofcs: [
        {
          id: 'OFC_EP_E11_1',
          title: 'Document criticality and restoration expectations',
          text: 'Document facility criticality, essential circuits, and restoration expectations. Validate alignment with utility priority service criteria.',
          requiresPRA: true,
        },
        {
          id: 'OFC_EP_E11_2',
          title: 'Evaluate priority restoration eligibility',
          text: 'Evaluate whether operational criticality aligns with utility priority service programs. Consider formal agreements where eligibility criteria are met.',
          requiresPRA: true,
        },
        {
          id: 'OFC_EP_E11_3',
          title: 'Clarify restoration coordination procedures',
          text: 'Clarify escalation paths, outage reporting, and restoration status updates with the utility. Document expected sequencing for critical circuits.',
          requiresPRA: true,
        },
        {
          id: 'OFC_EP_E11_4',
          title: 'Exercise restoration coordination',
          text: 'Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'W_Q1': [
    {
      id: 'W_PRIMARY_SUPPLY_NOT_VERIFIED',
      category: 'WATER',
      title: 'Primary water supply dependency is not clearly verified',
      summary:
        'Primary water supply dependency on municipal service is not clearly verified, limiting continuity assumptions during regional disruption.',
      triggers: [
        { op: 'eq', questionId: 'W_Q1', value: 'NO' },
        { op: 'eq', questionId: 'W_Q1', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q1_1',
          title: 'Document primary water-source arrangement',
          text: 'Document primary water-source arrangement, ownership responsibilities, and normal operating dependency for core functions.',
        },
        {
          id: 'OFC_W_Q1_2',
          title: 'Map disruption implications by source type',
          text: 'Map disruption implications by source type, including utility outage, onsite source constraints, and refill dependencies.',
        },
        {
          id: 'OFC_W_Q1_3',
          title: 'Validate continuity assumptions for source loss',
          text: 'Validate continuity assumptions for primary source loss and record operational limits during sustained disruption.',
        },
      ],
    },
  ],
  'W_Q2': [
    {
      id: 'W_SINGLE_CONNECTION_CONCENTRATION',
      category: 'WATER',
      title: 'Water service is concentrated in a single connection',
      summary:
        'Water service connection count indicates concentration risk, increasing exposure to single-point service disruption.',
      triggers: [{ op: 'in', questionId: 'W_Q2', values: [0, 1] }],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q2_1',
          title: 'Document single-connection dependency',
          text: 'Document dependency on single-connection service and identify critical functions affected by connection loss.',
        },
        {
          id: 'OFC_W_Q2_2',
          title: 'Evaluate alternate connection feasibility',
          text: 'Evaluate feasibility of additional connection paths or alternate supply arrangements for critical operations.',
        },
        {
          id: 'OFC_W_Q2_3',
          title: 'Exercise single-connection outage procedures',
          text: 'Exercise outage procedures for single-connection loss and capture operational constraints observed during drills.',
        },
      ],
    },
  ],
  'W_Q3': [
    {
      id: 'W_CONNECTIONS_COLLocated_ENTRY',
      category: 'WATER',
      title: 'Water service connections share a common entry location',
      summary:
        'Water service connections share a common entry location, increasing common-cause exposure to localized disruption.',
      triggers: [
        { op: 'eq', questionId: 'W_Q3', value: 'YES' },
        { op: 'eq', questionId: 'W_Q3', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q3_1',
          title: 'Map geographic concentration points',
          text: 'Map geographic concentration points where multiple water connections enter the site through shared access points.',
        },
        {
          id: 'OFC_W_Q3_2',
          title: 'Evaluate separated entry alternatives',
          text: 'Evaluate alternatives that reduce shared-entry exposure for connections supporting critical facility functions.',
        },
        {
          id: 'OFC_W_Q3_3',
          title: 'Track localized disruption scenarios',
          text: 'Track localized disruption scenarios affecting shared entry points and align response actions to those scenarios.',
        },
      ],
    },
  ],
  'W_Q4': [
    {
      id: 'W_SHARED_CORRIDOR_EXPOSURE',
      category: 'WATER',
      title: 'Water infrastructure is collocated in shared utility corridors',
      summary:
        'Water lines and controls are collocated with other utilities, increasing risk of multi-utility disruption from a single event.',
      triggers: [
        { op: 'eq', questionId: 'W_Q4', value: 'YES' },
        { op: 'eq', questionId: 'W_Q4', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q4_1',
          title: 'Document shared-corridor dependencies',
          text: 'Document shared-corridor dependencies and identify co-located utility assets with common outage exposure.',
        },
        {
          id: 'OFC_W_Q4_2',
          title: 'Prioritize high-consequence corridor segments',
          text: 'Prioritize corridor segments where multi-utility interruption would materially degrade core operations.',
        },
        {
          id: 'OFC_W_Q4_3',
          title: 'Coordinate excavation and outage controls',
          text: 'Coordinate excavation controls, notification practices, and outage communications for high-risk corridor areas.',
        },
      ],
    },
  ],
  'W_Q6': [
    {
      id: 'W_NO_PRIORITY_RESTORATION',
      category: 'WATER',
      title: 'No Priority Restoration Agreement',
      summary:
        'Facility does not participate in priority restoration or coordinated restoration plan with water utility.',
      triggers: [
        { op: 'eq', questionId: 'W_Q6', value: 'NO' },
        { op: 'eq', questionId: 'W_Q6', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q6_1',
          title: 'Priority Restoration Agreements - Water',
          text: 'Priority restoration agreements for water service can reduce restoration time for facilities supporting critical community functions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q6_2',
          title: 'Document restoration contacts and escalation',
          text: 'Document utility contacts, outage notification workflow, and escalation paths used during water service interruptions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q6_3',
          title: 'Align restoration expectations with operating priorities',
          text: 'Align restoration assumptions with critical facility functions and record interim operating limits for extended restoration timelines.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'W_Q7': [
    {
      id: 'W_NO_WATER_CONTINGENCY_COORDINATION_PLAN',
      category: 'WATER',
      title: 'No documented water contingency coordination plan',
      summary:
        'Documented coordination procedures with the water provider for extended disruption are not available or not confirmed.',
      triggers: [
        { op: 'eq', questionId: 'W_Q7', value: 'NO' },
        { op: 'eq', questionId: 'W_Q7', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q7_1',
          title: 'Document utility coordination workflow',
          text: 'Document utility coordination workflow, contact ownership, and outage communication sequence for extended disruptions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q7_2',
          title: 'Define escalation thresholds for prolonged outages',
          text: 'Define escalation thresholds and decision points used when water-service disruption extends beyond planned duration.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q7_3',
          title: 'Exercise provider coordination scenarios',
          text: 'Exercise provider coordination scenarios and record timing gaps in communications and operational decision flow.',
          requiresPRA: true,
        },
      ],
    },
  ],
  W_Q15_backup_power_pumps: [
    {
      id: 'WATER_PUMPS_NO_BACKUP_POWER',
      category: 'WATER',
      title: 'Water pumping/boosting lacks backup power support',
      summary:
        'If pumping/boosting depends on utility power without backup, water pressure and availability can degrade during electrical disruptions.',
      triggers: [
        { op: 'eq', questionId: 'W_Q15_backup_power_pumps', value: 'NO' },
        { op: 'eq', questionId: 'W_Q15_backup_power_pumps', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023'],
      ofcs: [
        {
          id: 'OFC_WATER_PWR_1',
          title: 'Confirm critical pump power requirements',
          text: 'Identify critical pumps/boosters and their power requirements to inform backup power planning.',
        },
        {
          id: 'OFC_WATER_PWR_2',
          title: 'Plan for sustained outages',
          text: 'Document runtime limits, refuel logistics, and operational priorities for maintaining water pressure during prolonged outages.',
        },
        {
          id: 'OFC_WATER_PWR_3',
          title: 'Coordinate with water provider on outage operations',
          text: 'Coordinate with the provider on expected pressure impacts and operational workarounds during electrical disruptions.',
        },
      ],
    },
  ],
  'W_Q8': [
    {
      id: 'W_NO_ALTERNATE_SOURCE',
      category: 'WATER',
      title: 'No Alternate Water Source',
      summary:
        'The facility has no backup or alternate water source documented to sustain operations during primary supply outages.',
      triggers: [
        { op: 'eq', questionId: 'W_Q8', value: 'NO' },
        { op: 'eq', questionId: 'W_Q8', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q8_1',
          title: 'Alternate Water Source',
          text: 'Facilities without alternate water sources may experience immediate operational disruption during utility outages.',
        },
        {
          id: 'OFC_W_Q8_2',
          title: 'Define alternate source activation criteria',
          text: 'Define activation thresholds, authority, and sequencing for alternate source use during supply interruptions.',
        },
        {
          id: 'OFC_W_Q8_3',
          title: 'Track operational runtime assumptions',
          text: 'Track alternate-source runtime, refill cadence, and demand constraints for prioritized functions under outage conditions.',
        },
      ],
    },
  ],
  'W_Q9': [
    {
      id: 'W_ALTERNATE_INSUFFICIENT',
      category: 'WATER',
      title: 'Alternate water source may not sustain core demand',
      summary:
        'Alternate water source capability may not sustain core operational demand during extended disruption conditions.',
      triggers: [
        { op: 'eq', questionId: 'W_Q9', value: 'NO' },
        { op: 'eq', questionId: 'W_Q9', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q9_1',
          title: 'Quantify alternate-source demand coverage',
          text: 'Quantify alternate-source capacity against core operational demand, duration requirements, and refill assumptions.',
        },
        {
          id: 'OFC_W_Q9_2',
          title: 'Prioritize water use under constrained supply',
          text: 'Prioritize water use under constrained supply conditions and align allocation to critical service functions.',
        },
        {
          id: 'OFC_W_Q9_3',
          title: 'Validate sustained-use assumptions through drills',
          text: 'Validate sustained-use assumptions through disruption drills and capture observed shortfalls in alternate supply planning.',
        },
      ],
    },
  ],
  'W_Q10': [
    {
      id: 'W_ALTERNATE_SOURCE_EXTERNAL_DEPENDENCY',
      category: 'WATER',
      title: 'Alternate water source depends on external services',
      summary:
        'Alternate water source availability depends on commercial power or other external services, reducing resilience during compound outages.',
      triggers: [
        { op: 'eq', questionId: 'W_Q10', value: 'YES' },
        { op: 'eq', questionId: 'W_Q10', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q10_1',
          title: 'Map external dependencies for alternate source',
          text: 'Map external dependencies required for alternate-source operation, including power, controls, and provider availability.',
        },
        {
          id: 'OFC_W_Q10_2',
          title: 'Define fallback operating mode when dependencies fail',
          text: 'Define fallback operating mode used when alternate-source dependencies are unavailable during regional disruptions.',
        },
        {
          id: 'OFC_W_Q10_3',
          title: 'Exercise dependency-loss scenarios',
          text: 'Exercise dependency-loss scenarios and track recovery steps needed to restore alternate-source functionality.',
        },
      ],
    },
  ],
  'W_Q11': [
    {
      id: 'W_FIRE_SUPPRESSION_WATER_DEPENDENCY',
      category: 'WATER',
      title: 'Fire suppression capability depends on water-service continuity',
      summary:
        'Water-based fire suppression depends on water-service pressure or supply, creating exposure during water disruption events.',
      triggers: [{ op: 'eq', questionId: 'W_Q11', value: 'YES' }],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q11_1',
          title: 'Document suppression-system water dependencies',
          text: 'Document fire suppression dependencies on pressure, supply continuity, and supporting equipment availability.',
        },
        {
          id: 'OFC_W_Q11_2',
          title: 'Align outage planning with fire-safety constraints',
          text: 'Align outage planning with fire-safety constraints and identify operations affected when suppression water is reduced.',
        },
        {
          id: 'OFC_W_Q11_3',
          title: 'Coordinate suppression readiness checks',
          text: 'Coordinate readiness checks that confirm suppression-related water assumptions during disruption planning cycles.',
        },
      ],
    },
  ],
  'W_Q12': [
    {
      id: 'W_NO_SECONDARY_FIRE_SUPPRESSION_SUPPLY',
      category: 'WATER',
      title: 'No secondary water-supply approach for fire suppression',
      summary:
        'Secondary water-supply approach for fire suppression is not available or not confirmed for primary pressure-loss conditions.',
      triggers: [
        { op: 'eq', questionId: 'W_Q12', value: 'NO' },
        { op: 'eq', questionId: 'W_Q12', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q12_1',
          title: 'Document secondary suppression-source options',
          text: 'Document secondary suppression-source options and activation conditions when primary pressure is unavailable.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q12_2',
          title: 'Define interim suppression-risk controls',
          text: 'Define interim controls for periods when secondary suppression water is unavailable during prolonged outages.',
          requiresPRA: true,
        },
        {
          id: 'OFC_W_Q12_3',
          title: 'Exercise suppression contingency procedures',
          text: 'Exercise suppression contingency procedures and record observed limitations in alternate water availability.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'W_Q13': [
    {
      id: 'W_FIRE_SUPPRESSION_IMPACT_NOT_EVALUATED',
      category: 'WATER',
      title: 'Operational impact of suppression-water loss is not evaluated',
      summary:
        'Operational and compliance impacts from fire-suppression water loss are not evaluated or not documented.',
      triggers: [
        { op: 'eq', questionId: 'W_Q13', value: 'NO' },
        { op: 'eq', questionId: 'W_Q13', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q13_1',
          title: 'Assess impact of suppression-water unavailability',
          text: 'Assess operational impact of suppression-water unavailability across critical functions and occupancy conditions.',
        },
        {
          id: 'OFC_W_Q13_2',
          title: 'Document regulatory and insurance implications',
          text: 'Document regulatory, insurance, and safety implications associated with prolonged suppression-water disruption.',
        },
        {
          id: 'OFC_W_Q13_3',
          title: 'Integrate findings into outage decision planning',
          text: 'Integrate impact findings into outage decision planning and operational prioritization for extended disruptions.',
        },
      ],
    },
  ],
  'W_Q14': [
    {
      id: 'W_ONSITE_PUMPING_DEPENDENCY',
      category: 'WATER',
      title: 'Core water availability depends on onsite pumping equipment',
      summary:
        'Core water availability depends on onsite pumping or boosting equipment, creating equipment-dependent continuity risk.',
      triggers: [{ op: 'eq', questionId: 'W_Q14', value: 'YES' }],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q14_1',
          title: 'Document critical pumping dependencies',
          text: 'Document critical pumping dependencies, required operating states, and affected services during equipment loss.',
        },
        {
          id: 'OFC_W_Q14_2',
          title: 'Map pump-failure consequence pathways',
          text: 'Map pump-failure consequence pathways including pressure loss, service interruption, and downstream operational impacts.',
        },
        {
          id: 'OFC_W_Q14_3',
          title: 'Exercise pump-dependency outage procedures',
          text: 'Exercise pump-dependency outage procedures and validate response timing for pressure and service restoration.',
        },
      ],
    },
  ],
  'W_Q16': [
    {
      id: 'W_NO_MANUAL_OVERRIDE_FOR_PUMPING',
      category: 'WATER',
      title: 'Manual override for onsite pumping is not available',
      summary:
        'Manual override for onsite pumping or boosting is not available or not confirmed, increasing automation-failure exposure.',
      triggers: [
        { op: 'eq', questionId: 'W_Q16', value: 'NO' },
        { op: 'eq', questionId: 'W_Q16', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q16_1',
          title: 'Document control-mode fallback paths',
          text: 'Document fallback control modes and available operator actions when automated pumping controls are unavailable.',
        },
        {
          id: 'OFC_W_Q16_2',
          title: 'Define operator response sequence for control failure',
          text: 'Define operator response sequence, staffing roles, and communication paths for pumping control failure events.',
        },
        {
          id: 'OFC_W_Q16_3',
          title: 'Exercise manual-operation workflows',
          text: 'Exercise manual-operation workflows and record timing constraints that affect sustained service continuity.',
        },
      ],
    },
  ],
  'W_Q17': [
    {
      id: 'W_NO_PUMP_MONITORING_OR_ALARMING',
      category: 'WATER',
      title: 'Monitoring or alarming for water pumping conditions is limited',
      summary:
        'Monitoring or alarming for low pressure, pump failure, or storage depletion is limited or not confirmed.',
      triggers: [
        { op: 'eq', questionId: 'W_Q17', value: 'NO' },
        { op: 'eq', questionId: 'W_Q17', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q17_1',
          title: 'Document current detection coverage',
          text: 'Document current detection coverage for pressure loss, pump failure, and storage depletion conditions.',
        },
        {
          id: 'OFC_W_Q17_2',
          title: 'Define alert routing and escalation timing',
          text: 'Define alert routing, acknowledgment roles, and escalation timing for high-impact pumping events.',
        },
        {
          id: 'OFC_W_Q17_3',
          title: 'Validate alarm-response execution',
          text: 'Validate alarm-response execution through exercises and track delays between detection and corrective action.',
        },
      ],
    },
  ],
  'W_Q18': [
    {
      id: 'W_PUMP_PARTS_SINGLE_SOURCE_EXPOSURE',
      category: 'WATER',
      title: 'Critical pump components have limited sourcing options',
      summary:
        'Critical pump and control components have limited sourcing options, increasing restoration delay risk during failures.',
      triggers: [
        { op: 'eq', questionId: 'W_Q18', value: 'NO' },
        { op: 'eq', questionId: 'W_Q18', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_W_Q18_1',
          title: 'Document critical component lead-time exposure',
          text: 'Document critical component lead-time exposure and identify parts with single-vendor restoration constraints.',
        },
        {
          id: 'OFC_W_Q18_2',
          title: 'Prioritize high-impact spare-part readiness',
          text: 'Prioritize high-impact spare-part readiness for components linked to pressure maintenance and service continuity.',
        },
        {
          id: 'OFC_W_Q18_3',
          title: 'Track sourcing resiliency assumptions',
          text: 'Track sourcing resiliency assumptions and update outage planning when supplier availability conditions change.',
        },
      ],
    },
  ],
  'WW_Q1': [
    {
      id: 'WW_DISCHARGE_PATH_NOT_VERIFIED',
      category: 'WASTEWATER',
      title: 'Primary wastewater discharge pathway is not clearly verified',
      summary:
        'Primary wastewater discharge pathway is not clearly verified, limiting continuity assumptions during service disruption.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q1', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q1', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q1_1',
          title: 'Document primary wastewater disposition path',
          text: 'Document primary wastewater disposition path, including utility service dependency and onsite handling constraints.',
        },
        {
          id: 'OFC_WW_Q1_2',
          title: 'Map disruption impact by disposal method',
          text: 'Map disruption impact by disposal method and identify operational thresholds for service interruption events.',
        },
        {
          id: 'OFC_WW_Q1_3',
          title: 'Validate continuity assumptions for path loss',
          text: 'Validate continuity assumptions for primary discharge-path loss and record contingency limits for extended outages.',
        },
      ],
    },
  ],
  'WW_Q2': [
    {
      id: 'WW_SINGLE_CONNECTION_CONCENTRATION',
      category: 'WASTEWATER',
      title: 'Wastewater service is concentrated in a single connection',
      summary:
        'Wastewater service connection count indicates concentration risk, increasing exposure to single-point discharge disruption.',
      triggers: [{ op: 'in', questionId: 'WW_Q2', values: [0, 1] }],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q2_1',
          title: 'Document single-connection discharge dependency',
          text: 'Document single-connection discharge dependency and identify critical functions affected by connection loss.',
        },
        {
          id: 'OFC_WW_Q2_2',
          title: 'Evaluate alternate discharge-path options',
          text: 'Evaluate alternate discharge-path options or compensating controls for critical wastewater-dependent operations.',
        },
        {
          id: 'OFC_WW_Q2_3',
          title: 'Exercise single-connection outage response',
          text: 'Exercise outage response for single-connection loss and record operational constraints observed during disruption drills.',
        },
      ],
    },
  ],
  'WW_Q3': [
    {
      id: 'WW_CONNECTIONS_SHARED_ENTRY',
      category: 'WASTEWATER',
      title: 'Wastewater connections share a common entry or exit location',
      summary:
        'Wastewater connections share a common entry or exit location, increasing common-cause outage exposure.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q3', value: 'YES' },
        { op: 'eq', questionId: 'WW_Q3', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q3_1',
          title: 'Document shared-entry concentration points',
          text: 'Document shared-entry concentration points where multiple wastewater paths are exposed to the same local hazards.',
        },
        {
          id: 'OFC_WW_Q3_2',
          title: 'Evaluate separated routing opportunities',
          text: 'Evaluate routing opportunities that reduce common-entry exposure for critical wastewater pathways.',
        },
        {
          id: 'OFC_WW_Q3_3',
          title: 'Track localized-failure outage scenarios',
          text: 'Track localized-failure outage scenarios for shared entry locations and align contingency steps to those scenarios.',
        },
      ],
    },
  ],
  'WW_Q4': [
    {
      id: 'WW_SHARED_CORRIDOR_EXPOSURE',
      category: 'WASTEWATER',
      title: 'Wastewater infrastructure is collocated in shared utility corridors',
      summary:
        'Wastewater infrastructure is collocated with other utilities, increasing risk of multi-utility disruption from a single event.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q4', value: 'YES' },
        { op: 'eq', questionId: 'WW_Q4', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q4_1',
          title: 'Document shared-corridor dependencies',
          text: 'Document shared-corridor dependencies and identify co-located assets with common-cause disruption exposure.',
        },
        {
          id: 'OFC_WW_Q4_2',
          title: 'Prioritize high-impact corridor segments',
          text: 'Prioritize corridor segments where simultaneous utility disruption would materially affect wastewater continuity.',
        },
        {
          id: 'OFC_WW_Q4_3',
          title: 'Coordinate corridor-risk operating controls',
          text: 'Coordinate corridor-risk operating controls, notifications, and response sequencing for high-exposure locations.',
        },
      ],
    },
  ],
  'WW_Q7': [
    {
      id: 'WW_NO_PROVIDER_CONTINGENCY_PLAN',
      category: 'WASTEWATER',
      title: 'No documented wastewater provider contingency coordination plan',
      summary:
        'Documented coordination procedures with the wastewater provider for extended disruption are not available or not confirmed.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q7', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q7', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q7_1',
          title: 'Document provider coordination workflow',
          text: 'Document provider coordination workflow, contact ownership, and outage communication sequence for prolonged disruptions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q7_2',
          title: 'Define escalation thresholds for extended outages',
          text: 'Define escalation thresholds and decision checkpoints used when wastewater disruption exceeds planning assumptions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q7_3',
          title: 'Exercise provider coordination procedures',
          text: 'Exercise provider coordination procedures and record timing constraints in communication and decision flow.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'WW_Q8': [
    {
      id: 'WW_ONSITE_PUMPING_DEPENDENCY',
      category: 'WASTEWATER',
      title: 'Wastewater continuity depends on onsite pumping',
      summary:
        'Wastewater continuity depends on onsite pumping equipment, creating equipment-dependent operational exposure.',
      triggers: [{ op: 'eq', questionId: 'WW_Q8', value: 'YES' }],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q8_1',
          title: 'Document critical pumping dependencies',
          text: 'Document critical pumping dependencies and affected operations during pumping-equipment disruption.',
        },
        {
          id: 'OFC_WW_Q8_2',
          title: 'Map overflow and service-impact pathways',
          text: 'Map overflow and service-impact pathways that emerge when onsite pumping capacity is unavailable.',
        },
        {
          id: 'OFC_WW_Q8_3',
          title: 'Exercise pumping-disruption response actions',
          text: 'Exercise pumping-disruption response actions and validate timing for containment and escalation steps.',
        },
      ],
    },
  ],
  WW_Q9_backup_power_pumps: [
    {
      id: 'WW_PUMPS_NO_BACKUP_POWER',
      category: 'WASTEWATER',
      title: 'Wastewater pumping lacks backup power support',
      summary:
        'If wastewater pumping depends on utility power without backup, loss of pumping can increase overflow risk and disrupt operations during outages.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q9_backup_power_pumps', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q9_backup_power_pumps', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023'],
      ofcs: [
        {
          id: 'OFC_WW_PWR_1',
          title: 'Identify critical lift stations and controls',
          text: 'Identify critical lift stations/pumps and control dependencies that are expected to remain functional during outages.',
        },
        {
          id: 'OFC_WW_PWR_2',
          title: 'Plan containment/overflow procedures',
          text: 'Document procedures to reduce overflow risk during sustained pump outages (containment, monitoring, and escalation).',
        },
        {
          id: 'OFC_WW_PWR_3',
          title: 'Exercise outage response',
          text: 'Exercise wastewater outage response procedures, including communications, monitoring, and dispatch for pump failure events.',
        },
      ],
    },
  ],
  'WW_Q10': [
    {
      id: 'WW_NO_MANUAL_OVERRIDE_FOR_PUMPING',
      category: 'WASTEWATER',
      title: 'Manual override for wastewater pumping is not available',
      summary:
        'Manual override for wastewater pumping is not available or not confirmed, increasing automation-failure exposure.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q10', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q10', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q10_1',
          title: 'Document control-mode fallback paths',
          text: 'Document control-mode fallback paths and operator actions when automated wastewater pumping controls are unavailable.',
        },
        {
          id: 'OFC_WW_Q10_2',
          title: 'Define operator response sequence',
          text: 'Define operator response sequence, staffing roles, and communication flow for pumping-control failure events.',
        },
        {
          id: 'OFC_WW_Q10_3',
          title: 'Exercise manual-operation workflows',
          text: 'Exercise manual-operation workflows and record timing constraints affecting sustained wastewater continuity.',
        },
      ],
    },
  ],
  'WW_Q11': [
    {
      id: 'WW_NO_MONITORING_OR_ALARMING',
      category: 'WASTEWATER',
      title: 'Monitoring or alarming for wastewater pumping conditions is limited',
      summary:
        'Monitoring or alarming for pump failure, high level, or backflow risk is limited or not confirmed.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q11', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q11', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q11_1',
          title: 'Document current detection coverage',
          text: 'Document current detection coverage for pump failure, high-level, and backflow conditions across critical assets.',
        },
        {
          id: 'OFC_WW_Q11_2',
          title: 'Define alarm routing and escalation timing',
          text: 'Define alarm routing, acknowledgment roles, and escalation timing for high-impact wastewater events.',
        },
        {
          id: 'OFC_WW_Q11_3',
          title: 'Validate alarm-response execution',
          text: 'Validate alarm-response execution through exercises and record delays between detection and corrective action.',
        },
      ],
    },
  ],
  'WW_Q12': [
    {
      id: 'WW_PUMP_PARTS_SINGLE_SOURCE_EXPOSURE',
      category: 'WASTEWATER',
      title: 'Critical wastewater pump components have limited sourcing options',
      summary:
        'Critical wastewater pump and control components have limited sourcing options, increasing restoration delay risk.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q12', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q12', value: 'UNKNOWN' },
      ],
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q12_1',
          title: 'Document critical component lead-time exposure',
          text: 'Document critical component lead-time exposure and identify parts with single-vendor restoration constraints.',
        },
        {
          id: 'OFC_WW_Q12_2',
          title: 'Prioritize high-impact spare readiness',
          text: 'Prioritize spare readiness for high-impact components linked to containment and discharge continuity.',
        },
        {
          id: 'OFC_WW_Q12_3',
          title: 'Track sourcing resiliency assumptions',
          text: 'Track sourcing resiliency assumptions and update outage planning when supplier conditions change.',
        },
      ],
    },
  ],
  'WW_Q13': [
    {
      id: 'WW_NO_HOLDING_OR_CONTAINMENT_CAPABILITY',
      category: 'WASTEWATER',
      title: 'Holding or containment capability is not available',
      summary:
        'Holding or containment capability for wastewater disruption is not available or not confirmed.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q13', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q13', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['EPA_POWER_RESILIENCE_2023', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q13_1',
          title: 'Document containment capacity assumptions',
          text: 'Document containment capacity assumptions and expected runtime before overflow thresholds are reached.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q13_2',
          title: 'Define interim wastewater controls',
          text: 'Define interim wastewater controls and decision sequencing used when utility service is unavailable.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q13_3',
          title: 'Exercise prolonged-disruption containment actions',
          text: 'Exercise prolonged-disruption containment actions and record constraints affecting sustained operations.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'WW_Q14': [
    {
      id: 'WW_CONSTRAINTS_NOT_EVALUATED',
      category: 'WASTEWATER',
      title: 'Regulatory and operational constraints are not evaluated',
      summary:
        'Regulatory and operational constraints for prolonged wastewater disruption are not evaluated or not documented.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q14', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q14', value: 'UNKNOWN' },
      ],
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q14_1',
          title: 'Document regulatory obligations during outages',
          text: 'Document regulatory obligations, reporting timelines, and operational limits during prolonged wastewater disruption.',
        },
        {
          id: 'OFC_WW_Q14_2',
          title: 'Assess operational tradeoffs under constraints',
          text: 'Assess operational tradeoffs under regulatory and service constraints for extended disruption scenarios.',
        },
        {
          id: 'OFC_WW_Q14_3',
          title: 'Integrate constraint findings into outage planning',
          text: 'Integrate constraint findings into outage planning and escalation decisions for sustained service interruption.',
        },
      ],
    },
  ],
  'WW_Q6': [
    {
      id: 'WW_NO_PRIORITY_RESTORATION',
      category: 'WASTEWATER',
      title: 'No Priority Restoration Agreement',
      summary:
        'Facility does not participate in priority restoration or coordinated restoration plan with wastewater utility.',
      triggers: [
        { op: 'eq', questionId: 'WW_Q6', value: 'NO' },
        { op: 'eq', questionId: 'WW_Q6', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FEMA_CGC', 'EPA_WATER_SECURITY'],
      ofcs: [
        {
          id: 'OFC_WW_Q6_1',
          title: 'Priority Restoration Agreements - Wastewater',
          text: 'Priority restoration agreements for wastewater service can reduce restoration time for facilities supporting critical community functions.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q6_2',
          title: 'Document wastewater outage escalation flow',
          text: 'Document provider contacts, reporting workflow, and escalation paths for wastewater service interruption events.',
          requiresPRA: true,
        },
        {
          id: 'OFC_WW_Q6_3',
          title: 'Define interim controls during restoration delays',
          text: 'Define interim containment and operational controls that reduce impact while priority restoration is pending.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'COMM-0': [
    {
      id: 'COMMS_VOICE_FUNCTIONS_NOT_DOCUMENTED',
      category: 'COMMUNICATIONS',
      title: 'Voice-dependent functions are not documented',
      summary:
        'Voice-dependent command and coordination functions are not documented, reducing clarity on operational impact during communications disruptions.',
      triggers: [
        {
          op: 'and',
          all: [
            { op: 'eq', questionId: 'curve_requires_service', value: true },
            { op: 'empty', questionId: 'COMM-0' },
          ],
        },
      ],
      citations: ['CISA_EMERGENCY_COMMS_REDUNDANCIES_2021', 'FCC_CSRIC'],
      ofcs: [
        {
          id: 'OFC_COMMS_0_1',
          title: 'Document voice-dependent mission functions',
          text: 'Document mission functions that depend on voice coordination, including dispatch, emergency communications, and facility operations.',
        },
        {
          id: 'OFC_COMMS_0_2',
          title: 'Map function-to-channel dependencies',
          text: 'Map each voice-dependent function to primary and alternate communications channels used during disruptions.',
        },
        {
          id: 'OFC_COMMS_0_3',
          title: 'Validate function priorities during outages',
          text: 'Validate which voice-dependent functions require priority restoration and track acceptable outage tolerance by function.',
        },
      ],
    },
  ],
  'COMM-SP2': [
    {
      id: 'COMMS_INTEROPERABILITY_LIMITED',
      category: 'COMMUNICATIONS',
      title: 'Voice interoperability with partners is limited',
      summary:
        'Voice interoperability with external agencies or partner systems is limited or uncertain, increasing coordination friction during incidents.',
      triggers: [{ op: 'in', questionId: 'COMM-SP2', values: ['PARTIAL', 'NONE', 'UNKNOWN'] }],
      citations: ['CISA_EMERGENCY_COMMS_REDUNDANCIES_2021', 'FCC_CSRIC'],
      ofcs: [
        {
          id: 'OFC_COMMS_SP2_1',
          title: 'Document interoperability constraints by partner',
          text: 'Document interoperability constraints by partner agency or system, including known channel, protocol, or procedural barriers.',
        },
        {
          id: 'OFC_COMMS_SP2_2',
          title: 'Define bridge methods for incident coordination',
          text: 'Define practical bridge methods used when direct interoperability is unavailable during incident operations.',
        },
        {
          id: 'OFC_COMMS_SP2_3',
          title: 'Exercise multi-agency voice coordination',
          text: 'Where external partner coordination is operationally required, exercise cross-organization voice coordination scenarios and record latency, handoff, and escalation constraints.',
        },
      ],
    },
  ],
  comm_restoration_coordination: [
    {
      id: 'COMM_NO_PRIORITY_RESTORATION',
      category: 'COMMUNICATIONS',
      title: 'No Priority Restoration Agreement',
      summary:
        'Facility does not participate in priority restoration or coordinated restoration plan with communications provider.',
      triggers: [
        { op: 'eq', questionId: 'comm_restoration_coordination', value: 'NO' },
        { op: 'eq', questionId: 'comm_restoration_coordination', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FCC_TSP_PROGRAM', 'CISA_TSP_SERVICE'],
      ofcs: [
        {
          id: 'OFC_COMM_PRA_1',
          title: 'Priority Restoration Agreements - Communications',
          text: 'Telecommunications Service Priority (TSP) programs provide federal prioritization mechanisms for qualifying facilities.',
          requiresPRA: true,
        },
        {
          id: 'OFC_COMM_PRA_2',
          title: 'Document outage escalation contacts',
          text: 'Document carrier contacts, outage reporting workflow, and escalation paths for critical communications circuits.',
          requiresPRA: true,
        },
        {
          id: 'OFC_COMM_PRA_3',
          title: 'Align service criticality with restoration assumptions',
          text: 'Align communications service criticality with restoration assumptions and track interim operating constraints during outages.',
          requiresPRA: true,
        },
      ],
    },
  ],
  comm_single_point_voice_failure: [
    {
      id: 'COMMS_SPOF_VOICE',
      category: 'COMMUNICATIONS',
      title: 'Single point of failure in voice coordination',
      summary:
        'Voice coordination depends on a single method or pathway; loss or degradation can disrupt command, dispatch, and operational coordination.',
      triggers: [{ op: 'eq', questionId: 'comm_single_point_voice_failure', value: 'YES' }],
      citations: ['CISA_EMERGENCY_COMMS_REDUNDANCIES_2021', 'FCC_CSRIC'],
      ofcs: [
        {
          id: 'OFC_COMMS_SPOF_1',
          title: 'Document voice dependencies and contacts',
          text: 'Document voice coordination methods, carrier contacts, and escalation procedures. Validate that records align with current service configuration.',
        },
        {
          id: 'OFC_COMMS_SPOF_2',
          title: 'Evaluate redundant voice options',
          text: 'Consider options for an alternate voice coordination method that can operate independently of the primary pathway during disruptions.',
        },
        {
          id: 'OFC_COMMS_SPOF_3',
          title: 'Clarify priority contacts and procedures',
          text: 'Maintain current carrier/provider contacts and escalation procedures for outage reporting and restoration coordination.',
        },
        {
          id: 'OFC_COMMS_SPOF_4',
          title: 'Exercise method switching',
          text: 'Conduct periodic exercises that require switching from primary to alternate methods under time pressure. Validate alternate path availability.',
        },
      ],
    },
  ],
  'COMM-SP3_provider_coordination': [
    {
      id: 'COMMS_NO_PROVIDER_RESTORATION_COORD',
      category: 'COMMUNICATIONS',
      title: 'No documented restoration coordination for communications services',
      summary:
        'Without documented provider coordination and restoration procedures, the facility may experience longer restoration timelines during regional disruptions.',
      triggers: [
        { op: 'eq', questionId: 'COMM-SP3_provider_coordination', value: 'NO' },
        { op: 'eq', questionId: 'COMM-SP3_provider_coordination', value: 'UNKNOWN' },
      ],
      citations: ['CISA_EMERGENCY_COMMS_REDUNDANCIES_2021', 'FCC_CSRIC'],
      ofcs: [
        {
          id: 'OFC_COMMS_COORD_1',
          title: 'Document restoration contacts and escalation',
          text: 'Document provider contacts, ticketing/escalation paths, and after-hours restoration coordination procedures.',
        },
        {
          id: 'OFC_COMMS_COORD_2',
          title: 'Validate route diversity where available',
          text: 'Ask the provider to confirm whether service paths are physically diverse (separate routes/entries) where feasible.',
        },
        {
          id: 'OFC_COMMS_COORD_3',
          title: 'Clarify restoration prioritization',
          text: 'Clarify restoration prioritization and escalation procedures with the carrier. Document expected restoration sequencing for critical circuits.',
        },
        {
          id: 'OFC_COMMS_COORD_4',
          title: 'Exercise outage response procedures',
          text: 'Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.',
        },
      ],
    },
  ],
  'COMM-PRA_priority_restoration': [
    {
      id: 'COMMS_NO_TSP_PRIORITY_RESTORATION',
      category: 'COMMUNICATIONS',
      title: 'No priority restoration mechanism for critical communications circuits',
      summary:
        'Without a priority restoration mechanism, critical communications services may face longer restoration times during major outages affecting multiple customers.',
      triggers: [
        { op: 'eq', questionId: 'COMM-PRA_priority_restoration', value: 'NO' },
        { op: 'eq', questionId: 'COMM-PRA_priority_restoration', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['FCC_TSP_PROGRAM', 'CISA_TSP_SERVICE'],
      ofcs: [
        {
          id: 'OFC_TSP_1',
          title: 'Document critical circuits and eligibility',
          text: 'Identify and document which voice/data services directly support essential functions. Assess whether organizational criticality aligns with TSP eligibility criteria.',
          requiresPRA: true,
        },
        {
          id: 'OFC_TSP_2',
          title: 'Evaluate TSP enrollment for qualifying services',
          text: 'Evaluate Telecommunications Service Priority eligibility and, where criteria are met, pursue enrollment for qualifying services.',
          requiresPRA: true,
        },
        {
          id: 'OFC_TSP_3',
          title: 'Align restoration expectations with provider',
          text: 'Coordinate with the provider to document restoration assumptions and escalation procedures for critical services.',
          requiresPRA: true,
        },
        {
          id: 'OFC_TSP_4',
          title: 'Exercise restoration coordination',
          text: 'Exercise outage reporting and TSP restoration coordination procedures. Validate contact information and escalation paths.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'IT-1': [
    {
      id: 'IT_PROVIDER_VISIBILITY_GAP',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'IT service provider visibility gap',
      summary:
        'External IT service providers are not clearly identified, limiting visibility into service dependencies and restoration expectations.',
      triggers: [
        { op: 'eq', questionId: 'IT-1_can_identify_providers', value: 'NO' },
        { op: 'eq', questionId: 'IT-1_can_identify_providers', value: 'UNKNOWN' },
      ],
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_1_1',
          title: 'Document IT service dependencies',
          text: 'Document external IT providers, cloud platforms, and support escalation paths. Validate that records align with current service configuration.',
        },
        {
          id: 'OFC_IT_1_2',
          title: 'Evaluate service architecture visibility',
          text: 'Evaluate options to improve visibility into upstream dependencies, shared risk exposure, and outage impact forecasting.',
        },
        {
          id: 'OFC_IT_1_3',
          title: 'Clarify restoration coordination',
          text: 'Clarify provider contacts, ticketing paths, and restoration coordination procedures for critical IT services.',
        },
        {
          id: 'OFC_IT_1_4',
          title: 'Exercise outage response procedures',
          text: 'Exercise continuity procedures that assume loss of primary IT services. Validate alternate access and manual workarounds.',
        },
      ],
    },
  ],
  'IT-2': [
    {
      id: 'IT_HOSTED_SERVICES_NOT_IDENTIFIED',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'Critical hosted services are not fully identified',
      summary:
        'Critical externally hosted or managed services are not fully identified, reducing dependency visibility and continuity planning quality.',
      triggers: [
        { op: 'eq', questionId: 'IT-2_can_identify_assets', value: 'NO' },
        { op: 'eq', questionId: 'IT-2_can_identify_assets', value: 'UNKNOWN' },
      ],
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_2_1',
          title: 'Document hosted service inventory',
          text: 'Document externally hosted services that support core operations, including ownership, business dependency, and outage impact scope.',
        },
        {
          id: 'OFC_IT_2_2',
          title: 'Track service continuity assumptions',
          text: 'Track continuity assumptions for each hosted service and align incident procedures to known service dependencies.',
        },
        {
          id: 'OFC_IT_2_3',
          title: 'Map restoration ownership by service',
          text: 'Map restoration ownership, escalation contacts, and status channels for each critical hosted service dependency.',
        },
      ],
    },
  ],
  'IT-3': [
    {
      id: 'IT_SINGLE_PROVIDER_DEPENDENCY',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'Single IT provider dependency',
      summary:
        'Critical operations rely on a single external IT provider or platform, creating concentration risk.',
      triggers: [
        { op: 'eq', questionId: 'IT-3_multiple_connections', value: 'NO' },
        { op: 'eq', questionId: 'IT-3_multiple_connections', value: 'UNKNOWN' },
      ],
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_3_1',
          title: 'Document load priorities and failover',
          text: 'Document essential IT services, failover procedures, and operational workarounds for sustained service disruption.',
        },
        {
          id: 'OFC_IT_3_2',
          title: 'Evaluate alternate service options',
          text: 'Evaluate options for alternate IT access methods or secondary providers that can operate independently during primary outages.',
        },
        {
          id: 'OFC_IT_3_3',
          title: 'Clarify restoration coordination',
          text: 'Clarify restoration prioritization and escalation procedures with the IT provider. Document expected restoration sequencing.',
        },
        {
          id: 'OFC_IT_3_4',
          title: 'Exercise single-provider loss scenarios',
          text: 'Exercise continuity procedures that assume loss of the primary IT provider. Validate alternate path availability.',
        },
      ],
    },
  ],
  'IT-5': [
    {
      id: 'IT_FALLBACK_CAPABILITY_INSUFFICIENT',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'Fallback capability may be insufficient for core operations',
      summary:
        'Fallback methods may not support acceptable operational continuity during extended disruption of primary external IT services.',
      triggers: [
        { op: 'eq', questionId: 'IT-5_survivability', value: 'NO' },
        { op: 'eq', questionId: 'IT-5_survivability', value: 'UNKNOWN' },
      ],
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_5_1',
          title: 'Assess fallback operating level',
          text: 'Assess whether fallback methods support minimum acceptable service levels for core operations under disruption conditions.',
        },
        {
          id: 'OFC_IT_5_2',
          title: 'Exercise fallback procedures',
          text: 'Run fallback procedure exercises and update documented response steps based on observed constraints and performance.',
        },
        {
          id: 'OFC_IT_5_3',
          title: 'Define manual-mode operating constraints',
          text: 'Define manual-mode throughput limits, staffing requirements, and decision thresholds for sustained fallback operations.',
        },
      ],
    },
  ],
  'IT-11': [
    {
      id: 'IT_NO_RESTORATION_COORDINATION',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'No IT Service Restoration Agreement',
      summary:
        'Facility does not participate in priority restoration or coordinated restoration plan with IT service provider.',
      triggers: [
        { op: 'eq', questionId: 'IT-11', value: 'NO' },
        { op: 'eq', questionId: 'IT-11', value: 'UNKNOWN' },
      ],
      requiresPRA: true,
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_11_1',
          title: 'Document criticality and restoration expectations',
          text: 'Document facility criticality, essential IT services, and restoration expectations. Validate alignment with provider SLA terms.',
          requiresPRA: true,
        },
        {
          id: 'OFC_IT_11_2',
          title: 'Evaluate SLA and restoration options',
          text: 'Evaluate options for defined restoration time objectives and escalation procedures in service level agreements.',
          requiresPRA: true,
        },
        {
          id: 'OFC_IT_11_3',
          title: 'Clarify restoration coordination procedures',
          text: 'Clarify escalation paths, outage reporting, and restoration status updates with the IT provider. Document expected sequencing for critical services.',
          requiresPRA: true,
        },
        {
          id: 'OFC_IT_11_4',
          title: 'Exercise restoration coordination',
          text: 'Exercise outage reporting and restoration coordination procedures. Validate contact information and escalation paths.',
          requiresPRA: true,
        },
      ],
    },
  ],
  'IT-7': [
    {
      id: 'IT_COMPONENT_VEHICLE_IMPACT_EXPOSURE',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'Critical IT components are exposed to vehicle impact',
      summary:
        'Critical IT infrastructure components are located in areas with potential vehicle-impact exposure.',
      triggers: [
        { op: 'eq', questionId: 'IT-7_vehicle_impact_exposure', value: 'YES' },
        { op: 'eq', questionId: 'IT-7', value: 'YES' },
      ],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_IT_7_1',
          title: 'Document exposed IT component locations',
          text: 'Document locations of exposed IT components and nearby vehicle approach paths affecting impact risk.',
        },
        {
          id: 'OFC_IT_7_2',
          title: 'Prioritize components by operational consequence',
          text: 'Prioritize exposed components by operational consequence and dependency criticality during outage conditions.',
        },
        {
          id: 'OFC_IT_7_3',
          title: 'Exercise response to infrastructure strike scenarios',
          text: 'Exercise response to infrastructure strike scenarios and verify incident communication and service restoration sequence.',
        },
      ],
    },
  ],
  'IT-7a': [
    {
      id: 'IT_COMPONENT_VEHICLE_PROTECTION_GAP',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'Protective measures for vehicle-impact risk are not in place',
      summary:
        'Vehicle-impact exposure exists for critical IT infrastructure and protective measures are not in place or not confirmed.',
      triggers: [
        {
          op: 'and',
          all: [
            { op: 'eq', questionId: 'IT-7_vehicle_impact_exposure', value: 'YES' },
            { op: 'eq', questionId: 'IT-7a_vehicle_impact_protection', value: 'NO' },
          ],
        },
        {
          op: 'and',
          all: [
            { op: 'eq', questionId: 'IT-7_vehicle_impact_exposure', value: 'YES' },
            { op: 'eq', questionId: 'IT-7a_vehicle_impact_protection', value: 'UNKNOWN' },
          ],
        },
      ],
      citations: ['FEMA_CGC', 'WBDG_RESILIENCE_GOOD_PRACTICES'],
      ofcs: [
        {
          id: 'OFC_IT_7A_1',
          title: 'Record protection coverage by exposed component',
          text: 'Record protection coverage by exposed component and identify locations with no current impact safeguards.',
        },
        {
          id: 'OFC_IT_7A_2',
          title: 'Rank highest-risk exposure points',
          text: 'Rank highest-risk exposure points where impact would disrupt critical hosted or transport-dependent IT services.',
        },
        {
          id: 'OFC_IT_7A_3',
          title: 'Revalidate exposure after site layout changes',
          text: 'Revalidate vehicle-impact exposure after parking, loading, or traffic-flow changes near IT infrastructure.',
        },
      ],
    },
  ],
  it_plan_exercised: [
    {
      id: 'IT_CONTINUITY_PLAN_NOT_EXERCISED',
      category: 'INFORMATION_TECHNOLOGY',
      title: 'IT continuity plan is not demonstrated through exercises',
      summary:
        'IT continuity and recovery procedures are not exercised regularly, leaving execution quality and recovery assumptions uncertain.',
      triggers: [
        { op: 'eq', questionId: 'it_plan_exercised', value: 'NO' },
        { op: 'eq', questionId: 'it_plan_exercised', value: 'UNKNOWN' },
      ],
      citations: ['ISO_22301', 'NIST_CSF'],
      ofcs: [
        {
          id: 'OFC_IT_EXERCISE_1',
          title: 'Schedule recurring continuity exercises',
          text: 'Schedule recurring continuity exercises for critical IT services and record outcomes, gaps, and follow-up actions.',
        },
        {
          id: 'OFC_IT_EXERCISE_2',
          title: 'Align procedures to exercise evidence',
          text: 'Align recovery procedures, staffing assumptions, and communication workflows to evidence from recent exercises.',
        },
        {
          id: 'OFC_IT_EXERCISE_3',
          title: 'Track closure of exercise findings',
          text: 'Track remediation status for exercise findings and record evidence when identified gaps are resolved.',
        },
      ],
    },
  ],
};

const total = Object.keys(QUESTION_VULN_MAP).length;
if (total === 0) {
  console.error('[VULN MAP] QUESTION_VULN_MAP is EMPTY');
  throw new Error('[VULN MAP] QUESTION_VULN_MAP is EMPTY - cannot evaluate question-driven vulnerabilities');
}
if (process.env.ADA_VULN_DEBUG === '1' || process.env.ADA_VULN_DEBUG === 'true') {
  console.log('[VULN MAP] Loaded mappings:', total);
}
