/**
 * Executive Snapshot Content Engine
 *
 * Curve/engine-math driven, deterministic content generation for DOCX anchors:
 * [[SNAPSHOT_POSTURE]], [[SNAPSHOT_SUMMARY]], [[SNAPSHOT_DRIVERS]], [[SNAPSHOT_MATRIX]], [[SNAPSHOT_CASCADE]]
 *
 * DESIGN PRINCIPLES:
 * - Non-generic, non-redundant, dependency-focused
 * - Absolute computed values (hours, %, durations) from engine/curves
 * - Deterministic: same inputs → same wording, ordering, ranking
 * - No SAFE, no cyber governance, no boilerplate
 */

import type { SummaryRow } from 'engine';
import type { Assessment, CrossDependencyEdge } from 'schema';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { formatHours } from './format_hours';

const SECTOR_ORDER = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

type SectorCode = (typeof SECTOR_ORDER)[number];

const SECTOR_LABELS: Record<SectorCode, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

type PostureLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';

type RedundancyLevel = 'STRONG' | 'PARTIAL' | 'WEAK';

type SustainmentLevel = 'NONE' | 'SHORT' | 'MODERATE' | 'LONG';

type ProviderConfidence = 'CONFIRMED' | 'UNCONFIRMED';

/** Structural driver phrases (controlled set, no freeform). */
const STRUCTURAL_PHRASES = [
  'single provider identified',
  'provider not confirmed',
  'single entry/termination location',
  'co-located utility corridor exposure',
  'no alternate capability',
  'alternate requires manual or vendor initiation',
  'alternate capability is short-duration',
  'priority restoration not established',
  'recovery path relies on same corridor',
  'hosted/managed services depend on a single carrier/path',
] as const;

type StructuralPhrase = (typeof STRUCTURAL_PHRASES)[number];

export type CorridorLevel = 'COLOCATED' | 'SEPARATED' | 'UNKNOWN';
export type PriorityRestoreLevel = 'YES' | 'NO' | 'UNKNOWN';

export type SectorData = {
  code: SectorCode;
  label: string;
  tti: number;
  loss: number;
  lossWithAlt: number | null;
  altSust: number | null;
  rec: number;
  redund: RedundancyLevel;
  slaEstablished: boolean;
  providerConfirmed: boolean;
  sectorSeverityScore: number;
  outDegree: number;
  /** For synthesis: COLOCATED if shared corridor; SEPARATED if no; UNKNOWN if not assessed. */
  corridor: CorridorLevel;
  /** For synthesis: YES if priority restoration established; NO/UNKNOWN otherwise. */
  priorityRestore: PriorityRestoreLevel;
  /** True when alternate exists but requires manual/vendor initiation. */
  redundancyInitiationManual?: boolean;
  /** IT only: true when Hosted/Upstream Dependencies table has entries. Transport provider is separate. */
  upstreamDocumented?: boolean;
};

export type ExecutiveSnapshotContent = {
  posture: string;
  summary: string;
  /** Hotel Fact Sheet section: 2–5 sentences, no bullets/tables. Injected at TABLE_SUMMARY anchor. */
  executive_summary_brief: string;
  drivers: string[];
  matrixRows: Array<{
    sector: string;
    ttiHrs: string;
    lossPct: string;
    backupHrs: string;
    structuralPosture: string;
    /** IT: when upstream/hosted table has entries. Template may fold into Notes. */
    notes?: string;
  }>;
  cascade: string | null;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function roundHours(h: number): number {
  if (Number.isInteger(h)) return h;
  return Math.round(h * 4) / 4;
}

function roundPct(p: number): number {
  return Math.round(clamp(p, 0, 100));
}

function parseRedundancy(sources: string | null): RedundancyLevel {
  if (!sources) return 'WEAK';
  if (sources.includes('independent')) return 'STRONG';
  if (sources.includes('2+')) return 'PARTIAL';
  return 'WEAK';
}

function parseSlaEstablished(sla: string | null): boolean {
  if (!sla) return false;
  return sla.toLowerCase().startsWith('yes');
}

/** Transport provider identified (last mile / circuit carrier). Do NOT use upstream table as evidence. */
function parseProviderConfirmed(sources: string | null, cat: Record<string, unknown>, code: SectorCode): boolean {
  if (code === 'INFORMATION_TECHNOLOGY') {
    const it1 = (cat as Record<string, unknown>)?.['IT-1_can_identify_providers'] ?? (cat?.answers as Record<string, unknown>)?.['IT-1_can_identify_providers'];
    if (it1 === 'yes' || it1 === 'Yes' || it1 === true) return true;
    const supply = cat?.supply as { sources?: Array<{ provider_name?: string }> } | undefined;
    if (supply?.sources?.length && supply.sources.some((s) => (s?.provider_name ?? '').trim())) return true;
    return false;
  }
  const supply = cat?.supply as { sources?: Array<{ provider_name?: string }> } | undefined;
  if (supply?.sources?.length && supply.sources.some((s) => (s?.provider_name ?? '').trim())) {
    return true;
  }
  return false;
}

function parseCorridor(code: SectorCode, cat: Record<string, unknown>): CorridorLevel {
  const c = cat as Record<string, unknown>;
  if (code === 'WATER') {
    const v = c.W_Q4_collocated_corridor as string | undefined;
    if (v === 'yes') return 'COLOCATED';
    if (v === 'no') return 'SEPARATED';
    return 'UNKNOWN';
  }
  if (code === 'WASTEWATER') {
    const v = c.WW_Q4_collocated_corridor as string | undefined;
    if (v === 'yes') return 'COLOCATED';
    if (v === 'no') return 'SEPARATED';
    return 'UNKNOWN';
  }
  if (code === 'ELECTRIC_POWER' || code === 'COMMUNICATIONS' || code === 'INFORMATION_TECHNOLOGY') {
    const supply = c.supply as { sources?: Array<Record<string, unknown>> } | undefined;
    const rawKey = code === 'ELECTRIC_POWER' ? 'E-4_service_connections' : code === 'INFORMATION_TECHNOLOGY' ? 'IT-4_service_connections' : 'CO-4_service_connections';
    const rawConn = (c as Record<string, unknown>)[rawKey] as Array<Record<string, unknown>> | undefined;
    const sources = supply?.sources ?? rawConn ?? [];
    const shared = (s: Record<string, unknown>) => (s?.shared_corridor_with_other_utilities ?? (s as { shared_corridor?: string }).shared_corridor) as string | undefined;
    const anyYes = sources.some((s) => shared(s) === 'yes');
    const anyNo = sources.some((s) => shared(s) === 'no');
    if (anyYes) return 'COLOCATED';
    if (anyNo && sources.length > 0) return 'SEPARATED';
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

function parsePriorityRestore(sla: string | null, cat: Record<string, unknown>): PriorityRestoreLevel {
  const agreements = cat?.agreements as { has_sla?: boolean } | undefined;
  if (agreements != null && typeof agreements === 'object') {
    return agreements.has_sla === true ? 'YES' : 'NO';
  }
  if (sla?.toLowerCase().startsWith('yes')) return 'YES';
  if (sla?.toLowerCase().startsWith('no')) return 'NO';
  return 'UNKNOWN';
}

export function buildSectorData(
  summary: SummaryRow[],
  assessment: Assessment,
  edges: CrossDependencyEdge[]
): SectorData[] {
  const byCat = new Map<string, SummaryRow>();
  for (const r of summary) {
    byCat.set(r.category, r);
  }
  const cats = assessment.categories ?? {};

  const outDegreeByFrom = new Map<string, number>();
  for (const e of edges) {
    if (e.from_category && e.from_category !== 'CRITICAL_PRODUCTS') {
      outDegreeByFrom.set(e.from_category, (outDegreeByFrom.get(e.from_category) ?? 0) + 1);
    }
  }
  const maxOut = Math.max(0, ...outDegreeByFrom.values());

  const result: SectorData[] = [];

  for (const code of SECTOR_ORDER) {
    const row = byCat.get(code);
    const cat = cats[code] as Record<string, unknown> | undefined;
    if (!row || !row.requires_service) {
      result.push({
        code,
        label: SECTOR_LABELS[code],
        tti: 72,
        loss: 0,
        lossWithAlt: null,
        altSust: null,
        rec: 0,
        redund: 'WEAK',
        slaEstablished: false,
        providerConfirmed: false,
        sectorSeverityScore: 0,
        outDegree: outDegreeByFrom.get(code) ?? 0,
        corridor: 'UNKNOWN',
        priorityRestore: 'UNKNOWN',
      });
      continue;
    }

    const tti = clamp(row.time_to_impact_hours ?? 0, 0, 72);
    const loss = roundPct(100 - (row.capacity_after_impact_no_backup ?? 100));
    const lossWithAlt =
      row.has_backup && row.capacity_after_backup_exhausted != null
        ? roundPct(100 - row.capacity_after_backup_exhausted)
        : null;
    const altSust = row.has_backup && row.backup_duration_hours != null
      ? clamp(row.backup_duration_hours, 0, 96)
      : null;
    const rec = clamp(row.recovery_time_hours ?? 0, 0, 72);
    const redund = parseRedundancy(row.sources);
    const slaEstablished = parseSlaEstablished(row.sla);
    const providerConfirmed = parseProviderConfirmed(row.sources, cat ?? {}, code);

    const timeFactor = clamp((72 - tti) / 72, 0, 1);
    const lossFactor = clamp(loss / 100, 0, 1);
    const sustainFactor = altSust != null
      ? clamp(1 - altSust / 72, 0, 1)
      : 1;
    const recoveryFactor = clamp(rec / 72, 0, 1);
    const redundancyFactor = redund === 'STRONG' ? 0.6 : redund === 'PARTIAL' ? 0.8 : 1.0;

    let rawScore =
      100 *
      (0.35 * timeFactor + 0.35 * lossFactor + 0.15 * sustainFactor + 0.15 * recoveryFactor) *
      redundancyFactor;

    const ra = cat?.redundancy_activation as { mode?: string; activation_delay_min?: number | null; requires_trained_personnel?: boolean | null; trained_personnel_24_7?: boolean | null; documented_and_tested?: boolean | null } | undefined;
    if (row.has_backup && ra) {
      const mode = ra.mode ?? 'UNKNOWN';
      let initPenalty = 0;
      if (mode === 'UNKNOWN') initPenalty += 2;
      else if (mode === 'MANUAL_ONSITE') initPenalty += 2;
      else if (mode === 'MANUAL_REMOTE') initPenalty += 1;
      else if (mode === 'VENDOR_REQUIRED') initPenalty += 3;
      const delayMin = ra.activation_delay_min;
      if (delayMin != null && typeof delayMin === 'number') {
        if (delayMin >= 480) initPenalty += 3;
        else if (delayMin >= 240) initPenalty += 2;
        else if (delayMin >= 60) initPenalty += 1;
      }
      if (ra.requires_trained_personnel === true && ra.trained_personnel_24_7 !== true) initPenalty += 2;
      if (ra.documented_and_tested === false) initPenalty += 2;
      rawScore = Math.min(100, rawScore + initPenalty);
    }

    const sectorSeverityScore = clamp(rawScore, 0, 100);

    const raMode = (ra?.mode ?? '') as string;
    const redundancyInitiationManual = row.has_backup && ['MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED'].includes(raMode);

    const upstreamDocumented =
      code === 'INFORMATION_TECHNOLOGY'
        ? (Array.isArray((cat as Record<string, unknown>)?.['IT-2_upstream_assets']) &&
            ((cat as Record<string, unknown>)['IT-2_upstream_assets'] as unknown[]).length > 0)
        : undefined;

    result.push({
      code,
      label: SECTOR_LABELS[code],
      tti,
      loss,
      lossWithAlt,
      altSust,
      rec,
      redund,
      slaEstablished,
      providerConfirmed,
      sectorSeverityScore,
      outDegree: outDegreeByFrom.get(code) ?? 0,
      corridor: parseCorridor(code, cat ?? {}),
      priorityRestore: parsePriorityRestore(row.sla, cat ?? {}),
      redundancyInitiationManual,
      upstreamDocumented,
    });
  }

  return result;
}

function computeOverallScore(sectors: SectorData[], crossDepEnabled: boolean): number {
  if (sectors.length === 0) return 0;
  const maxOut = Math.max(1, ...sectors.map((s) => s.outDegree));
  let maxScore = 0;
  for (const s of sectors) {
    let score = s.sectorSeverityScore;
    if (crossDepEnabled && maxOut > 0 && s.outDegree > 0) {
      const boost = (s.outDegree / maxOut) * 10;
      score = Math.min(100, score + boost);
    }
    if (score > maxScore) maxScore = score;
  }
  return maxScore;
}

function mapScoreToPosture(score: number): PostureLevel {
  if (score <= 24) return 'LOW';
  if (score <= 49) return 'MODERATE';
  if (score <= 74) return 'ELEVATED';
  return 'HIGH';
}

function selectStructuralPhrase(s: SectorData): StructuralPhrase {
  if (!s.providerConfirmed) return 'provider not confirmed';
  if (s.redund === 'WEAK' && s.altSust == null) return 'no alternate capability';
  if (s.redundancyInitiationManual) {
    return 'alternate requires manual or vendor initiation';
  }
  if (s.altSust != null && s.altSust < 12) return 'alternate capability is short-duration';
  if (!s.slaEstablished) return 'priority restoration not established';
  if (s.code === 'INFORMATION_TECHNOLOGY' && s.redund === 'WEAK') return 'hosted/managed services depend on a single carrier/path';
  if (s.redund === 'WEAK') return 'single provider identified';
  return 'single provider identified';
}

function selectStructuralPhraseForJustification(s: SectorData): string {
  if (!s.providerConfirmed) return 'provider not confirmed';
  if (s.redund === 'WEAK') return 'redundancy is limited';
  if (s.altSust == null) return 'no alternate capability';
  if (s.altSust < 12) return 'sustainment is short';
  return 'recovery path relies on same corridor';
}

function buildPostureLine(topSector: SectorData, posture: PostureLevel): string {
  const phrase = selectStructuralPhraseForJustification(topSector);
  const ttiDisplay = formatHours(topSector.tti === 0 ? 0 : roundHours(topSector.tti));
  return `${posture} — ${topSector.label} reaches severe impact in ${ttiDisplay} with ~${roundPct(topSector.loss)}% functional loss; ${phrase}.`;
}

function buildSummarySentences(
  sectors: SectorData[],
  posture: PostureLevel,
  crossDepEnabled: boolean,
  edges: CrossDependencyEdge[]
): string[] {
  const withData = sectors.filter((s) => s.tti < 72 || s.loss > 0);
  if (withData.length === 0) {
    return [`Overall posture is ${posture}. No sector-specific impact data available.`];
  }

  const fastest = withData.reduce((a, b) => (a.tti <= b.tti ? a : b));
  const deepest = withData.reduce((a, b) => (a.loss >= b.loss ? a : b));
  const withAlt = withData.filter((s) => s.altSust != null);
  const weakestSustain = withAlt.length > 0
    ? withAlt.reduce((a, b) => ((a.altSust ?? 999) <= (b.altSust ?? 999) ? a : b))
    : null;
  const recoveryBottleneck = withData.reduce((a, b) => (a.rec >= b.rec ? a : b));

  const sentences: string[] = [];

  sentences.push(
    `Overall posture is ${posture}. ${fastest.label} fails fastest (severe impact at ${fastest.tti === 0 ? '0' : roundHours(fastest.tti)} hours).`
  );

  const altReduces = deepest.lossWithAlt != null && deepest.lossWithAlt < deepest.loss - 2;
  sentences.push(
    `${deepest.label} shows the deepest functional loss (~${roundPct(deepest.loss)}% without alternate)${altReduces ? '; alternates materially reduce loss.' : '.'}`
  );

  if (weakestSustain) {
    sentences.push(
      `Sustainment is shortest in ${weakestSustain.label} (${formatHours(roundHours(weakestSustain.altSust!))}); recovery bottleneck is ${recoveryBottleneck.label} (${formatHours(roundHours(recoveryBottleneck.rec))}).`
    );
  } else {
    sentences.push(
      `No alternate capability across assessed sectors; recovery bottleneck is ${recoveryBottleneck.label} (${formatHours(roundHours(recoveryBottleneck.rec))}).`
    );
  }

  if (crossDepEnabled && edges.length > 0) {
    const fromCounts = new Map<string, number>();
    for (const e of edges) {
      if (e.from_category && e.from_category !== 'CRITICAL_PRODUCTS') {
        fromCounts.set(e.from_category, (fromCounts.get(e.from_category) ?? 0) + 1);
      }
    }
    const topSource = [...fromCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topSource) {
      const label = SECTOR_LABELS[topSource[0] as SectorCode] ?? topSource[0];
      sentences.push(`Cross-dependency model indicates cascade risk from ${label} to downstream sectors.`);
    }
  }

  return sentences.slice(0, 4);
}

/**
 * Hotel Fact Sheet brief: 2–5 sentences, 1 paragraph, no bullets/tables.
 * Deterministic: posture, fastest failure, deepest loss, sustainment (if alternates), cascade (if cross-dep).
 */
function buildExecutiveSummaryBrief(
  sectors: SectorData[],
  posture: PostureLevel,
  crossDepEnabled: boolean,
  edges: CrossDependencyEdge[]
): string {
  const withData = sectors.filter((s) => s.tti < 72 || s.loss > 0);
  if (withData.length === 0) {
    return `Overall posture is ${posture}. No sector-specific impact data available.`;
  }

  const fastest = withData.reduce((a, b) => (a.tti <= b.tti ? a : b));
  const deepest = withData.reduce((a, b) => (a.loss >= b.loss ? a : b));
  const topDriver = sectors.reduce((a, b) => (b.sectorSeverityScore >= a.sectorSeverityScore ? b : a));
  const driverPhrase = selectStructuralPhrase(topDriver);

  const sentences: string[] = [];

  // 1) Overall posture + one driver clause
  sentences.push(
    `Overall posture is ${posture}; ${topDriver.label} drives risk with ${driverPhrase}.`
  );

  // 2) Fastest failure (sector + hours)
  const ttiStr = formatHours(fastest.tti === 0 ? 0 : roundHours(fastest.tti));
  sentences.push(
    `${fastest.label} reaches severe impact in ${ttiStr}.`
  );

  // 3) Deepest loss (sector + percent)
  sentences.push(
    `${deepest.label} shows the deepest functional loss (~${roundPct(deepest.loss)}% without alternate).`
  );

  // 4) Sustainment (only if alternates exist)
  const withAlt = withData.filter((s) => s.altSust != null);
  if (withAlt.length > 0) {
    const shortest = withAlt.reduce((a, b) => ((a.altSust ?? 999) <= (b.altSust ?? 999) ? a : b));
    sentences.push(
      `Alternate capability sustains operations for up to ${roundHours(shortest.altSust!)} hours in the shortest sector.`
    );
  }

  // 5) Cascade (ONLY if cross-dependency ON + edges)
  if (crossDepEnabled && edges.length > 0) {
    const fromCounts = new Map<string, number>();
    for (const e of edges) {
      if (e.from_category && e.from_category !== 'CRITICAL_PRODUCTS') {
        fromCounts.set(e.from_category, (fromCounts.get(e.from_category) ?? 0) + 1);
      }
    }
    const topSource = [...fromCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topSource) {
      const label = SECTOR_LABELS[topSource[0] as SectorCode] ?? topSource[0];
      sentences.push(`Cascade risk from ${label} to downstream sectors is indicated.`);
    }
  }

  return sentences.slice(0, 5).join(' ');
}

function buildDrivers(sectors: SectorData[], crossDepEnabled: boolean): string[] {
  const withData = sectors.filter((s) => s.sectorSeverityScore > 0);
  const sorted = [...withData].sort((a, b) => {
    if (b.sectorSeverityScore !== a.sectorSeverityScore) return b.sectorSeverityScore - a.sectorSeverityScore;
    if (a.tti !== b.tti) return a.tti - b.tti;
    if (b.loss !== a.loss) return b.loss - a.loss;
    const redundOrder = { WEAK: 3, PARTIAL: 2, STRONG: 1 };
    if (redundOrder[a.redund] !== redundOrder[b.redund]) return redundOrder[a.redund] - redundOrder[b.redund];
    if (crossDepEnabled && b.outDegree !== a.outDegree) return b.outDegree - a.outDegree;
    return a.code.localeCompare(b.code);
  });

  const top3 = sorted.slice(0, 3);
  return top3.map((s) => {
    const ttiDisplay = s.tti === 0 ? '0' : roundHours(s.tti);
    const phrase = selectStructuralPhrase(s);
    return `${s.label}: Severe impact at ${ttiDisplay} hrs; ~${roundPct(s.loss)}% loss; ${phrase}.`;
  });
}

function mapSustainment(altSust: number | null): SustainmentLevel {
  if (altSust == null) return 'NONE';
  if (altSust < 12) return 'SHORT';
  if (altSust <= 48) return 'MODERATE';
  return 'LONG';
}

function buildMatrixRows(sectors: SectorData[]) {
  return sectors.map((s) => {
    const notes =
      s.code === 'INFORMATION_TECHNOLOGY' && s.upstreamDocumented
        ? 'Upstream/hosted providers are documented separately.'
        : undefined;
    return {
      sector: s.label,
      ttiHrs: s.tti === 0 ? '0' : String(roundHours(s.tti)),
      lossPct: String(roundPct(s.loss)),
      backupHrs: s.altSust == null ? '—' : String(roundHours(s.altSust)),
      structuralPosture: `${s.redund} / ${s.providerConfirmed ? 'CONFIRMED' : 'UNCONFIRMED'} / ${mapSustainment(s.altSust)}`,
      ...(notes ? { notes } : {}),
    };
  });
}

function buildCascadeParagraph(
  sectors: SectorData[],
  edges: CrossDependencyEdge[]
): string | null {
  if (edges.length === 0) return null;

  const fromScores = new Map<string, { sector: SectorData; outDegree: number }>();
  for (const s of sectors) {
    const out = edges.filter((e) => e.from_category === s.code).length;
    if (out > 0) {
      fromScores.set(s.code, { sector: s, outDegree: out });
    }
  }
  const ranked = [...fromScores.entries()].sort((a, b) => {
    const scoreA = a[1].sector.sectorSeverityScore + a[1].outDegree * 5;
    const scoreB = b[1].sector.sectorSeverityScore + b[1].outDegree * 5;
    return scoreB - scoreA;
  });
  if (ranked.length === 0) return null;

  const [topFromCode, topFrom] = ranked[0];
  const sourceSector = topFrom.sector;
  const downstream = edges
    .filter((e) => e.from_category === topFromCode)
    .map((e) => SECTOR_LABELS[e.to_category as SectorCode] ?? e.to_category);
  const sink1 = downstream[0];
  const sink2 = downstream[1];
  const sinkPart = sink2 ? `${sink1}, ${sink2}` : sink1;

  const ttiDisplay = formatHours(sourceSector.tti === 0 ? 0 : roundHours(sourceSector.tti));
  return `If ${sourceSector.label} is disrupted beyond ${ttiDisplay}, the model indicates elevated downstream risk to ${sinkPart} due to dependency links. This cascade accelerates operational degradation when sustainment is short or redundancy is limited.`;
}

/**
 * Build executive snapshot content for DOCX injection.
 * Deterministic, curve-driven, non-generic.
 */
export function buildExecutiveSnapshotContent(
  summary: SummaryRow[],
  assessment: Assessment,
  crossDependencyEnabled: boolean
): ExecutiveSnapshotContent {
  const node = getCrossDependenciesNode(assessment);
  const edges = node.edges ?? [];

  const sectors = buildSectorData(summary, assessment, edges);
  const crossDepEnabled = crossDependencyEnabled && edges.length > 0;

  const overallScore = computeOverallScore(sectors, crossDepEnabled);
  const posture = mapScoreToPosture(overallScore);

  const topSector = sectors.reduce((a, b) =>
    b.sectorSeverityScore >= a.sectorSeverityScore ? b : a
  );
  const postureLine = buildPostureLine(topSector, posture);
  const summarySentences = buildSummarySentences(sectors, posture, crossDepEnabled, edges);
  const executive_summary_brief = buildExecutiveSummaryBrief(sectors, posture, crossDepEnabled, edges);
  const drivers = buildDrivers(sectors, crossDepEnabled);
  const matrixRows = buildMatrixRows(sectors);
  const cascade = crossDepEnabled ? buildCascadeParagraph(sectors, edges) : null;

  return {
    posture: postureLine,
    summary: summarySentences.join(' '),
    executive_summary_brief,
    drivers,
    matrixRows,
    cascade,
  };
}
