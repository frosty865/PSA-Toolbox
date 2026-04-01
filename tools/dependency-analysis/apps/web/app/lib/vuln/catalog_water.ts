/**
 * Vulnerability Catalog - Water
 *
 * v1 vulnerability definitions for water infrastructure. Uses the same trigger
 * format as catalog_energy (TriggerRule: CLAUSE / AND / OR / NOT).
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const WATER_VULNERABILITIES: VulnerabilityConfig[] = [
  {
    id: 'V_WA_001',
    infra_id: 'WATER',
    short_name: 'No Alternate Water Source',
    description:
      'The facility has no backup or alternate water source documented to sustain operations during primary supply outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'W_Q8_backup_available', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_WA_001', 'AC_WA_002'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'V_WA_002',
    infra_id: 'WATER',
    short_name: 'Immediate Impact Without Alternate Water',
    description:
      'Facility operations are severely impacted within one hour of water service loss without alternate source.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'W_Q8_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_time_to_impact_hours', value: 1 } },
      ],
    },
    consideration_ids: ['AC_WA_001', 'AC_WA_003'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 3,
  },
  {
    id: 'V_WA_003',
    infra_id: 'WATER',
    short_name: 'Severe Functional Degradation Without Backup',
    description:
      'Facility experiences 75% or greater functional loss during water outages without alternate source.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'W_Q8_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_loss_fraction_no_backup', value: 0.75 } },
      ],
    },
    consideration_ids: ['AC_WA_001', 'AC_WA_004'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
  },
  {
    id: 'V_WA_005',
    infra_id: 'WATER',
    short_name: 'No Priority Restoration Agreement',
    description:
      'Facility does not participate in priority restoration or coordinated restoration plan with water utility.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'W_Q6_priority_restoration', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_WA_006'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 1,
    requiresPRA: true,
  },
  {
    id: 'V_WA_006',
    infra_id: 'WATER',
    short_name: 'Single Water Connection - No Redundancy',
    description:
      'Facility has a single water service connection with no redundant pathways documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'W_Q2_connection_count', value: 1 } },
      ],
    },
    consideration_ids: ['AC_WA_007'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 2,
    structural: true,
  },
  {
    id: 'V_WA_007',
    infra_id: 'WATER',
    short_name: 'Collocated Water Infrastructure',
    description:
      'Water service connections share collocated utility corridors, increasing common-mode failure risk.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'W_Q2_connection_count', value: 2 } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'W_Q3_same_geographic_location', value: ['yes', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_WA_008'],
    driverCategory: 'CASCADING',
    impactWeight: 2,
    structural: true,
    crossCutting: true,
  },
  {
    id: 'V_WA_008',
    infra_id: 'WATER',
    short_name: 'Limited Storage Duration',
    description:
      'Alternate water source or storage can sustain operations for 8 hours or less.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'EQUALS', question_id: 'W_Q8_backup_available', value: 'yes' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_backup_duration_hours', value: 8 } },
      ],
    },
    consideration_ids: ['AC_WA_009'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 2,
  },
];
