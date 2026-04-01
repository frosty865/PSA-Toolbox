/**
 * Build report_themed_findings per category for Part II narrative (themedFindings).
 * Used by export so reporter can render from title/narrative/ofcText when present.
 */
import type { Assessment } from 'schema';
import {
  electricPowerCategoryToEnergyAnswers,
  commsCategoryToCommsAnswers,
  itCategoryToItAnswers,
  waterCategoryToWaterAnswers,
  wastewaterCategoryToWastewaterAnswers,
} from '@/app/lib/io/syncAssessmentToSessions';
import { deriveEnergyFindings } from '@/app/lib/dependencies/derive_energy_findings';
import { deriveCommsFindings } from '@/app/lib/dependencies/derive_comms_findings';
import { deriveItFindings } from '@/app/lib/dependencies/derive_it_findings';
import { deriveWaterFindings } from '@/app/lib/dependencies/derive_water_findings';
import { deriveWastewaterFindings } from '@/app/lib/dependencies/derive_wastewater_findings';
import type { ThemedFinding } from '@/app/lib/dependencies/vulnerabilities/themeTypes';
import { buildVulnerabilityReferences } from '@/app/lib/vuln/vuln_citation_map';

const CURVE_CATEGORIES = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

export type ReportThemedFinding = {
  id: string;
  domain: string;
  severity?: 'HIGH' | 'ELEVATED' | 'MODERATE' | 'LOW';
  title: string;
  narrative: string;
  ofcText: string;
  evidence?: Array<{ question_id: string; answer?: string | boolean }>;
  references?: string[];
  tags?: string[];
  sources?: unknown;
};

function mapThemedToReport(tf: ThemedFinding, domain: string): ReportThemedFinding {
  const severity = (tf as { severity?: string }).severity;
  const allowedSeverity =
    severity === 'HIGH' || severity === 'ELEVATED' || severity === 'MODERATE' || severity === 'LOW'
      ? severity
      : undefined;
  const findingId = (tf.id ?? (tf as { key?: string }).key ?? tf.title ?? '').trim();
  return {
    id: findingId,
    domain,
    severity: allowedSeverity,
    title: (tf.title ?? '').trim(),
    narrative: (tf.narrative ?? '').trim(),
    ofcText: (tf.ofcText ?? '').trim(),
    evidence: Array.isArray((tf as { evidence?: unknown }).evidence)
      ? ((tf as { evidence: Array<{ question_id: string; answer?: string | boolean }> }).evidence)
      : undefined,
    references:
      Array.isArray((tf as { references?: unknown }).references) &&
      ((tf as { references?: unknown[] }).references ?? []).every((r) => typeof r === 'string')
        ? ((tf as { references?: string[] }).references)
        : buildVulnerabilityReferences(findingId),
  };
}

/**
 * Build report_themed_findings for all curve categories and attach to assessment.categories.
 * Mutates assessment so each category gets report_themed_findings when derive returns themedFindings.
 * Does not remove vulnerability_blocks (additive for backward compatibility).
 */
export function buildReportThemedFindingsForExport(assessment: Assessment): void {
  const categories = assessment.categories as Record<string, Record<string, unknown>> | undefined;
  if (!categories) return;

  for (const code of CURVE_CATEGORIES) {
    const cat = categories[code];
    if (!cat || typeof cat !== 'object') continue;

    try {
      let themedFindings: ThemedFinding[] = [];

      if (code === 'ELECTRIC_POWER') {
        const normalized = electricPowerCategoryToEnergyAnswers(cat);
        const answers = {
          ...(cat.answers && typeof cat.answers === 'object'
            ? (cat.answers as import('@/app/lib/dependencies/infrastructure/energy_spec').EnergyAnswers)
            : {}),
          ...normalized,
        } as import('@/app/lib/dependencies/infrastructure/energy_spec').EnergyAnswers;
        const derived = deriveEnergyFindings(answers);
        themedFindings = derived.themedFindings ?? [];
      } else if (code === 'COMMUNICATIONS') {
        const normalized = commsCategoryToCommsAnswers(cat);
        const answers = {
          ...(cat.answers && typeof cat.answers === 'object'
            ? (cat.answers as import('@/app/lib/dependencies/infrastructure/comms_spec').CommsAnswers)
            : {}),
          ...normalized,
        } as import('@/app/lib/dependencies/infrastructure/comms_spec').CommsAnswers;
        const derived = deriveCommsFindings(answers);
        themedFindings = derived.themedFindings ?? [];
      } else if (code === 'INFORMATION_TECHNOLOGY') {
        const normalized = itCategoryToItAnswers(cat);
        const answers = {
          ...(cat.answers && typeof cat.answers === 'object'
            ? (cat.answers as import('@/app/lib/dependencies/infrastructure/it_spec').ItAnswers)
            : {}),
          ...normalized,
        } as import('@/app/lib/dependencies/infrastructure/it_spec').ItAnswers;
        const derived = deriveItFindings(answers, { categoryInput: cat });
        themedFindings = derived.themedFindings ?? [];
      } else if (code === 'WATER') {
        const normalized = waterCategoryToWaterAnswers(cat);
        const answers = {
          ...(cat.answers && typeof cat.answers === 'object'
            ? (cat.answers as import('@/app/lib/dependencies/infrastructure/water_spec').WaterAnswers)
            : {}),
          ...normalized,
        } as import('@/app/lib/dependencies/infrastructure/water_spec').WaterAnswers;
        const derived = deriveWaterFindings(answers);
        themedFindings = derived.themedFindings ?? [];
      } else if (code === 'WASTEWATER') {
        const normalized = wastewaterCategoryToWastewaterAnswers(cat);
        const answers = {
          ...(cat.answers && typeof cat.answers === 'object'
            ? (cat.answers as import('@/app/lib/dependencies/infrastructure/wastewater_spec').WastewaterAnswers)
            : {}),
          ...normalized,
        } as import('@/app/lib/dependencies/infrastructure/wastewater_spec').WastewaterAnswers;
        const derived = deriveWastewaterFindings(answers);
        themedFindings = derived.themedFindings ?? [];
      }

      const report_themed_findings = themedFindings.map((tf) => mapThemedToReport(tf, code));
      (cat as Record<string, unknown>).report_themed_findings = report_themed_findings;
    } catch {
      (cat as Record<string, unknown>).report_themed_findings = [];
    }
  }
}

/** Domain order for reporter (matches PART2_CATEGORY_ORDER). */
const DERIVED_DOMAIN_ORDER = [...CURVE_CATEGORIES] as const;

export type SessionsDerived = {
  themedFindings: ReportThemedFinding[];
  vulnerabilities: Array<{ id: string; text: string; infrastructure?: string }>;
  ofcs: Array<{ id: string; text: string; vulnerability_id: string }>;
};

/**
 * Build assessment.sessions.<domain>.derived from report_themed_findings so the reporter
 * can render from a single source (derived) without re-deriving. Call after buildReportThemedFindingsForExport.
 */
export function buildSessionsDerivedFromAssessment(assessment: Assessment): Record<string, { derived: SessionsDerived }> {
  const categories = assessment.categories as Record<string, { report_themed_findings?: ReportThemedFinding[] }> | undefined;
  const sessions: Record<string, { derived: SessionsDerived }> = {};
  if (!categories) return sessions;

  for (const code of DERIVED_DOMAIN_ORDER) {
    const cat = categories[code];
    const arr = (cat?.report_themed_findings ?? []) as ReportThemedFinding[];
    const themedFindings = arr.filter((item) => item && typeof item === 'object');
    const vulnerabilities = themedFindings.map((f) => ({
      id: (f.id ?? '').trim() || `v-${code}-${themedFindings.indexOf(f)}`,
      text: `${(f.title ?? '').trim()}. ${(f.narrative ?? '').trim()}`.trim(),
      infrastructure: code,
    }));
    const ofcs = themedFindings
      .filter((f) => (f.ofcText ?? '').trim())
      .map((f) => ({
        id: `OFC-${(f.id ?? '').trim() || f.title}`,
        text: (f.ofcText ?? '').trim(),
        vulnerability_id: (f.id ?? '').trim() || (f.title ?? ''),
      }));
    sessions[code] = { derived: { themedFindings, vulnerabilities, ofcs } };
  }
  return sessions;
}
