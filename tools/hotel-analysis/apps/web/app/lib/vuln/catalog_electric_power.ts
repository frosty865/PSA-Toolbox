/**
 * Vulnerability Catalog - Electric Power (alternate / curve-based)
 * Uses the same trigger format as catalog_energy (TriggerRule).
 * Note: Registry uses catalog_energy for ELECTRIC_POWER; this catalog is for compatibility.
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const ELECTRIC_POWER_VULNERABILITIES: VulnerabilityConfig[] = [
  {
    id: 'V_EP_001',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'No Alternate Power Capability',
    description:
      'The facility has no backup power capability documented to sustain operations during grid outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-8_backup_available', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_EP_001', 'AC_EP_002'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'V_EP_002',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Immediate Impact Without Backup Power',
    description:
      'Facility operations are severely impacted within one hour of grid power loss without backup.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-8_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_time_to_impact_hours', value: 1 } },
      ],
    },
    consideration_ids: ['AC_EP_001', 'AC_EP_003'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 3,
  },
  {
    id: 'V_EP_003',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Severe Functional Degradation Without Backup',
    description:
      'Facility experiences 75% or greater functional loss during grid outages without backup power.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-8_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_loss_fraction_no_backup', value: 0.75 } },
      ],
    },
    consideration_ids: ['AC_EP_001', 'AC_EP_004'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
  },
  {
    id: 'V_EP_004',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Prolonged Recovery Time',
    description:
      'Extended recovery period of 24 hours or more required after grid power restoration.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_recovery_time_hours', value: 24 } },
      ],
    },
    consideration_ids: ['AC_EP_005'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
  {
    id: 'V_EP_005',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Limited Backup Power Runtime',
    description:
      'Backup power capability exists but runtime is limited to 8 hours or less without refueling.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'EQUALS', question_id: 'E-8_backup_available', value: 'yes' } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_backup_duration_hours', value: 8 } },
      ],
    },
    consideration_ids: ['AC_EP_006', 'AC_EP_007'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 2,
  },
  {
    id: 'V_EP_006',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'No Refueling or Resupply Plan',
    description:
      'Backup power exists but no documented refueling or resupply plan is in place for extended outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'EQUALS', question_id: 'E-8_backup_available', value: 'yes' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-9_refueling_plan', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_EP_006', 'AC_EP_008'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
  {
    id: 'V_EP_008',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'No Priority Restoration Agreement',
    description:
      'Facility does not participate in priority restoration or coordinated restoration plan with utility.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-11_priority_restoration', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_EP_010'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 1,
  },
  {
    id: 'V_EP_009',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Physical Security Exposure - Vehicular Impact',
    description:
      'Critical electric power components are not protected from or are exposed to vehicular impact.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-7_protected_vehicle_impact', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_EP_011'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
  {
    id: 'V_EP_010',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Single Point of Failure - No Redundancy',
    description:
      'Facility has a single electric service connection with no redundant pathways documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'E-3_multiple_connections', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_EP_012'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 2,
    structural: true,
  },
];
