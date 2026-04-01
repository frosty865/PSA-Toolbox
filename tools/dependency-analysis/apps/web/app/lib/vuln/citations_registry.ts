/**
 * Vuln Citations Registry - Authoritative citeable references for vulnerability output.
 * Real sources only; every vulnerability must reference 1+ citations by id.
 */

export type Citation = {
  id: string;
  title: string;
  publisher: string;
  year?: number;
  url: string;
};

export const CITATIONS: Record<string, Citation> = {
  // ─── User-specified authoritative sources ─────────────────────────────────
  FCC_TSP_PROGRAM: {
    id: 'FCC_TSP_PROGRAM',
    title: 'Telecommunications Service Priority (TSP)',
    publisher: 'Federal Communications Commission (FCC)',
    year: 2025,
    url: 'https://www.fcc.gov/telecommunications-service-priority',
  },
  CISA_TSP_SERVICE: {
    id: 'CISA_TSP_SERVICE',
    title: 'Telecommunications Service Priority (TSP)',
    publisher: 'Cybersecurity and Infrastructure Security Agency (CISA)',
    url: 'https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp',
  },
  EPA_POWER_RESILIENCE_2023: {
    id: 'EPA_POWER_RESILIENCE_2023',
    title: 'Power Resilience: Guide for Water and Wastewater Utilities (May 2023 update)',
    publisher: 'U.S. Environmental Protection Agency (EPA)',
    year: 2023,
    url: 'https://www.epa.gov/system/files/documents/2023-05/PowerResilienceGuide_2023_508c.pdf',
  },
  FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK: {
    id: 'FEMA_FEDERAL_CONTINUITY_PLANNING_FRAMEWORK',
    title: 'Federal Continuity Directive: Planning Framework',
    publisher: 'Federal Emergency Management Agency (FEMA)',
    url: 'https://www.fema.gov/sites/default/files/documents/fema_federal-continuity-directive-planning-framework.pdf',
  },
  CISA_EMERGENCY_COMMS_REDUNDANCIES_2021: {
    id: 'CISA_EMERGENCY_COMMS_REDUNDANCIES_2021',
    title: 'Improving Emergency Communications Resiliency through Redundancies',
    publisher: 'Cybersecurity and Infrastructure Security Agency (CISA)',
    year: 2021,
    url: 'https://www.cisa.gov/resources-tools/resources/improving-emergency-communications-resiliency-through-redundancies',
  },
  CISA_PUBLIC_SAFETY_COMMS_RESILIENCY: {
    id: 'CISA_PUBLIC_SAFETY_COMMS_RESILIENCY',
    title: 'Public Safety Communications Resiliency (Keys to Public Safety Network Resiliency)',
    publisher: 'Cybersecurity and Infrastructure Security Agency (CISA)',
    year: 2017,
    url: 'https://www.cisa.gov/sites/default/files/publications/07202017_10_Keys_to_Public_Safety_Network_Resiliency_010418_FINAL508C.pdf',
  },
  WBDG_RESILIENCE_GOOD_PRACTICES: {
    id: 'WBDG_RESILIENCE_GOOD_PRACTICES',
    title: 'Good Practices in Resilience-Based Architectural Designs',
    publisher: 'Whole Building Design Guide (WBDG)',
    url: 'https://www.wbdg.org/resources/good-practices-resilience-based-arch-design',
  },
  // ─── Additional authoritative sources (existing vulns) ─────────────────────
  FEMA_CGC: {
    id: 'FEMA_CGC',
    title: 'FEMA P-2166, Community Continuity Guidance (CCG), 2022',
    publisher: 'Federal Emergency Management Agency (FEMA)',
    year: 2022,
    url: 'https://www.fema.gov/sites/default/files/documents/fema_p2166_community-continuity-guidance.pdf',
  },
  DOE_ENERGY_RESILIENCY: {
    id: 'DOE_ENERGY_RESILIENCY',
    title: 'Energy Resiliency Assessment Framework',
    publisher: 'U.S. Department of Energy (DOE)',
    year: 2022,
    url: 'https://www.energy.gov/ceser/energy-resiliency',
  },
  NFPA_1600: {
    id: 'NFPA_1600',
    title: 'NFPA 1600, Standard on Continuity, Emergency, and Crisis Management, 2024 Edition',
    publisher: 'National Fire Protection Association (NFPA)',
    year: 2024,
    url: 'https://www.nfpa.org/codes-and-standards/nfpa-1600',
  },
  NFPA_110: {
    id: 'NFPA_110',
    title: 'NFPA 110, Standard for Emergency and Standby Power Systems, 2019 Edition',
    publisher: 'National Fire Protection Association (NFPA)',
    year: 2019,
    url: 'https://www.nfpa.org/codes-and-standards/nfpa-110',
  },
  EPA_WATER_SECURITY: {
    id: 'EPA_WATER_SECURITY',
    title: 'Water Infrastructure and Security Guidance',
    publisher: 'U.S. Environmental Protection Agency (EPA)',
    year: 2022,
    url: 'https://www.epa.gov/waterresilience',
  },
  FCC_CSRIC: {
    id: 'FCC_CSRIC',
    title: 'Communications Security, Reliability and Interoperability Council (CSRIC) Recommendations',
    publisher: 'Federal Communications Commission (FCC)',
    url: 'https://www.fcc.gov/about-fcc/advisory-committees/communications-security-reliability-and-interoperability-council',
  },
  DHS_TSP: {
    id: 'DHS_TSP',
    title: 'Telecom Service Priority (TSP) Program for Critical Communications',
    publisher: 'Department of Homeland Security (DHS)',
    url: 'https://www.cisa.gov/resources-tools/services/telecommunications-service-priority-tsp',
  },
  ISO_22301: {
    id: 'ISO_22301',
    title: 'ISO 22301:2019, Security and resilience — Business continuity management systems — Requirements',
    publisher: 'International Organization for Standardization (ISO)',
    year: 2019,
    url: 'https://www.iso.org/standard/75106.html',
  },
  NIST_CSF: {
    id: 'NIST_CSF',
    title: 'NIST Cybersecurity Framework, Version 1.1',
    publisher: 'National Institute of Standards and Technology (NIST)',
    url: 'https://www.nist.gov/cyberframework',
  },
};

export function getCitation(id: string): Citation {
  const c = CITATIONS[id];
  if (!c) throw new Error(`Missing citation: ${id}`);
  return c;
}
