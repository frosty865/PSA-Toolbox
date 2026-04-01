/**
 * Canonical VOFC narrative model for report export (narrative-only, no tables).
 * TS + Python compatible; used for [[VULN_NARRATIVE]] anchor.
 */

export const SECTOR_IDS = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;
export type VofcSectorId = (typeof SECTOR_IDS)[number];

export type EvidenceItem = {
  kind: 'assessment' | 'curve' | 'reference';
  text: string;
};

export type VofcVulnerability = {
  sector_id: VofcSectorId;
  title: string;
  condition: string;
  impact: string;
  evidence: EvidenceItem[];
  ofcs: string[];
};

export type VofcSectorReport = {
  sector_id: VofcSectorId;
  sector_label: string;
  sector_doctrine: string;
  vulnerabilities: VofcVulnerability[];
};

export type VofcNarrative = {
  sectors: VofcSectorReport[];
};
