/**
 * Converts themed findings to the derived pipeline format (vulnerabilities + OFCs).
 * Preserves backward compatibility with existing consumers.
 */
import type { ThemedFinding } from './themeTypes';

export type DerivedVulnerability = {
  id: string;
  text: string;
  infrastructure?: string;
  /** Optional evidence for report rendering. */
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type DerivedOfc = {
  id: string;
  text: string;
  vulnerability_id: string;
};

export function themedFindingsToDerived(
  findings: ThemedFinding[],
  infrastructure: 'Energy' | 'Communications' | 'InformationTechnology' | 'Water' | 'Wastewater',
): { vulnerabilities: DerivedVulnerability[]; ofcs: DerivedOfc[] } {
  const vulnerabilities: DerivedVulnerability[] = findings.map((f) => ({
    id: f.id,
    text: `${f.title}. ${f.narrative}`,
    infrastructure,
    evidence: f.evidence.length ? f.evidence : undefined,
  }));
  const ofcs: DerivedOfc[] = findings
    .filter((f) => f.ofcText)
    .map((f) => ({
      id: `OFC-${f.id}`,
      text: f.ofcText!,
      vulnerability_id: f.id,
    }));
  return { vulnerabilities, ofcs };
}
