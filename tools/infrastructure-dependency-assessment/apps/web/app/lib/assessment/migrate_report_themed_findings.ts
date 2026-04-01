/**
 * Migrate report_themed_findings from categories.<DOMAIN> to sessions.<DOMAIN>.derived.themedFindings.
 * Themed findings are report output; they belong in sessions.derived, not in categories (normalized input).
 * Call on load, before save, at export, and before building ReportVM so old saved assessments keep working.
 */
import type { Assessment } from 'schema';

const DOMAIN_ORDER = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

type DomainCode = (typeof DOMAIN_ORDER)[number];

/** Keys that may exist in categories from legacy/report pipeline; we migrate and strip, never treat as input. */
const REPORT_ONLY_CATEGORY_KEYS = ['report_themed_findings'] as const;

/**
 * For each domain: if categories[domain].report_themed_findings exists,
 * copy to sessions[domain].derived.themedFindings when derived.themedFindings is missing/empty,
 * then delete from categories. Mutates assessment in place.
 *
 * Rules:
 * - Preserve ofcText on each themed finding (array is copied by reference; items keep ofcText).
 * - Never overwrite existing sessions.derived.themedFindings when it already has entries (sessions version wins).
 * - Never clear sessions.derived.ofcs; when migrating we only set themedFindings, leaving ofcs unchanged.
 */
export function migrateReportThemedFindingsFromCategories(assessment: Assessment): void {
  const categories = assessment.categories as Record<string, Record<string, unknown>> | undefined;
  if (!categories || typeof categories !== 'object') return;

  let sessions = (assessment as Record<string, unknown>).sessions as Record<
    string,
    { derived?: { themedFindings?: unknown[]; ofcs?: unknown[] } }
  > | undefined;
  const ensureSessions = (): Record<string, { derived?: { themedFindings?: unknown[]; ofcs?: unknown[] } }> => {
    if (!sessions || typeof sessions !== 'object') {
      sessions = {};
      (assessment as Record<string, unknown>).sessions = sessions;
    }
    return sessions;
  };

  for (const domain of DOMAIN_ORDER) {
    const cat = categories[domain];
    if (!cat || typeof cat !== 'object') continue;

    const raw = cat[REPORT_ONLY_CATEGORY_KEYS[0]];
    if (raw === undefined) continue;

    const arr = Array.isArray(raw) ? raw : null;
    const sess = ensureSessions();
    let session = sess[domain];
    if (!session || typeof session !== 'object') {
      session = { derived: {} };
      sess[domain] = session;
    }
    if (!session.derived || typeof session.derived !== 'object') {
      session.derived = {};
    }
    const existing = session.derived.themedFindings;
    if (arr && (!Array.isArray(existing) || existing.length === 0)) {
      session.derived.themedFindings = arr;
    }
    delete (cat as Record<string, unknown>)[REPORT_ONLY_CATEGORY_KEYS[0]];
  }
}
