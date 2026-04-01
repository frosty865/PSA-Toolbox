/**
 * Information Technology Vulnerability Catalog
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

const IT_TRANSPORT_TYPE: VulnerabilityConfig['transport_type'] = 'DATA_TRANSPORT';

export const CATALOG_INFORMATION_TECHNOLOGY: VulnerabilityConfig[] = [
  {
    id: 'IT_V1',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Provider Visibility Gap',
    description:
      'External IT service providers are not clearly identified, limiting visibility into service dependencies and restoration expectations.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'IT-1' } },
    consideration_ids: ['IT_C1'],
    driverCategory: 'FOUNDATIONAL',
    impactWeight: 3,
    foundational: true,
    structural: true,
  },
  {
    id: 'IT_V2',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'External Service Unknown',
    description:
      'Critical externally hosted services are not fully identified, obscuring dependence on third-party platforms.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'IT-2' } },
    consideration_ids: ['IT_C2'],
    driverCategory: 'FOUNDATIONAL',
    impactWeight: 2,
    foundational: true,
  },
  {
    id: 'IT_V3',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Single Provider Dependency',
    description:
      'Critical operations rely on a single external IT provider or platform, creating a concentration risk.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'IT-3' } },
    consideration_ids: ['IT_C3'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'IT_V4',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Fallback Capability Gap',
    description:
      'Fallback capability does not support core operations at an acceptable level, limiting continuity during outages.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'IT-5' } },
    consideration_ids: ['IT_C4'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 2,
  },
  {
    id: 'IT_V5',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Vehicle Impact Exposure',
    description:
      'IT infrastructure components are exposed to vehicle impact without protective measures, increasing rapid outage risk.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'IT-7a' } },
    consideration_ids: ['IT_C5'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
  {
    id: 'IT_V6',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'No Alternate Method',
    description:
      'No alternate method exists to continue critical operations if primary external IT services are unavailable.',
    trigger: { type: 'CLAUSE', clause: { type: 'ARRAY_EMPTY', question_id: 'IT-8' } },
    consideration_ids: ['IT_C6'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'IT_V7',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Alternate Survivability Risk',
    description:
      'Alternate methods may not remain available during widespread outages due to shared dependencies.',
    trigger: { type: 'CLAUSE', clause: { type: 'IN_SET', question_id: 'IT-9', value: ['NO', 'UNKNOWN'] } },
    consideration_ids: ['IT_C7'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
  {
    id: 'IT_V8',
    infra_id: 'INFORMATION_TECHNOLOGY',
    transport_type: IT_TRANSPORT_TYPE,
    short_name: 'Restoration Coordination Gap',
    description:
      'Coordination with external IT service providers is not documented, creating uncertainty around restoration sequencing.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'IT-11' } },
    consideration_ids: ['IT_C9'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
];
