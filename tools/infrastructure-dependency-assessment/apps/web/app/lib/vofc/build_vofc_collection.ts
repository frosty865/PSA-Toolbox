import type { Assessment, CategoryCode, VOFC, VOFCCollection } from 'schema';
import { buildCanonicalVulnBlocks } from '@/app/lib/export/canonical_vuln_blocks';
import {
  buildReportThemedFindingsForExport,
  buildSessionsDerivedFromAssessment,
} from '@/app/lib/export/build_report_themed_findings';
import { CITATIONS, type Citation } from '@/app/lib/vuln/citations_registry';
import {
  getStandardVulnerability,
  isPraSlaScopedVulnerability,
} from '@/app/lib/report/standards/vofc_standard_registry';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

const CATEGORY_CODES = new Set<CategoryCode>([
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
  'CRITICAL_PRODUCTS',
]);

const TOOL_VERSION_FALLBACK = '0.1.0';
const MAX_VOFCS_PER_CATEGORY = 4;

function cloneAssessment(assessment: Assessment): Assessment {
  const g = globalThis as { structuredClone?: <T>(value: T) => T };
  if (typeof g.structuredClone === 'function') {
    return g.structuredClone(assessment);
  }
  return JSON.parse(JSON.stringify(assessment)) as Assessment;
}

function toSeverity(
  severity: string | undefined
): VOFC['base_severity'] {
  if (severity === 'HIGH') return 'HIGH';
  if (severity === 'LOW') return 'LOW';
  return 'MODERATE';
}

function sanitizeIdPart(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'UNSPECIFIED';
}

function sortForDoctrine(a: VOFC, b: VOFC): number {
  const rank = (s: VOFC['base_severity']) => (s === 'HIGH' ? 0 : s === 'MODERATE' ? 1 : 2);
  const bySeverity = rank(a.base_severity) - rank(b.base_severity);
  if (bySeverity !== 0) return bySeverity;
  return a.vofc_id.localeCompare(b.vofc_id);
}

function getCuratedOfcsForVulnerability(vulnId: string): Array<{ text: string; citation: Citation }> {
  const curated = getStandardVulnerability(vulnId).ofcs;
  if (curated.length < 2 || curated.length > 3) {
    throw new Error(`Invalid curated OFC set for "${vulnId}". Each vulnerability must have at least 2 and fewer than 4 OFCs.`);
  }
  return curated.map((item) => {
    const citation = CITATIONS[item.citation_id];
    if (!citation) {
      throw new Error(`Citation id "${item.citation_id}" not found for vulnerability "${vulnId}".`);
    }
    const text = (item.text ?? '').trim();
    if (!text) {
      throw new Error(`Empty curated OFC text for vulnerability "${vulnId}".`);
    }
    return { text, citation };
  });
}

/**
 * Build VOFC collection from in-app derived findings (report pipeline), not workbook/library rows.
 * This keeps VOFC output aligned with the current condition-trigger logic and displayed report findings.
 */
export function buildVofcCollectionFromAssessment(assessment: Assessment): VOFCCollection {
  const working = cloneAssessment(assessment);
  const praSlaEnabled = isPraSlaEnabled(working);
  buildReportThemedFindingsForExport(working);
  buildSessionsDerivedFromAssessment(working);
  const { canonicalVulnBlocks } = buildCanonicalVulnBlocks(working);

  const grouped = new Map<CategoryCode, VOFC[]>();

  const eligibleBlocks = canonicalVulnBlocks.filter(
    (block) => praSlaEnabled || !isPraSlaScopedVulnerability(block.vuln_id)
  );
  for (const block of eligibleBlocks) {
    const category = block.domain as CategoryCode;
    if (!CATEGORY_CODES.has(category)) continue;

    const baseSeverity = toSeverity(block.severity);
    const title = (block.title ?? '').trim() || block.vuln_id || 'Untitled vulnerability';
    const vulnerability = (block.narrative ?? '').trim() || title;
    const vulnIdPart = sanitizeIdPart(block.vuln_id || title);
    const vulnId = (block.vuln_id ?? '').trim();
    const curatedOfcs = getCuratedOfcsForVulnerability(vulnId);
    const selectedOfcs = curatedOfcs.map((o) => ({ text: o.text, citation: o.citation }));

    if (selectedOfcs.length < 2 || selectedOfcs.length > 3) {
      throw new Error(
        `Invalid OFC set for "${vulnId || title}": ${selectedOfcs.length}. Each vulnerability must have at least 2 and fewer than 4 OFCs.`
      );
    }

    const current = grouped.get(category) ?? [];
    if (current.length >= MAX_VOFCS_PER_CATEGORY) {
      grouped.set(category, current);
      continue;
    }

    for (let i = 0; i < selectedOfcs.length; i++) {
      if (current.length >= MAX_VOFCS_PER_CATEGORY) break;
      const ofc = selectedOfcs[i];
      const hasSource = /\(\s*Source\s*:/i.test(ofc.text);
      const sourcedOfcText = hasSource
        ? ofc.text
        : ofc.citation
          ? `${ofc.text} (Source: ${ofc.citation.title} — ${ofc.citation.url})`
          : (() => {
              throw new Error(`Missing source citation for vulnerability "${vulnId || title}" OFC #${i + 1}.`);
            })();
      current.push({
        vofc_id: `${category}::${vulnIdPart}::${i + 1}`,
        category,
        title,
        vulnerability,
        impact: null,
        option_for_consideration: sourcedOfcText,
        base_severity: baseSeverity,
        calibrated_severity: baseSeverity,
        calibration_reason: null,
        applicability: 'POTENTIAL',
        origin: 'SOURCE',
        source_ref: ofc.citation?.url,
        source_registry_id: ofc.citation?.id,
        source_publisher: ofc.citation?.publisher,
        source_tier: ofc.citation ? 1 : undefined,
      });
    }

    grouped.set(category, current);
  }

  const items: VOFC[] = [];
  for (const category of grouped.keys()) {
    const rows = grouped.get(category) ?? [];
    rows.sort(sortForDoctrine);
    items.push(...rows);
  }

  return {
    generated_at_iso: new Date().toISOString(),
    tool_version: assessment.meta?.tool_version ?? TOOL_VERSION_FALLBACK,
    items,
  };
}
