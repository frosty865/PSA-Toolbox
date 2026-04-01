/**
 * Synthesis Builder
 *
 * Deterministic, number-anchored, sector-specific synthesis.
 * Uses actual computed values (TTI, LOSS, recovery hours, alternate duration, provider/path conditions).
 * No generic filler language. No SAFE references. No cyber governance language.
 */

import type { KeyRiskDriverVM } from './vulnerability';
import type { CurveSummary } from './view_model';
import type { NormalizedConditions, SectorConditions } from './normalize_conditions';
import { formatHours } from './format_hours';

/** Prohibited phrases — must not appear in synthesis output (no-assumptions rule). */
export const SYNTHESIS_PROHIBITED_PHRASES = [
  'operational sensitivity',
  'structural constraint',
  'design-level constraint',
  'infrastructure backbone',
  'multi-infrastructure environment',
  'risk landscape',
  'resilience posture',
  'SAFE',
  'is expected',
  'will cause',
  'eliminates supply',
  'automatic failover',
  'manual failover',
  'vendor initiated',
  'immediate degradation is expected',
] as const;

/** Assert synthesis text contains no prohibited phrases. */
export function assertNoProhibitedPhrases(text: string): void {
  const lower = text.toLowerCase();
  for (const phrase of SYNTHESIS_PROHIBITED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      throw new Error(`Synthesis contains prohibited phrase: "${phrase}"`);
    }
  }
}

const SECTOR_ORDER: Array<keyof NormalizedConditions> = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

const SECTOR_DISPLAY: Record<string, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

function infraToSector(infra: string): keyof NormalizedConditions | undefined {
  const entry = Object.entries(SECTOR_DISPLAY).find(([, v]) => v === infra);
  return entry ? (entry[0] as keyof NormalizedConditions) : undefined;
}

function formatPercent(n: number): number {
  return Math.round(n);
}

function formatList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** Input for numeric synthesis. */
export type NumericSynthesisInput = {
  infraCurves: CurveSummary[];
  normalizedConditions: NormalizedConditions;
};

/**
 * Build numeric synthesis as a single string (3 paragraphs max).
 * Deterministic, sector-anchored, no filler.
 */
export function buildNumericSynthesis(input: NumericSynthesisInput): string {
  const { infraCurves, normalizedConditions } = input;

  const sectorsWithData = infraCurves
    .map((c) => ({ curve: c, sector: infraToSector(c.infra) }))
    .filter((x): x is { curve: CurveSummary; sector: keyof NormalizedConditions } => x.sector != null);

  if (sectorsWithData.length === 0) {
    return 'Complete the dependency assessment to generate synthesis and risk posture classification.';
  }

  const paragraphs: string[] = [];

  // ─── SECTION 1: PRIMARY OPERATIONAL CONSTRAINT ─────────────────────────────
  const withTti = sectorsWithData.filter(
    (x) => typeof x.curve.time_to_impact_hr === 'number' && typeof x.curve.loss_no_backup_pct === 'number'
  );

  if (withTti.length > 0) {
    const tti = (c: CurveSummary) => c.time_to_impact_hr ?? 999;
    const loss = (c: CurveSummary) => c.loss_no_backup_pct ?? 0;
    const severityScore = (x: { curve: CurveSummary; sector: keyof NormalizedConditions }) =>
      (x.curve.loss_no_backup_pct ?? 0) + Math.max(0, 72 - (x.curve.time_to_impact_hr ?? 72));

    const sectorRank = (s: keyof NormalizedConditions) => SECTOR_ORDER.indexOf(s);
    const bySeverity = [...withTti].sort(
      (a, b) => severityScore(b) - severityScore(a) || sectorRank(a.sector) - sectorRank(b.sector)
    );
    const byTti = [...withTti].sort(
      (a, b) => tti(a.curve) - tti(b.curve) || sectorRank(a.sector) - sectorRank(b.sector)
    );
    const byLoss = [...withTti].sort(
      (a, b) => loss(b.curve) - loss(a.curve) || sectorRank(a.sector) - sectorRank(b.sector)
    );

    const D = bySeverity[0];
    const F = byTti[0];
    const L = byLoss[0];

    const ttiD = D.curve.time_to_impact_hr!;
    const lossD = formatPercent(D.curve.loss_no_backup_pct!);
    const ttiF = F.curve.time_to_impact_hr!;
    const lossL = formatPercent(L.curve.loss_no_backup_pct!);

    const p1Parts: string[] = [];
    p1Parts.push(
      `The first constraint affecting resilience is ${SECTOR_DISPLAY[D.sector]}: severe impact can begin in ${formatHours(ttiD)} and modeled loss can reach about ${lossD}% without alternate capability.`
    );
    if (D.sector !== F.sector || D.sector !== L.sector) {
      p1Parts.push(
        `For planning priority, the fastest time-to-impact is ${SECTOR_DISPLAY[F.sector]} (${formatHours(ttiF)}), while the deepest modeled loss is ${SECTOR_DISPLAY[L.sector]} (~${lossL}%).`
      );
    }
    paragraphs.push(p1Parts.join(' '));
  }

  // ─── SECTION 2: SHARED EXPOSURE PATTERN ────────────────────────────────────
  const p2Parts: string[] = [];
  const singleProvider: string[] = [];
  const entrySingle: string[] = [];
  const corridorYes: string[] = [];
  const noAlternate: string[] = [];
  const shortAlternate: string[] = [];

  for (const sector of SECTOR_ORDER) {
    const cond = normalizedConditions[sector] as SectorConditions | undefined;
    if (!cond?.requires_service) continue;

    const name = SECTOR_DISPLAY[sector];
    if (cond.single_provider_or_path === 'YES') singleProvider.push(name);
    if (cond.entry_diversity === 'SINGLE') entrySingle.push(name);
    if (cond.corridor_colocated === 'YES') corridorYes.push(name);
    if (cond.alternate_present === false) noAlternate.push(name);
    if (cond.alternate_duration_class === 'SHORT' && cond.alternate_present) shortAlternate.push(name);
  }

  if (singleProvider.length > 0) {
    p2Parts.push(`Single service-connection exposure appears in ${formatList(singleProvider)}.`);
  }
  if (noAlternate.length > 0) {
    p2Parts.push(`Alternate capability is not present in ${formatList(noAlternate)}.`);
  }
  if (shortAlternate.length > 0) {
    p2Parts.push(`Alternate sustainment is short-duration (<12 hours) in ${formatList(shortAlternate)}.`);
  }
  if (entrySingle.length > 0) {
    p2Parts.push(`Single building-entry diversity is reported in ${formatList(entrySingle)}.`);
  }
  if (corridorYes.length > 0) {
    p2Parts.push(`Shared/co-located utility corridor exposure is present in ${formatList(corridorYes)}.`);
  }

  if (p2Parts.length > 0) {
    paragraphs.push(`Across infrastructure dependencies, ${p2Parts.join(' ')}`);
  }

  // ─── SECTION 3: DECISION FOCUS ─────────────────────────────────────────────
  const restorationGaps: string[] = [];
  const recoveryLong: string[] = [];

  for (const sector of SECTOR_ORDER) {
    const cond = normalizedConditions[sector] as SectorConditions | undefined;
    if (!cond?.requires_service) continue;

    const name = SECTOR_DISPLAY[sector];
    if (cond.restoration_priority_established !== 'YES') restorationGaps.push(name);
    if (cond.recovery_duration_class === 'LONG') recoveryLong.push(name);
  }

  const actionParts: string[] = [];
  if (restorationGaps.length > 0) {
    actionParts.push(`set restoration prioritization and escalation ownership for ${formatList(restorationGaps)}`);
  }
  if (recoveryLong.length > 0) {
    actionParts.push(`reduce long recovery dependency (>24 hours) for ${formatList(recoveryLong)}`);
  }
  if (noAlternate.length > 0) {
    actionParts.push(`add tested alternate capability for ${formatList(noAlternate)}`);
  }
  if (actionParts.length > 0) {
    paragraphs.push(`Decision focus for the next resilience cycle: ${actionParts.join('; ')}.`);
  } else {
    paragraphs.push('Decision focus for the next resilience cycle: maintain current controls and validate them through periodic disruption exercises.');
  }

  // ─── SECTION 4: OVERALL CLASSIFICATION ─────────────────────────────────────
  let highSeverityCount = 0;
  let singlePointCount = 0;
  let noAlternateCount = 0;

  for (const sector of SECTOR_ORDER) {
    const cond = normalizedConditions[sector] as SectorConditions | undefined;
    const curve = sectorsWithData.find((x) => x.sector === sector)?.curve;
    if (!cond?.requires_service) continue;

    const loss = curve?.loss_no_backup_pct ?? 0;
    const tti = curve?.time_to_impact_hr ?? 999;
    if (loss >= 75 || tti <= 4) highSeverityCount++;
    if (cond.single_provider_or_path === 'YES') singlePointCount++;
    if (cond.alternate_present === false) noAlternateCount++;
  }

  let posture: string;
  if (highSeverityCount >= 3 && singlePointCount >= 2) {
    posture = 'HIGH';
  } else if (highSeverityCount >= 2) {
    posture = 'MODERATE';
  } else {
    posture = 'LIMITED';
  }

  paragraphs.push(`Structural Sensitivity: ${posture}.`);

  const full = paragraphs
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();

  assertNoProhibitedPhrases(full);
  return full;
}

/**
 * Synthesis section structure.
 */
export type SynthesisSection = {
  heading: string;
  sections: Array<{
    heading: string;
    paragraphs: Array<{ text: string; citations?: any[] }>;
  }>;
};

/**
 * Build complete Synthesis section.
 * Uses buildNumericSynthesis when curves and conditions are available;
 * falls back to driver-based synthesis when only drivers exist (legacy).
 */
export function buildSynthesis(args: {
  drivers: KeyRiskDriverVM[];
  allTriggered: Array<unknown>;
  infraCurves: CurveSummary[];
  normalizedConditions?: NormalizedConditions;
}): SynthesisSection {
  const { drivers, infraCurves, normalizedConditions } = args;

  if (normalizedConditions && infraCurves.length > 0) {
    const text = buildNumericSynthesis({ infraCurves, normalizedConditions });
    return {
      heading: 'Risk Posture Synthesis',
      sections: [
        {
          heading: 'Synthesis',
          paragraphs: text.split(/\n\n+/).map((t) => ({ text: t.trim() })),
        },
      ],
    };
  }

  if (drivers.length === 0) {
    return {
      heading: 'Risk Posture Synthesis',
      sections: [
        {
          heading: 'Assessment not yet completed',
          paragraphs: [
            {
              text: 'Complete the dependency assessment to generate synthesis and risk posture classification.',
            },
          ],
        },
      ],
    };
  }

  const topDriver = drivers[0];
  return {
    heading: 'Risk Posture Synthesis',
    sections: [
      {
        heading: 'Dominant Operational Constraint',
        paragraphs: [
          {
            text: `${topDriver.title} represents the primary structural constraint. ${topDriver.narrative}`,
          },
        ],
      },
    ],
  };
}
