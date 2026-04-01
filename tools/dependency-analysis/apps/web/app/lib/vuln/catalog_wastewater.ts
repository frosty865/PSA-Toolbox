/**
 * Vulnerability Catalog - Wastewater
 *
 * v1 vulnerability definitions for wastewater infrastructure. Uses the same trigger
 * format as catalog_energy (TriggerRule: CLAUSE / AND / OR / NOT).
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const WASTEWATER_VULNERABILITIES: VulnerabilityConfig[] = [
  {
    id: 'V_WW_001',
    infra_id: 'WASTEWATER',
    short_name: 'No Alternate Discharge Capability',
    description:
      'The facility has no backup or alternate wastewater discharge capability documented to sustain operations during primary service outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'WW_Q7_backup_available', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_WW_001', 'AC_WW_002'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'V_WW_002',
    infra_id: 'WASTEWATER',
    short_name: 'Immediate Impact Without Alternate Wastewater',
    description:
      'Facility operations are severely impacted within one hour of wastewater service loss without alternate capability.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'WW_Q7_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_time_to_impact_hours', value: 1 } },
      ],
    },
    consideration_ids: ['AC_WW_001', 'AC_WW_003'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 3,
  },
  {
    id: 'V_WW_003',
    infra_id: 'WASTEWATER',
    short_name: 'Severe Functional Degradation Without Backup',
    description:
      'Facility experiences 75% or greater functional loss during wastewater outages without alternate capability.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'WW_Q7_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_loss_fraction_no_backup', value: 0.75 } },
      ],
    },
    consideration_ids: ['AC_WW_001', 'AC_WW_004'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
  },
  {
    id: 'V_WW_005',
    infra_id: 'WASTEWATER',
    short_name: 'No Priority Restoration Agreement',
    description:
      'Facility does not participate in priority restoration or coordinated restoration plan with wastewater utility.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'WW_Q6_priority_restoration', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_WW_006'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 1,
    requiresPRA: true,
  },
  {
    id: 'V_WW_006',
    infra_id: 'WASTEWATER',
    short_name: 'Single Wastewater Connection - No Redundancy',
    description:
      'Facility has a single wastewater service connection with no redundant pathways documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'WW_Q2_connection_count', value: 1 } },
      ],
    },
    consideration_ids: ['AC_WW_007'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 2,
    structural: true,
  },
  {
    id: 'V_WW_007',
    infra_id: 'WASTEWATER',
    short_name: 'Prolonged Recovery Time',
    description:
      'Extended recovery period of 24 hours or more required after wastewater service restoration.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_recovery_time_hours', value: 24 } },
      ],
    },
    consideration_ids: ['AC_WW_008'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
];
