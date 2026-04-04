/**
 * Vulnerability Catalog - Information Technology (alternate / curve-based)
 *
 * v1 vulnerability definitions using curve and IT-* question IDs.
 * Uses the same trigger format as catalog_energy (TriggerRule).
 * Note: Registry uses catalog_it for INFORMATION_TECHNOLOGY; this catalog is for compatibility.
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const INFORMATION_TECHNOLOGY_VULNERABILITIES: VulnerabilityConfig[] = [
  {
    id: 'V_IT_001',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'No Alternate IT Capability',
    description:
      'The facility has no backup or alternate IT capability documented to sustain operations during primary service outages.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_001', 'AC_IT_002'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'V_IT_002',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'Immediate Impact Without Backup IT',
    description:
      'Facility operations are severely impacted within one hour of IT service loss without backup.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'curve_time_to_impact_hours', value: 1 } },
      ],
    },
    consideration_ids: ['AC_IT_001', 'AC_IT_003'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 3,
  },
  {
    id: 'V_IT_003',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'Severe Functional Degradation Without Backup',
    description:
      'Facility experiences 75% or greater functional loss during IT outages without backup capability.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'curve_backup_available', value: ['no', 'unknown'] } },
        { type: 'CLAUSE', clause: { type: 'NUMBER_GTE', question_id: 'curve_loss_fraction_no_backup', value: 0.75 } },
      ],
    },
    consideration_ids: ['AC_IT_001', 'AC_IT_004'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
  },
  {
    id: 'V_IT_004',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'IT Service Provider Not Identified',
    description:
      'IT service provider and key dependency information has not been documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-1_provider_identified', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_005'],
    driverCategory: 'FOUNDATIONAL',
    impactWeight: 1,
    foundational: true,
  },
  {
    id: 'V_IT_005',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'No IT Service Restoration Agreement',
    description:
      'Facility does not participate in priority restoration or coordinated restoration plan with IT service provider.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-11_priority_restoration', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_006'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 1,
    requiresPRA: true,
  },
  {
    id: 'V_IT_006',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'Single IT Service Provider - No Redundancy',
    description:
      'Facility relies on a single IT service provider pathway with no redundant connections documented.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-3_redundancy_present', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_007'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 2,
    structural: true,
  },
  {
    id: 'V_IT_007',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'Collocated IT Infrastructure',
    description:
      'IT service pathways share collocated infrastructure, increasing common-mode failure risk.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'EQUALS', question_id: 'IT-3_redundancy_present', value: 'yes' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-4_geographically_separated', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_008'],
    driverCategory: 'CASCADING',
    impactWeight: 2,
    structural: true,
    crossCutting: true,
  },
  {
    id: 'V_IT_008',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: 'DATA_TRANSPORT',
    short_name: 'Physical Security Exposure - IT Components',
    description:
      'Critical IT components are not protected from physical security risks.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'curve_requires_service' } },
        { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-7_protected_vehicle_impact', value: ['no', 'unknown'] } },
      ],
    },
    consideration_ids: ['AC_IT_009'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
];
