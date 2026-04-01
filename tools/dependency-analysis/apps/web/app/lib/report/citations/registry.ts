/**
 * Citation Registry - Canonical references for all report citations
 * 
 * Each citation has:
 * - key: Stable identifier used in code
 * - short: Inline citation format (e.g., "FEMA CGC")
 * - full: Complete bibliography entry
 * - org: Organizing authority for grouping in appendix
 */

/** Version marker to confirm correct registry import at runtime. */
export const CITATION_REGISTRY_VERSION = 'v1';

/**
 * Normalize citation key at boundary (trim only).
 * Prevents whitespace/hidden chars from breaking lookups.
 */
export function normalizeCitationKey(input: string): string {
  return (input ?? '').trim();
}

export type CitationOrg = 
  | 'FEMA'
  | 'NFPA'
  | 'NIST'
  | 'ISO'
  | 'EPA'
  | 'DOE'
  | 'FCC'
  | 'DHS'
  | 'IEEE'
  | 'IBC'
  | 'ASCE'
  | 'OTHER';

export interface CitationRef {
  key: string;
  short: string;
  full: string;
  org: CitationOrg;
}

/**
 * Official citation registry.
 * All citations used in reports must be defined here.
 */
export const CITATION_REGISTRY: Record<string, CitationRef> = {
  // ========== FEMA ==========
  FEMA_CGC: {
    key: 'FEMA_CGC',
    short: 'FEMA CGC',
    full: 'FEMA P-2166, Community Continuity Guidance (CCG), 2022',
    org: 'FEMA',
  },
  FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK: {
    key: 'FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK',
    short: 'FEMA Federal Continuity Planning Framework',
    full: 'Federal Continuity Planning Framework, Federal Emergency Management Agency (FEMA), 2017',
    org: 'FEMA',
  },
  FEMA_HAZ_MIT_GUIDE: {
    key: 'FEMA_HAZ_MIT_GUIDE',
    short: 'FEMA HMA Guidance',
    full: 'FEMA Hazard Mitigation Assistance Guidance, 2024',
    org: 'FEMA',
  },
  FEMA_BCA_TOOLKIT: {
    key: 'FEMA_BCA_TOOLKIT',
    short: 'FEMA BCA Toolkit',
    full: 'FEMA Benefit-Cost Analysis Toolkit, Version 7.0',
    org: 'FEMA',
  },
  FEMA_RESILIENT_POWER: {
    key: 'FEMA_RESILIENT_POWER',
    short: 'FEMA P-1000',
    full: 'FEMA P-1000, Safer, Stronger, Smarter: A Guide to Improving School Natural Hazard Safety',
    org: 'FEMA',
  },

  // ========== NFPA ==========
  NFPA_110: {
    key: 'NFPA_110',
    short: 'NFPA 110',
    full: 'NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition',
    org: 'NFPA',
  },
  NFPA_101: {
    key: 'NFPA_101',
    short: 'NFPA 101',
    full: 'NFPA 101, Life Safety Code, 2021 Edition',
    org: 'NFPA',
  },
  NFPA_72: {
    key: 'NFPA_72',
    short: 'NFPA 72',
    full: 'NFPA 72, National Fire Alarm and Signaling Code, 2022 Edition',
    org: 'NFPA',
  },
  NFPA_1221: {
    key: 'NFPA_1221',
    short: 'NFPA 1221',
    full: 'NFPA 1221, Standard for the Installation, Maintenance, and Use of Emergency Services Communications Systems, 2019 Edition',
    org: 'NFPA',
  },
  NFPA_1600: {
    key: 'NFPA_1600',
    short: 'NFPA 1600',
    full: 'NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition',
    org: 'NFPA',
  },
  NFPA_20: {
    key: 'NFPA_20',
    short: 'NFPA 20',
    full: 'NFPA 20, Standard for the Installation of Stationary Pumps for Fire Protection, 2022 Edition',
    org: 'NFPA',
  },

  // ========== NIST ==========
  NIST_800_34: {
    key: 'NIST_800_34',
    short: 'NIST SP 800-34',
    full: 'NIST Special Publication 800-34 Rev. 1, Contingency Planning Guide for Federal Information Systems',
    org: 'NIST',
  },
  NIST_SP_800_34: {
    key: 'NIST_SP_800_34',
    short: 'NIST SP 800-34',
    full: 'NIST Special Publication 800-34 Rev. 1, Contingency Planning Guide for Federal Information Systems',
    org: 'NIST',
  },
  NIST_800_61: {
    key: 'NIST_800_61',
    short: 'NIST SP 800-61',
    full: 'NIST Special Publication 800-61 Rev. 2, Computer Security Incident Handling Guide',
    org: 'NIST',
  },
  NIST_800_53: {
    key: 'NIST_800_53',
    short: 'NIST SP 800-53',
    full: 'NIST Special Publication 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    org: 'NIST',
  },
  NIST_SP_800_53: {
    key: 'NIST_SP_800_53',
    short: 'NIST SP 800-53',
    full: 'NIST Special Publication 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    org: 'NIST',
  },
  NIST_SP_800_82: {
    key: 'NIST_SP_800_82',
    short: 'NIST SP 800-82',
    full: 'NIST Special Publication 800-82 Rev. 2, Guide to Industrial Control Systems (ICS) Security',
    org: 'NIST',
  },
  NIST_CSF: {
    key: 'NIST_CSF',
    short: 'NIST CSF',
    full: 'NIST Cybersecurity Framework, Version 1.1',
    org: 'NIST',
  },
  NIST_COMMUNITY_RESILIENCE: {
    key: 'NIST_COMMUNITY_RESILIENCE',
    short: 'NIST SP 1190',
    full: 'NIST Special Publication 1190, Community Resilience Planning Guide for Buildings and Infrastructure Systems',
    org: 'NIST',
  },

  // ========== ISO ==========
  ISO_22301: {
    key: 'ISO_22301',
    short: 'ISO 22301',
    full: 'ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements',
    org: 'ISO',
  },
  ISO_27001: {
    key: 'ISO_27001',
    short: 'ISO 27001',
    full: 'ISO/IEC 27001:2022, Information Security Management Systems — Requirements',
    org: 'ISO',
  },
  ISO_31000: {
    key: 'ISO_31000',
    short: 'ISO 31000',
    full: 'ISO 31000:2018, Risk management — Guidelines',
    org: 'ISO',
  },
  ISO_22320: {
    key: 'ISO_22320',
    short: 'ISO 22320',
    full: 'ISO 22320:2018, Security and resilience — Emergency management — Guidelines for incident management',
    org: 'ISO',
  },

  // ========== EPA ==========
  EPA_WATER_RISK: {
    key: 'EPA_WATER_RISK',
    short: 'EPA Water Sector Risk Assessment',
    full: 'U.S. Environmental Protection Agency, Water Sector Critical Infrastructure Risk and Resilience Assessment, 2021',
    org: 'EPA',
  },
  EPA_WATER_SECURITY: {
    key: 'EPA_WATER_SECURITY',
    short: 'EPA Water Security',
    full: 'U.S. Environmental Protection Agency, Water Infrastructure and Security Guidance, 2022',
    org: 'EPA',
  },
  EPA_WASTEWATER_RESILIENCE: {
    key: 'EPA_WASTEWATER_RESILIENCE',
    short: 'EPA Wastewater Resilience',
    full: 'U.S. Environmental Protection Agency, Resilience Planning for Wastewater Utilities, 2020',
    org: 'EPA',
  },
  EPA_ERP: {
    key: 'EPA_ERP',
    short: 'EPA Emergency Response Plan',
    full: 'U.S. Environmental Protection Agency, Emergency Response Plan Guidance for Water Utilities',
    org: 'EPA',
  },

  // ========== DOE ==========
  DOE_EDE_REPORT: {
    key: 'DOE_EDE_REPORT',
    short: 'DOE EDWG',
    full: 'U.S. Department of Energy, Energy Disruption Working Group Report, 2017',
    org: 'DOE',
  },
  DOE_GRID_MODERNIZATION: {
    key: 'DOE_GRID_MODERNIZATION',
    short: 'DOE Grid Modernization',
    full: 'U.S. Department of Energy, Grid Modernization Laboratory Consortium, Resilience Metrics',
    org: 'DOE',
  },
  DOE_ENERGY_DISRUPTION: {
    key: 'DOE_ENERGY_DISRUPTION',
    short: 'DOE Energy Disruption',
    full: 'U.S. Department of Energy, Energy Sector-Specific Planning for Disruption Events, 2019',
    org: 'DOE',
  },
  DOE_MICROGRIDS: {
    key: 'DOE_MICROGRIDS',
    short: 'DOE Microgrids',
    full: 'U.S. Department of Energy, Microgrids and Resilience Framework for Critical Load Centers, 2021',
    org: 'DOE',
  },
  DOE_ENERGY_RESILIENCY: {
    key: 'DOE_ENERGY_RESILIENCY',
    short: 'DOE Energy Resiliency',
    full: 'U.S. Department of Energy, Energy Resiliency Assessment Framework, 2022',
    org: 'DOE',
  },

  // ========== FCC ==========
  FCC_NORS: {
    key: 'FCC_NORS',
    short: 'FCC NORS',
    full: 'Federal Communications Commission, Network Outage Reporting System (NORS)',
    org: 'FCC',
  },
  FCC_CSRIC: {
    key: 'FCC_CSRIC',
    short: 'FCC CSRIC',
    full: 'Federal Communications Commission, Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations',
    org: 'FCC',
  },
  FCC_COMMS_RESILIENCE: {
    key: 'FCC_COMMS_RESILIENCE',
    short: 'FCC Communications Resilience',
    full: 'Federal Communications Commission, Communications Sector Resilience Best Practices, 2021',
    org: 'FCC',
  },

  // ========== DHS/CISA ==========
  DHS_RESILIENCE_FRAMEWORK: {
    key: 'DHS_RESILIENCE_FRAMEWORK',
    short: 'DHS Infrastructure Resilience',
    full: 'Department of Homeland Security, National Infrastructure Protection Plan: Infrastructure Resilience Framework',
    org: 'DHS',
  },
  DHS_TSP: {
    key: 'DHS_TSP',
    short: 'DHS Telecom Service Priority',
    full: 'Department of Homeland Security, Telecom Service Priority (TSP) Program for Critical Communications',
    org: 'DHS',
  },
  NIPP: {
    key: 'NIPP',
    short: 'NIPP',
    full: 'Department of Homeland Security, National Infrastructure Protection Plan (NIPP), 2013',
    org: 'DHS',
  },
  CISA_CPG: {
    key: 'CISA_CPG',
    short: 'CISA CPG',
    full: 'CISA Cross-Sector Cybersecurity Performance Goals',
    org: 'DHS',
  },
  CISA_EMERGENCY_COMMS_REDUNDANCIES_2021: {
    key: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    short: 'CISA Emergency Comms Redundancies',
    full: 'CISA, Improving Emergency Communications Resiliency through Redundancies, 2021',
    org: 'DHS',
  },
  DHS_CRITICAL_SERVICES: {
    key: 'DHS_CRITICAL_SERVICES',
    short: 'DHS Critical Services',
    full: 'Department of Homeland Security, Critical Services and Key Resources Protection Guidance',
    org: 'DHS',
  },

  // ========== IEEE ==========
  IEEE_RELIABILITY_PRACTICES: {
    key: 'IEEE_RELIABILITY_PRACTICES',
    short: 'IEEE Gold Book',
    full: 'IEEE 493, IEEE Recommended Practice for the Design of Reliable Industrial and Commercial Power Systems (Gold Book), 2007',
    org: 'IEEE',
  },
  IEEE_1100: {
    key: 'IEEE_1100',
    short: 'IEEE 1100',
    full: 'IEEE 1100, IEEE Recommended Practice for Powering and Grounding Electronic Equipment (Emerald Book), 2005',
    org: 'IEEE',
  },
  IEEE_DISTRIBUTION_RELIABILITY: {
    key: 'IEEE_DISTRIBUTION_RELIABILITY',
    short: 'IEEE 1366',
    full: 'IEEE 1366, IEEE Guide for Electric Power Distribution Reliability Indices, 2012',
    org: 'IEEE',
  },

  // ========== IBC/Building Codes ==========
  IBC: {
    key: 'IBC',
    short: 'IBC 2021',
    full: 'International Building Code, 2021 Edition',
    org: 'IBC',
  },
  IBC_2021: {
    key: 'IBC_2021',
    short: 'IBC 2021',
    full: 'International Building Code, 2021 Edition',
    org: 'IBC',
  },

  // ========== ASCE ==========
  ASCE_7: {
    key: 'ASCE_7',
    short: 'ASCE 7-22',
    full: 'ASCE 7-22, Minimum Design Loads and Associated Criteria for Buildings and Other Structures',
    org: 'ASCE',
  },

  // ========== OTHER ==========
  APPA_POWER_RELIABILITY: {
    key: 'APPA_POWER_RELIABILITY',
    short: 'APPA Reliability Guide',
    full: 'American Public Power Association, Distribution System Reliability Guide',
    org: 'OTHER',
  },
  AWWA_STANDARDS: {
    key: 'AWWA_STANDARDS',
    short: 'AWWA Standards',
    full: 'American Water Works Association, Emergency Preparedness Practices (AWWA Manual M19)',
    org: 'OTHER',
  },
  WBDG_RESILIENCE_GOOD_PRACTICES: {
    key: 'WBDG_RESILIENCE_GOOD_PRACTICES',
    short: 'WBDG Resilience Good Practices',
    full: 'Good Practices in Resilience-Based Architectural Designs, Whole Building Design Guide (WBDG)',
    org: 'OTHER',
  },
  WEF_RESILIENCE: {
    key: 'WEF_RESILIENCE',
    short: 'WEF Resilience Manual',
    full: 'Water Environment Federation, Utility Resilience and Hazard Mitigation in Wastewater Management',
    org: 'OTHER',
  },
};

/**
 * Get citation by key. Throws if not found (registry integrity: no build passes with missing keys).
 * Keys are normalized (trimmed) at the boundary to tolerate whitespace from JSON/catalog.
 */
export function getCitation(key: string): CitationRef {
  const k = normalizeCitationKey(key);
  const citation = CITATION_REGISTRY[k];
  if (!citation) {
    throw new Error(
      `Citation key "${k}" not found in registry. Add it to apps/web/app/lib/report/citations/registry.ts`
    );
  }
  return citation;
}

/**
 * Format citations for inline use: "(FEMA CGC; NFPA 110)"
 * Keys are normalized and de-duplicated before lookup.
 */
export function formatInlineCitations(keys: string[]): string {
  if (keys.length === 0) return '';
  const unique = Array.from(new Set(keys.map((k) => normalizeCitationKey(k)).filter(Boolean)));
  const shorts = unique.map((key) => getCitation(key).short);
  return `(${shorts.join('; ')})`;
}

/**
 * Compile and de-duplicate citations used in a report.
 * Returns sorted list grouped by organization.
 * Keys are normalized before lookup and Set de-duplication.
 */
export function compileCitations(usedKeys: string[]): CitationRef[] {
  const normalized = usedKeys.map((k) => normalizeCitationKey(k)).filter(Boolean);
  const unique = Array.from(new Set(normalized));
  const citations = unique.map((key) => getCitation(key));
  
  // Sort by org, then by short name
  const orgOrder: CitationOrg[] = ['FEMA', 'NFPA', 'NIST', 'ISO', 'EPA', 'DOE', 'FCC', 'DHS', 'IEEE', 'IBC', 'ASCE', 'OTHER'];
  
  return citations.sort((a, b) => {
    const orgCompare = orgOrder.indexOf(a.org) - orgOrder.indexOf(b.org);
    if (orgCompare !== 0) return orgCompare;
    return a.short.localeCompare(b.short);
  });
}
