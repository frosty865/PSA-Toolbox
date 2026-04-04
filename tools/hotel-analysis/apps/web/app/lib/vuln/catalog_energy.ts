/**
 * Electric Power Vulnerability Catalog
 */

import type { VulnerabilityConfig } from '../report/vulnerability/vulnerability_types';

export const CATALOG_ELECTRIC_POWER: VulnerabilityConfig[] = [
  {
    id: 'EP_V2',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Upstream Substation Unknown',
    description:
      'Key upstream substations influencing service delivery are not identified, reducing awareness of shared upstream risks.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'E-2' } },
    consideration_ids: ['EP_C1'],
    driverCategory: 'FOUNDATIONAL',
    impactWeight: 2,
    foundational: true,
  },
  {
    id: 'EP_V3',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Single Service Connection',
    description:
      'The facility relies on a single electric service connection, creating a single point of failure for power supply.',
    trigger: { type: 'CLAUSE', clause: { type: 'NUMBER_LTE', question_id: 'E-3', value: 1 } },
    consideration_ids: ['EP_C2', 'EP_C11'],
    driverCategory: 'PROVIDER_CONCENTRATION',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'EP_V4',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Non-Diverse Routing',
    description:
      'Service connections are not physically separated or are routed through shared corridors, increasing common-mode failure risk.',
    trigger: { type: 'CLAUSE', clause: { type: 'ARRAY_EMPTY', question_id: 'E-4' } },
    consideration_ids: ['EP_C2', 'EP_C10'],
    driverCategory: 'CASCADING',
    impactWeight: 2,
    structural: true,
    crossCutting: true,
  },
  {
    id: 'EP_V5',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Insufficient Independent Capacity',
    description:
      'No single service connection can support core operations independently, limiting survivability during partial outages.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'E-5' } },
    consideration_ids: ['EP_C3'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 2,
    structural: true,
  },
  {
    id: 'EP_V6',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Exterior Asset Exposure',
    description:
      'Exterior electrical components lack documented protection, increasing exposure to localized damage.',
    trigger: { type: 'CLAUSE', clause: { type: 'ARRAY_EMPTY', question_id: 'E-6' } },
    consideration_ids: ['EP_C4'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
  {
    id: 'EP_V7',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Vehicle Impact Exposure',
    description:
      'Exterior electrical components are exposed to vehicle impact without protective measures, increasing rapid outage risk.',
    trigger: {
      type: 'AND',
      rules: [
        { type: 'CLAUSE', clause: { type: 'IS_TRUE', question_id: 'E-7' } },
        { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'E-7a' } },
      ],
    },
    consideration_ids: ['EP_C5'],
    driverCategory: 'IMMEDIATE',
    impactWeight: 2,
  },
  {
    id: 'EP_V8',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'No Backup Power',
    description:
      'Backup power capability is not present or not documented, limiting the facility response window during grid loss.',
    trigger: { type: 'CLAUSE', clause: { type: 'ARRAY_EMPTY', question_id: 'E-8' } },
    consideration_ids: ['EP_C6', 'EP_C12'],
    driverCategory: 'MITIGATION_LIMIT',
    impactWeight: 3,
    structural: true,
  },
  {
    id: 'EP_V9',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Sustainment Planning Gap',
    description:
      'Refueling or sustainment procedures for extended backup operation are not defined, reducing confidence in runtime assumptions.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'E-9' } },
    consideration_ids: ['EP_C7'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
  {
    id: 'EP_V10',
    infra_id: 'ELECTRIC_POWER',
    short_name: 'Restoration Coordination Gap',
    description:
      'Coordination with the electric utility provider is not documented, creating uncertainty around restoration sequencing.',
    trigger: { type: 'CLAUSE', clause: { type: 'IS_FALSE', question_id: 'E-11' } },
    consideration_ids: ['EP_C9'],
    driverCategory: 'RESTORATION_REALISM',
    impactWeight: 2,
  },
];
