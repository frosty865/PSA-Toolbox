/**
 * Infrastructure tab purpose and boundary descriptions.
 * 
 * Each infrastructure has:
 * - title: Display name
 * - purpose: What this tab evaluates
 * - includes: What is in scope
 * - excludes: What is explicitly out of scope
 * - curveDriver: The primary loss event that drives the impact curve
 */

export interface InfraIntro {
  title: string;
  purpose: string;
  includes: string[];
  excludes: string[];
  curveDriver: string;
}

export const INFRA_INTRO: Record<string, InfraIntro> = {
  ELECTRIC_POWER: {
    title: 'Electric Power',
    purpose:
      'Evaluates dependency on external electrical utility service and the operational consequences of utility disruption. Measures how loss of grid power affects mission-essential functions and how backup power mitigates utility loss.',
    includes: [
      'Utility supply to the facility and distribution entry points',
      'Operational impact of power loss (timing, functional loss, recovery)',
      'Backup power availability as mitigation (generator/UPS as applicable)',
      'Physical exposure factors affecting external electrical components',
    ],
    excludes: [
      'Internal IT design or server redundancy',
      'Communications and radio systems',
      'Equipment engineering beyond its dependency on external power',
    ],
    curveDriver: 'Loss of external utility power',
  },

  WATER: {
    title: 'Water',
    purpose:
      'Evaluates dependency on municipal potable water service and the operational consequences of supply disruption. Measures how loss of municipal water affects mission operations that require water for normal function.',
    includes: [
      'Municipal water supply and service entry',
      'Operational impact of water loss (timing, functional loss, recovery)',
      'On-site storage or alternate supply as mitigation',
      'Physical exposure factors affecting external water infrastructure',
    ],
    excludes: [
      'Wastewater discharge capability',
      'Internal plumbing maintenance and condition',
      'Fire suppression engineering unless directly dependent on municipal pressure',
    ],
    curveDriver: 'Loss of municipal potable water supply',
  },

  WASTEWATER: {
    title: 'Wastewater',
    purpose:
      'Evaluates dependency on wastewater removal systems and the operational consequences of sewer disruption. Measures how inability to discharge wastewater affects facility habitability and continuity of operations.',
    includes: [
      'Municipal sewer service or on-site septic capability',
      'Lift station reliance where applicable',
      'Operational impact of loss (timing, functional loss, recovery)',
      'Physical exposure factors affecting wastewater infrastructure',
    ],
    excludes: ['Potable water supply', 'Internal plumbing maintenance and condition'],
    curveDriver: 'Loss of wastewater discharge capability',
  },

  COMMUNICATIONS: {
    title: 'Communications (Voice / Command & Control)',
    purpose:
      'Evaluates dependency on external voice/radio/dispatch transport for command & control and incident coordination. Measures operational impact of losing voice communications.',
    includes: [
      'Voice/radio/cellular/satellite voice transport',
      'Command & control and dispatch systems',
      'Operational impact of loss (timing, functional loss, recovery)',
      'PACE plan (Primary / Alternate / Contingency / Emergency)',
      'Upstream provider and carrier context',
    ],
    excludes: [
      'Internet/data connectivity (see Information Technology tab)',
      'Internal IT architecture, cybersecurity governance',
      'CCTV/access control networks',
      'Physical hardening of telecom cabinets (bollards, vehicle impact)',
    ],
    curveDriver: 'Loss of external voice/command communications',
  },

  INFORMATION_TECHNOLOGY: {
    title: 'Information Technology (Data / Internet Transport)',
    purpose:
      'Evaluates dependency on external data/internet transport that supports digital operations and access to external services. Measures the operational impact of losing external connectivity and upstream digital services.',
    includes: [
      'ISP circuits and external data transport (fiber, MPLS, SD-WAN where applicable)',
      'Cloud reachability and external service access that depends on data transport',
      'Operational impact of loss (timing, functional loss, recovery)',
      'Upstream provider identification and reliability context',
    ],
    excludes: [
      'Voice/radio command communications (addressed under Communications)',
      'Internal server redundancy and internal IT architecture (handled only if implemented as a separate resilience module)',
    ],
    curveDriver: 'Loss of external data connectivity',
  },
};
