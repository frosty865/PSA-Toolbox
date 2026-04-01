/**
 * Vulnerability Catalog - Communications
 *
 * v1 vulnerability definitions for communications infrastructure. Uses the same trigger
 * format as catalog_energy (TriggerRule: CLAUSE / AND / OR / NOT).
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const COMMUNICATIONS_VULNERABILITIES: VulnerabilityConfig[] = [
  {
    id: 'V_CO_001',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'No Alternate Communications Capability',
    description:
      'The facility has no backup or alternate communications capability documented to sustain operations during primary service outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_001', 'AC_CO_002'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'V_CO_002',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Immediate Impact Without Backup Communications',
    description:
      'Facility operations are severely impacted within one hour of communications service loss without backup.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_time_to_impact_hours', value: 1 } },
      ],
    },
    consideration_ids: ['AC_CO_001', 'AC_CO_003'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 3,
  },
  {
    id: 'V_CO_003',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Severe Functional Degradation Without Backup',
    description:
      'Facility experiences 75% or greater functional loss during communications outages without backup capability.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_loss_fraction_no_backup', value: 0.75 } },
      ],
    },
    consideration_ids: ['AC_CO_001', 'AC_CO_004'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
  },
  {
    id: 'V_CO_004',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Provider Not Identified',
    description:
      'Communications provider and key upstream dependency information has not been documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'CO-1_provider_identified', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_005'],
    driverCategory: 'FOUNDATIONAL',
    impactWeight: 1,
    foundational: true,
  },
  {
    id: 'V_CO_005',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'No Priority Restoration Agreement',
    description:
      'Facility does not participate in priority restoration or coordinated restoration plan with communications provider.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'comm_restoration_coordination', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_006'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 1,
    requiresPRA: true,
  },
  {
    id: 'V_CO_006',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Single Point of Failure - No Redundancy',
    description:
      'Facility has a single communications pathway with no redundant connections documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'comm_single_point_voice_failure', value: ['yes', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_007'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 2,
    structural: true,
  },
  {
    id: 'V_CO_007',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Collocated Communications Infrastructure',
    description:
      'Communications pathways share collocated utility corridors, increasing common-mode failure risk.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'EQUALS', question_id: 'CO-3_multiple_pathways', value: 'yes' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'CO-4_same_geographic_location', value: ['yes', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_008'],
    driverCategory: 'CASCADING',
    impactWeight: 2,
    structural: true,
    crossCutting: true,
  },
  {
    id: 'V_CO_008',
    infra_id: 'COMMUNICATIONS',
    transport_type: 'VOICE_TRANSPORT',
    short_name: 'Physical Security Exposure - Vehicular Impact',
    description:
      'Critical communications components are not protected from or are exposed to vehicular impact.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'CO-7_protected_vehicle_impact', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_CO_009'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
];
