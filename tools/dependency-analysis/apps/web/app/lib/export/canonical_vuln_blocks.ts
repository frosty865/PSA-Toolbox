/**
 * Single source of truth for vulnerability blocks and OFCs.
 * Used by UI (Review & Export summary) and reporter (DOCX).
 * Rebuild from full condition-driven report vulnerabilities at render/export time (do not omit domains).
 * Reporter and web review both consume this list so output stays aligned.
 */
import type { Assessment } from 'schema';
import { buildReportVM, type EvaluatedVulnerability } from '@/app/lib/report/view_model';
import { compileCitations } from '@/app/lib/report/citations/registry';
import { vulnerabilityCitationIds } from '@/app/lib/vuln/vuln_citation_map';
import { CITATIONS } from '@/app/lib/vuln/citations_registry';
import {
  getStandardVulnerability,
  isPraSlaScopedVulnerability,
} from '@/app/lib/report/standards/vofc_standard_registry';
import { isPraSlaEnabled } from '@/lib/pra-sla-enabled';

const DOMAIN_ORDER = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

export type CanonicalVulnBlock = {
  domain: string;
  vuln_id: string;
  title: string;
  narrative: string;
  severity?: string;
  ofcText: string;
  references?: string[];
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type CanonicalTotals = {
  totalFindings: number;
};

type PrebuiltThemedFinding = {
  id?: string;
  title?: string;
  narrative?: string;
  ofcText?: string;
  severity?: string;
  references?: string[];
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
};

export type PrebuiltSessions = Record<
  string,
  {
    derived?: {
      themedFindings?: PrebuiltThemedFinding[];
      ofcs?: Array<{ vulnerability_id: string; text: string }>;
    };
  }
>;

/** Max OFCs per vulnerability; same cap applied in web summary and DOCX. */
const MAX_OFCS_PER_VULN = 3;
const MIN_OFCS_PER_VULN = 2;

type SourceReference = {
  short: string;
  full: string;
};

type DomainCode = typeof DOMAIN_ORDER[number];
type ImpactMetrics = {
  timeToImpactHr?: number;
  lossNoBackupPct?: number;
  recoveryHr?: number;
};

const SEVERITY_ORDER = ['HIGH', 'ELEVATED', 'MODERATE', 'LOW'] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const text = (raw ?? '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function buildSourceReferences(vulnId: string, findingReferences: string[]): SourceReference[] {
  const standard = getStandardVulnerability(vulnId);
  const standardCitationIds = dedupeStrings([
    ...standard.basis_citation_ids,
    ...standard.ofcs.map((ofc) => ofc.citation_id),
  ]);
  if (standardCitationIds.length > 0) {
    return standardCitationIds.map((id) => {
      const citation = CITATIONS[id];
      if (!citation) {
        throw new Error(`Missing citation registry entry "${id}" for vulnerability "${vulnId}".`);
      }
      return {
        short: citation.title,
        full: `${citation.title} - ${citation.url}`,
      };
    });
  }

  const citationIds = vulnerabilityCitationIds(vulnId);
  if (citationIds.length > 0) {
    return citationIds.map((id) => {
      const citation = CITATIONS[id];
      if (!citation) {
        throw new Error(`Missing citation registry entry "${id}" for vulnerability "${vulnId}".`);
      }
      return {
        short: citation.title,
        full: `${citation.title} - ${citation.url}`,
      };
    });
  }

  const refs = dedupeStrings(findingReferences);
  if (refs.length > 0) {
    return refs.map((ref) => ({ short: ref, full: ref }));
  }

  throw new Error(
    `Missing source references for vulnerability ${vulnId || '(unknown)'}: each OFC requires a source reference.`
  );
}

function buildSourceReferencesFromVulnerability(v: EvaluatedVulnerability): SourceReference[] {
  const explicitIds = dedupeStrings((v.citations ?? []).map((id) => String(id ?? '').trim()));
  if (explicitIds.length > 0) {
    const refs = compileCitations(explicitIds);
    if (refs.length > 0) {
      return refs.map((r) => ({ short: r.short, full: r.full }));
    }
  }
  return buildSourceReferences(v.id, []);
}

function normalizeOfcText(ofcText: string): string {
  const t = (ofcText ?? '').trim();
  if (!t) return '';
  return t.replace(/\s*\(\s*source\s*:[^)]+\)\s*/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}

function normalizeReportLanguage(text: string): string {
  if (!text) return '';
  const replacements: Array<[RegExp, string]> = [
    [/\bsource\s+references?\s*:[^.!?]*(?:[.!?]|$)/gi, ''],
    [/\(\s*source\s*:[^)]+\)/gi, ''],
    [/\bassessment(?:\s+input)?\s+(?:indicates|records|documents?)\s+(?:that\s+)?/gi, ''],
    [/\binput\s+records\s+(?:that\s+)?/gi, ''],
    [/\bwithout documented\b/gi, 'without'],
    [/\bnot documented as tested\b/gi, 'not confirmed as tested'],
    [/\bnot documented or confirmed\b/gi, 'not confirmed'],
    [/\bnot documented\b/gi, 'not confirmed'],
    [/\bis documented\b/gi, 'is present'],
    [/\bare documented\b/gi, 'are present'],
    [/\s{2,}/g, ' '],
    [/\s+([,.;:])/g, '$1'],
  ];
  let out = text.replace(/\u00a0/g, ' ').trim();
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out.trim();
}

function splitNarrativeSentences(text: string): string[] {
  const normalized = normalizeReportLanguage(text);
  if (!normalized) return [];
  const matches = normalized.match(/[^.!?]+[.!?]?/g);
  return (matches ?? [normalized])
    .map((m) => {
      const trimmed = m.trim();
      if (!trimmed) return '';
      return `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}`;
    })
    .filter(Boolean);
}

function dedupeSentences(sentences: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const key = trimmed
      .toLowerCase()
      .replace(/[.!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function buildNarrativeParts(v: EvaluatedVulnerability): string[] {
  const canonicalParts = [v.condition_identified, v.operational_exposure, v.why_this_matters]
    .flatMap((part) => splitNarrativeSentences(part ?? ''));
  if (canonicalParts.length > 0) return dedupeSentences(canonicalParts);
  return dedupeSentences(splitNarrativeSentences(v.summary ?? ''));
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function toLossPercent(value: unknown): number | undefined {
  const n = toFiniteNumber(value);
  if (n === undefined) return undefined;
  if (n >= 0 && n <= 1) return n * 100;
  return n;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
}

function readDomainImpactMetrics(assessment: Assessment, domain: DomainCode): ImpactMetrics {
  const categories = (assessment as { categories?: Record<string, unknown> }).categories ?? {};
  const rawCategory = categories[domain] as Record<string, unknown> | undefined;
  if (!rawCategory || typeof rawCategory !== 'object') return {};
  const curve = (rawCategory.curve as Record<string, unknown> | undefined) ?? {};
  return {
    timeToImpactHr: toFiniteNumber(
      rawCategory.curve_time_to_impact_hours ?? rawCategory.time_to_impact_hours ?? curve.time_to_impact_hr
    ),
    lossNoBackupPct: toLossPercent(
      rawCategory.curve_loss_fraction_no_backup ?? rawCategory.loss_fraction_no_backup ?? curve.loss_no_backup_pct
    ),
    recoveryHr: toFiniteNumber(
      rawCategory.curve_recovery_time_hours ?? rawCategory.recovery_time_hours ?? curve.recovery_hr
    ),
  };
}

function buildImpactSentence(metrics: ImpactMetrics): string {
  const parts: string[] = [];
  if (metrics.timeToImpactHr !== undefined) {
    parts.push(`severe impact in ${formatNumber(metrics.timeToImpactHr)} hours`);
  }
  if (metrics.lossNoBackupPct !== undefined) {
    parts.push(`modeled loss without alternate capability reaches ${formatNumber(metrics.lossNoBackupPct)}%`);
  }
  if (metrics.recoveryHr !== undefined) {
    parts.push(`recovery requires about ${formatNumber(metrics.recoveryHr)} hours after restoration`);
  }
  if (parts.length === 0) return '';
  return `Operational impact: ${parts.join('; ')}.`;
}

function buildNarrativeWithImpactAndSource(narrativeParts: string[], metrics: ImpactMetrics): string {
  const baseParts = dedupeSentences(narrativeParts);
  const impactSentence = buildImpactSentence(metrics);
  const parts: string[] = [...baseParts];
  const joinedBase = baseParts.join(' ').toLowerCase();
  const alreadyQuantifiesImpact =
    joinedBase.includes('operational impact:') ||
    joinedBase.includes('severe impact') ||
    joinedBase.includes('functional loss') ||
    joinedBase.includes('recovery over') ||
    joinedBase.includes('recovery requires');
  if (impactSentence && !alreadyQuantifiesImpact) parts.push(impactSentence);
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function deriveSeverity(v: EvaluatedVulnerability): Severity {
  const dc = (v.driverCategory ?? '').toUpperCase();
  if (dc === 'STRUCTURAL') return 'HIGH';
  if (dc === 'CAPABILITY') return 'ELEVATED';
  if (dc === 'ACTIVATION') return 'MODERATE';
  if (dc === 'GOVERNANCE') return 'MODERATE';
  return 'MODERATE';
}

function collectOfcs(v: EvaluatedVulnerability): string[] {
  const standard = getStandardVulnerability(v.id);
  const ofcs = standard.ofcs.map((o) => normalizeReportLanguage(o.text)).filter(Boolean);
  if (ofcs.length < MIN_OFCS_PER_VULN || ofcs.length > MAX_OFCS_PER_VULN) {
    throw new Error(
      `Invalid curated OFC set for "${v.id || '(unknown)'}": ${ofcs.length}. Must be between ${MIN_OFCS_PER_VULN} and ${MAX_OFCS_PER_VULN}.`
    );
  }
  return ofcs;
}

function collectOfcsFromPrebuilt(
  domainDerived: { ofcs?: Array<{ vulnerability_id: string; text: string }> } | undefined,
  finding: { id?: string; ofcText?: string }
): string[] {
  void domainDerived;
  void finding.ofcText;
  const vid = (finding.id ?? '').trim();
  if (!vid) throw new Error('Uncurated vulnerability rejected: missing finding id.');
  const standard = getStandardVulnerability(vid);
  const ofcs = standard.ofcs.map((o) => normalizeReportLanguage(o.text)).filter(Boolean);
  if (ofcs.length < MIN_OFCS_PER_VULN || ofcs.length > MAX_OFCS_PER_VULN) {
    throw new Error(
      `Invalid curated OFC set for "${vid}": ${ofcs.length}. Must be between ${MIN_OFCS_PER_VULN} and ${MAX_OFCS_PER_VULN}.`
    );
  }
  return ofcs;
}

function buildBlocksFromPrebuiltSessions(
  assessment: Assessment,
  sessions: PrebuiltSessions
): CanonicalVulnBlock[] {
  const praSlaEnabled = isPraSlaEnabled(assessment);
  const blocks: CanonicalVulnBlock[] = [];
  for (const code of DOMAIN_ORDER) {
    const derived = sessions[code]?.derived;
    const themed = (derived?.themedFindings ?? []) as PrebuiltThemedFinding[];
    for (const f of themed) {
      if (!f || typeof f !== 'object') continue;
      const title = normalizeReportLanguage((f.title ?? '').trim());
      if (!title) continue;
      const vuln_id = (f.id ?? '').trim() || title;
      if (!praSlaEnabled && isPraSlaScopedVulnerability(vuln_id)) continue;
      const rawNarrative = (f.narrative ?? '').trim();
      const ofcStrings = collectOfcsFromPrebuilt(derived, { id: vuln_id, ofcText: f.ofcText });
      const findingReferences = Array.isArray(f.references)
        ? f.references.filter((r) => typeof r === 'string' && r.trim().length > 0)
        : [];
      const sourceReferences = buildSourceReferences(vuln_id, findingReferences);
      const domainMetrics = readDomainImpactMetrics(assessment, code);
      const narrative = buildNarrativeWithImpactAndSource(
        dedupeSentences(splitNarrativeSentences(rawNarrative)),
        domainMetrics
      );
      const ofcText = ofcStrings
        .map((text) => normalizeOfcText(text))
        .join('\n');
      const references = dedupeStrings(sourceReferences.map((source) => source.full));
      blocks.push({
        domain: code,
        vuln_id,
        title,
        narrative,
        severity: (f.severity ?? '').trim() || undefined,
        ofcText,
        references: references.length > 0 ? references : undefined,
        evidence: Array.isArray(f.evidence) ? f.evidence : undefined,
      });
    }
  }
  return blocks;
}

/**
 * Build the canonical ordered list of vulnerability blocks and totals.
 * No domain is skipped; Wastewater and others are included when vulnerability logic yields findings.
 * OFCs are strict: 2-3 per vulnerability, citation-backed, no placeholders.
 */
export function buildCanonicalVulnBlocks(
  assessment: Assessment,
  prebuiltSessions?: PrebuiltSessions
): {
  canonicalVulnBlocks: CanonicalVulnBlock[];
  canonicalTotals: CanonicalTotals;
} {
  if (prebuiltSessions) {
    const blocks = buildBlocksFromPrebuiltSessions(assessment, prebuiltSessions);
    return {
      canonicalVulnBlocks: blocks,
      canonicalTotals: { totalFindings: blocks.length },
    };
  }

  const vm = buildReportVM(assessment);
  const praSlaEnabled = isPraSlaEnabled(assessment);

  const blocks: CanonicalVulnBlock[] = [];
  for (const code of DOMAIN_ORDER) {
    const infra = (vm.infrastructures ?? []).find((i) => i.code === code);
    if (!infra) continue;

    const hasDefaultProceduralWeakness = (infra.vulnerabilities ?? []).some(
      (v) => (v.id ?? '').trim() === 'DEFAULT_PROCEDURAL_WEAKNESS'
    );
    if (hasDefaultProceduralWeakness) {
      throw new Error(
        `Placeholder vulnerability DEFAULT_PROCEDURAL_WEAKNESS detected in ${code}; canonical output requires condition-derived findings only.`
      );
    }

    const vulns = (infra.vulnerabilities ?? [])
      .filter((v) => (v.id ?? '').trim().length > 0)
      .sort((a, b) => {
        const as = SEVERITY_ORDER.indexOf(deriveSeverity(a));
        const bs = SEVERITY_ORDER.indexOf(deriveSeverity(b));
        if (as !== bs) return as - bs;
        return (a.title ?? '').localeCompare(b.title ?? '');
      });

    const seen = new Set<string>();
    for (const v of vulns) {
      const vuln_id = (v.id ?? '').trim();
      if (!praSlaEnabled && isPraSlaScopedVulnerability(vuln_id)) continue;
      if (seen.has(vuln_id)) continue;
      seen.add(vuln_id);

      const title = normalizeReportLanguage((v.title ?? '').trim());
      if (!title) continue;

      const sourceReferences = buildSourceReferencesFromVulnerability(v);
      const domainMetrics = readDomainImpactMetrics(assessment, code);
      const baseNarrative = buildNarrativeParts(v);
      const narrative = buildNarrativeWithImpactAndSource(
        baseNarrative.length > 0 ? baseNarrative : splitNarrativeSentences(title),
        domainMetrics
      );
      const ofcStrings = collectOfcs(v);
      const ofcText = ofcStrings
        .map((text) => normalizeOfcText(text))
        .join('\n');
      const references = dedupeStrings(sourceReferences.map((source) => source.full));
      blocks.push({
        domain: code,
        vuln_id,
        title,
        narrative,
        severity: deriveSeverity(v),
        ofcText,
        references: references.length > 0 ? references : undefined,
      });
    }
  }

  return {
    canonicalVulnBlocks: blocks,
    canonicalTotals: { totalFindings: blocks.length },
  };
}
