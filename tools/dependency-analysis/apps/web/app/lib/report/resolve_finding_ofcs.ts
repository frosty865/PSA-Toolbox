/**
 * Canonical OFC resolver for report/view-model layer.
 * Single source of truth: standards registry.
 * Rule: each vulnerability must resolve to 2-3 curated OFCs.
 */
import { getStandardVulnerability } from './standards/vofc_standard_registry';

export type DomainDerived = {
  themedFindings?: Array<{ id?: string; title?: string; narrative?: string; ofcText?: string }>;
  ofcs?: Array<{ id?: string; text: string; vulnerability_id: string }>;
};

export type FindingLike = {
  id?: string;
  title?: string;
  ofcText?: string;
};

/**
 * Resolve Options for Consideration for a single finding from standards registry only.
 */
export function resolveFindingOfcs(
  domainDerived: DomainDerived | undefined,
  findingId: string,
  finding: FindingLike
): string[] {
  void domainDerived;
  void finding;
  const vid = (findingId ?? '').trim();
  if (!vid) throw new Error('Uncurated vulnerability rejected: missing finding id.');
  const standard = getStandardVulnerability(vid);
  return standard.ofcs.map((o) => o.text.trim()).filter(Boolean);
}
