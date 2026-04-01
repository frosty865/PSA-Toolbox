/**
 * Cross-Infrastructure Synthesis Content Engine
 *
 * Deterministic narrative for [[SYNTHESIS]] anchor:
 * - Overall Interdependency Posture (Paragraph 1)
 * - Redundancy Reality Check (Paragraph 2)
 * - Cascade Pathway (Paragraph 3, only when cross-dependency ON with edges)
 * - Key Implications bullets (2 when OFF, 3 when ON)
 *
 * DESIGN: Dependency-focused, no cyber governance, no boilerplate.
 * Deterministic: same inputs → identical output.
 */

import type { SummaryRow } from 'engine';
import type { Assessment, CrossDependencyEdge } from 'schema';
import { getCrossDependenciesNode } from '@/app/lib/cross-dependencies/normalize';
import { buildSectorData, type SectorData } from './executive_snapshot_engine';
import { formatHours } from './format_hours';

type SectorCode = 'ELECTRIC_POWER' | 'COMMUNICATIONS' | 'INFORMATION_TECHNOLOGY' | 'WATER' | 'WASTEWATER';

const SECTOR_ORDER: SectorCode[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

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

function mapSustainmentLabel(altSust: number | null): 'SHORT' | 'MODERATE' | 'LONG' {
  if (altSust == null) return 'SHORT'; // no alternate = treat as short for wording
  if (altSust < 12) return 'SHORT';
  if (altSust <= 48) return 'MODERATE';
  return 'LONG';
}

/** IllusionOfRedundancy: alternate present but short sustain or doesn't materially reduce loss. */
function isIllusionOfRedundancy(s: SectorData): boolean {
  if (!s.altSust) return false;
  if (s.altSust < 12) return true;
  if (s.lossWithAlt != null && s.lossWithAlt >= s.loss - 10) return true;
  return false;
}

/** SinglePointExposure: weak redundancy, co-located corridor, or unconfirmed provider. */
function isSinglePointExposure(s: SectorData): boolean {
  if (s.redund === 'WEAK') return true;
  if (s.corridor === 'COLOCATED') return true;
  if (!s.providerConfirmed) return true;
  return false;
}

/** Deterministic tie-break: SECTOR_ORDER index (Power first). */
function sectorOrderIndex(code: string): number {
  const i = SECTOR_ORDER.indexOf(code as SectorCode);
  return i >= 0 ? i : 999;
}

/** Paragraph 1: Overall Interdependency Posture. Declarative only: input-traceable. */
function buildParagraph1(sectors: SectorData[]): string {
  const withData = sectors.filter((s) => s.tti < 72 || s.loss > 0);
  if (withData.length === 0) {
    return 'Not provided.';
  }

  const topDriver = withData.reduce((a, b) =>
    b.sectorSeverityScore >= a.sectorSeverityScore ? b : a
  );
  const fastest = withData.reduce((a, b) =>
    a.tti <= b.tti ? a : (a.tti === b.tti ? (sectorOrderIndex(a.code) <= sectorOrderIndex(b.code) ? a : b) : b)
  );
  const deepest = withData.reduce((a, b) =>
    a.loss >= b.loss ? a : (a.loss === b.loss ? (sectorOrderIndex(a.code) <= sectorOrderIndex(b.code) ? a : b) : b)
  );

  const ttiD = topDriver.tti === 0 ? 0 : roundHours(topDriver.tti);
  const ttiF = fastest.tti === 0 ? 0 : roundHours(fastest.tti);
  const lossD = roundPct(topDriver.loss);
  const lossL = roundPct(deepest.loss);

  const s1 = `${topDriver.label} reaches severe impact in ${formatHours(ttiD)} with ~${lossD}% functional loss.`;
  const s2 = `Fastest time to severe impact is in ${fastest.label} (${formatHours(ttiF)}); deepest loss is in ${deepest.label} (~${lossL}%).`;

  const anyAlt = [topDriver, fastest, deepest].some((s) => s.altSust != null);
  let s3 = '';
  if (anyAlt) {
    const withAlt = withData.filter((s) => s.altSust != null);
    const sustainLabel = withAlt.length > 0
      ? mapSustainmentLabel(withAlt.reduce((a, b) => ((a.altSust ?? 999) <= (b.altSust ?? 999) ? a : b)).altSust ?? null)
      : 'SHORT';
    s3 = ` Alternate sustainment: ${sustainLabel}.`;
  }

  return s1 + ' ' + s2 + s3;
}

/** Paragraph 2: Redundancy Reality Check. Declarative only. */
function buildParagraph2(sectors: SectorData[]): string {
  const withData = sectors.filter((s) => s.tti < 72 || s.loss > 0);
  if (withData.length === 0) {
    return 'Not provided.';
  }

  const flagged = withData.filter((s) => isIllusionOfRedundancy(s) || isSinglePointExposure(s));

  if (flagged.length === 0) {
    return 'Alternate capability or diversity is present where values are provided.';
  }

  const pick = flagged.length >= 2 ? flagged.slice(0, 2) : [flagged[0]];
  const s1Part = pick.length === 2
    ? `${pick[0].label} and ${pick[1].label}`
    : pick[0].label;
  const s1 = `Alternate capability in ${s1Part} is short-duration or loss with backup is not provided.`;
  const s2 = 'A single service path, co-located corridor, or provider identity without independence is present in one or more sectors.';

  return s1 + ' ' + s2;
}

/** Paragraph 3: Cascade Pathway (only when cross-dependency ON with edges) */
function buildParagraph3(sectors: SectorData[], edges: CrossDependencyEdge[]): string | null {
  if (edges.length === 0) return null;

  const outDegrees = new Map<string, number>();
  for (const e of edges) {
    if (e.from_category && e.from_category !== 'CRITICAL_PRODUCTS') {
      outDegrees.set(e.from_category, (outDegrees.get(e.from_category) ?? 0) + 1);
    }
  }
  const maxOut = Math.max(1, ...outDegrees.values());

  const fromSectors = sectors.filter((s) => (outDegrees.get(s.code) ?? 0) > 0);
  if (fromSectors.length === 0) return null;

  const ranked = [...fromSectors].sort((a, b) => {
    const outA = outDegrees.get(a.code) ?? 0;
    const outB = outDegrees.get(b.code) ?? 0;
    const pctA = maxOut > 0 ? outA / maxOut : 0;
    const pctB = maxOut > 0 ? outB / maxOut : 0;
    const scoreA = pctA * 100 + a.sectorSeverityScore;
    const scoreB = pctB * 100 + b.sectorSeverityScore;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.tti - b.tti;
  });

  const src = ranked[0];
  const downstream = edges
    .filter((e) => e.from_category === src.code)
    .map((e) => e.to_category);
  const tgts = downstream
    .map((c) => sectors.find((s) => s.code === c))
    .filter((s): s is SectorData => s != null)
    .sort((a, b) => {
      if (b.sectorSeverityScore !== a.sectorSeverityScore) return b.sectorSeverityScore - a.sectorSeverityScore;
      if (a.tti !== b.tti) return a.tti - b.tti;
      return b.loss - a.loss;
    });
  const tgt = tgts[0];
  const tgt2 = tgts[1];
  if (!tgt) return null;

  const ttiDisplayNum = src.tti === 0 ? 0 : roundHours(src.tti);
  const tgtPart = tgt2 ? `${tgt.label}, ${tgt2.label}` : tgt.label;
  const chain = tgt2 ? `${src.label} → ${tgt.label} → ${tgt2.label}` : `${src.label} → ${tgt.label}`;

  const s1 = `Cross-dependencies show ${src.label} is upstream of ${tgtPart} (pathway: ${chain}).`;
  const s2 = `Time to severe impact for ${src.label} is ${formatHours(ttiDisplayNum)}; downstream impact for ${tgtPart} is not quantified.`;

  return s1 + ' ' + s2;
}

/** Key Implications bullets */
function buildBullets(
  sectors: SectorData[],
  edgesExist: boolean
): Array<{ label: string; text: string }> {
  const withData = sectors.filter((s) => s.tti < 72 || s.loss > 0);
  if (withData.length === 0) {
    return [{ label: 'No sector data', text: 'Not provided.' }];
  }

  const fastest = withData.reduce((a, b) =>
    a.tti <= b.tti ? a : (a.tti === b.tti ? (sectorOrderIndex(a.code) <= sectorOrderIndex(b.code) ? a : b) : b)
  );
  const deepest = withData.reduce((a, b) =>
    a.loss >= b.loss ? a : (a.loss === b.loss ? (sectorOrderIndex(a.code) <= sectorOrderIndex(b.code) ? a : b) : b)
  );

  const bullets: Array<{ label: string; text: string }> = [];

  const ttiFNum = fastest.tti === 0 ? 0 : roundHours(fastest.tti);
  bullets.push({
    label: 'Time to severe impact',
    text: `Time to severe impact for ${fastest.label} is ${formatHours(ttiFNum)}.`,
  });

  const lossL = roundPct(deepest.loss);
  bullets.push({
    label: 'Functional loss',
    text: `Deepest functional loss is in ${deepest.label} (~${lossL}%).`,
  });

  if (edgesExist) {
    const illusionCandidates = withData.filter(isIllusionOfRedundancy);
    const colocatedCandidates = withData.filter((s) => s.corridor === 'COLOCATED');
    const noPriorityCandidates = withData.filter((s) => s.priorityRestore !== 'YES');

    if (illusionCandidates.length > 0) {
      const top = illusionCandidates.sort((a, b) => b.sectorSeverityScore - a.sectorSeverityScore)[0];
      const sust = top.altSust != null ? roundHours(top.altSust) : '0';
      bullets.push({
        label: 'Alternate sustainment',
        text: `Alternate capability in ${top.label}: ${sust} hrs; loss with backup is not provided.`,
      });
    } else if (colocatedCandidates.length > 0) {
      bullets.push({
        label: 'Shared corridor',
        text: 'Co-located utility corridors are present.',
      });
    } else if (noPriorityCandidates.length > 0) {
      const top = [...noPriorityCandidates].sort((a, b) => b.sectorSeverityScore - a.sectorSeverityScore)[0];
      bullets.push({
        label: 'Restoration',
        text: `Priority restoration is not provided for ${top.label}.`,
      });
    }
  } else {
    const illusionCandidates = withData.filter(isIllusionOfRedundancy);
    const colocatedCandidates = withData.filter((s) => s.corridor === 'COLOCATED');
    const noPriorityCandidates = withData.filter((s) => s.priorityRestore !== 'YES');

    if (illusionCandidates.length > 0) {
      const top = illusionCandidates.sort((a, b) => b.sectorSeverityScore - a.sectorSeverityScore)[0];
      const sust = top.altSust != null ? roundHours(top.altSust) : '0';
      bullets.push({
        label: 'Alternate sustainment',
        text: `Alternate capability in ${top.label}: ${sust} hrs; loss with backup is not provided.`,
      });
    } else if (colocatedCandidates.length > 0) {
      bullets.push({
        label: 'Shared corridor',
        text: 'Co-located utility corridors are present.',
      });
    } else if (noPriorityCandidates.length > 0) {
      const top = [...noPriorityCandidates].sort((a, b) => b.sectorSeverityScore - a.sectorSeverityScore)[0];
      bullets.push({
        label: 'Restoration',
        text: `Priority restoration is not provided for ${top.label}.`,
      });
    }
  }

  const count = edgesExist ? 3 : 2;
  return bullets.slice(0, count);
}

export type SynthesisContent = {
  title: string;
  paragraphs: string[];
  bullets: Array<{ label: string; text: string }>;
};

const SECTOR_LABELS: Record<SectorCode, string> = {
  ELECTRIC_POWER: 'Electric Power',
  COMMUNICATIONS: 'Communications',
  INFORMATION_TECHNOLOGY: 'Information Technology',
  WATER: 'Water',
  WASTEWATER: 'Wastewater',
};

/** Plain-language mapping: no raw keys in output. Missing/UNKNOWN -> "Not provided." */
function toSentence(value: unknown): string {
  if (value === undefined || value === null) return 'Not provided.';
  const s = String(value).trim();
  if (s === '' || s.toLowerCase() === 'unknown') return 'Not provided.';
  return s;
}

function mapElectricPowerBullet(ep: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const e3 = ep['E-3_more_than_one_connection'];
  if (e3 !== undefined && e3 !== null) {
    const sent = e3 === true || e3 === 'yes' || e3 === 'Yes' ? 'Multiple service connections present.' : e3 === false || e3 === 'no' || e3 === 'No' ? 'Single service connection present.' : 'Not provided.';
    parts.push(sent);
  }
  return parts;
}

function mapCommunicationsBullet(comm: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const tti = comm.time_to_impact_hours ?? comm.curve_time_to_impact_hours;
  if (tti !== undefined && tti !== null && typeof tti === 'number') parts.push(`Time to severe impact: ${tti} hours.`);
  const coord = comm.comm_restoration_coordination ?? comm['CO-11_restoration_coordination'];
  if (coord !== undefined && coord !== null) {
    const c = toSentence(coord);
    if (c !== 'Not provided.') parts.push(`Restoration coordination: ${c}.`);
  }
  return parts;
}

function mapInformationTechnologyBullet(it: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const tti = it.time_to_impact_hours ?? it.curve_time_to_impact_hours;
  if (tti !== undefined && tti !== null && typeof tti === 'number') parts.push(`Time to severe impact: ${tti} hours.`);
  const supply = it.supply as { sources?: Array<{ provider_name?: string | null }> } | undefined;
  const sources = supply?.sources ?? [];
  const primaryName = (sources[0]?.provider_name ?? it.curve_primary_provider ?? '').toString().trim();
  const secondaryName = (sources[1]?.provider_name ?? it.curve_secondary_provider ?? '').toString().trim();
  const praSla = it.pra_sla as {
    providers?: Array<{ name: string; restoration_coordination?: string; priority_restoration?: string }>;
    restoration_coordination?: string;
  } | undefined;
  const providers = praSla?.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    const connParts: string[] = [];
    if (primaryName) connParts.push(`primary internet connectivity from ${primaryName}`);
    if (secondaryName) connParts.push(`secondary connectivity from ${secondaryName}`);
    if (connParts.length) parts.push(`The facility receives ${connParts.join(' and ')}.`);
    const coordParts = providers.map((p) => {
      const v = (p.restoration_coordination ?? '').toString().toLowerCase();
      if (v === 'yes') return `coordination with ${p.name} established`;
      if (v === 'no') return `coordination with ${p.name} not confirmed`;
      return `coordination with ${p.name} not provided`;
    });
    if (coordParts.length) parts.push(`Coordination for restoration during outages: ${coordParts.join('; ')}.`);
  } else if (primaryName && (praSla?.restoration_coordination ?? it['IT-11_restoration_coordination']) != null) {
    const c = toSentence(praSla?.restoration_coordination ?? it['IT-11_restoration_coordination']);
    if (c !== 'Not provided.') parts.push(`Restoration coordination (${primaryName}): ${c}.`);
  }
  const transport = it.it_transport_resilience as { building_entry_diversity?: string } | undefined;
  if (transport?.building_entry_diversity != null) {
    const v = transport.building_entry_diversity;
    const sent = v === 'SEPARATE_ENTRY' || v === 'SEPARATE_ENTRIES' ? 'Building entry diversity: separate entries present.' : v === 'SAME_ENTRY' ? 'Building entry diversity: same entry present.' : 'Not provided.';
    parts.push(sent);
  }
  const ra = it.redundancy_activation as { mode?: string } | undefined;
  if (ra?.mode != null && ra.mode !== 'UNKNOWN') {
    const modeLabel = ra.mode === 'MANUAL_ONSITE' ? 'Manual (on-site)' : ra.mode === 'MANUAL_REMOTE' ? 'Manual (remote)' : ra.mode === 'VENDOR_REQUIRED' ? 'Vendor required' : ra.mode === 'AUTOMATIC' ? 'Automatic' : ra.mode;
    parts.push(`Redundancy activation: ${modeLabel}.`);
  }
  return parts;
}

function mapWaterBullet(water: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const w2 = water.W_Q2_connection_count ?? water.w_q2_connection_count;
  if (w2 !== undefined && w2 !== null) parts.push(`Service connection count: ${w2}.`);
  const w8 = water.W_Q8_alternate_source ?? water.w_q8_alternate_source;
  if (w8 !== undefined && w8 !== null) {
    const sent = toSentence(w8);
    if (sent !== 'Not provided.') parts.push(`Alternate water source: ${sent}.`);
  }
  return parts;
}

function mapWastewaterBullet(ww: Record<string, unknown>): string[] {
  const parts: string[] = [];
  const ww2 = ww.WW_Q2_connection_count ?? ww.ww_q2_connection_count;
  if (ww2 !== undefined && ww2 !== null) parts.push(`Service connection count: ${ww2}.`);
  const ww8 = ww.WW_Q8_onsite_pumping ?? ww.ww_q8_onsite_pumping;
  if (ww8 !== undefined && ww8 !== null) {
    const sent = toSentence(ww8);
    if (sent !== 'Not provided.') parts.push(`Onsite pumping: ${sent}.`);
  }
  return parts;
}

/**
 * Sector-specific field bullets: plain-language only. No raw internal keys in output.
 */
export function buildSectorFieldBullets(assessment: Assessment): Array<{ label: string; text: string }> {
  const cats = assessment.categories ?? {};
  const bullets: Array<{ label: string; text: string }> = [];

  const ep = cats.ELECTRIC_POWER as Record<string, unknown> | undefined;
  if (ep != null) {
    const parts = mapElectricPowerBullet(ep);
    if (parts.length) bullets.push({ label: 'Electric Power', text: parts.join(' ') });
  }

  const comm = cats.COMMUNICATIONS as Record<string, unknown> | undefined;
  if (comm != null) {
    const parts = mapCommunicationsBullet(comm);
    if (parts.length) bullets.push({ label: 'Communications', text: parts.join(' ') });
  }

  const it = cats.INFORMATION_TECHNOLOGY as Record<string, unknown> | undefined;
  if (it != null) {
    const parts = mapInformationTechnologyBullet(it);
    if (parts.length) bullets.push({ label: 'Information Technology', text: parts.join(' ') });
  }

  const water = cats.WATER as Record<string, unknown> | undefined;
  if (water != null) {
    const parts = mapWaterBullet(water);
    if (parts.length) bullets.push({ label: 'Water', text: parts.join(' ') });
  }

  const ww = cats.WASTEWATER as Record<string, unknown> | undefined;
  if (ww != null) {
    const parts = mapWastewaterBullet(ww);
    if (parts.length) bullets.push({ label: 'Wastewater', text: parts.join(' ') });
  }

  return bullets;
}

/**
 * Build Cross-Infrastructure Synthesis content for [[SYNTHESIS]] anchor.
 * When field-only mode: no summarizing paragraphs; sector field bullets only.
 */
export function buildCrossInfrastructureSynthesis(
  summary: SummaryRow[],
  assessment: Assessment,
  crossDependencyEnabled: boolean,
  options?: { fieldBulletsOnly?: boolean }
): SynthesisContent {
  const fieldOnly = options?.fieldBulletsOnly === true;
  const sectorFieldBullets = buildSectorFieldBullets(assessment);

  if (fieldOnly && sectorFieldBullets.length > 0) {
    return {
      title: 'Cross-Infrastructure Synthesis',
      paragraphs: [],
      bullets: sectorFieldBullets,
    };
  }

  const node = getCrossDependenciesNode(assessment);
  const edges = node.edges ?? [];
  const crossDepEnabled = crossDependencyEnabled && edges.length > 0;

  const sectors = buildSectorData(summary, assessment, edges);

  const p1 = buildParagraph1(sectors);
  const p2 = buildParagraph2(sectors);
  const p3 = crossDepEnabled ? buildParagraph3(sectors, edges) : null;

  const paragraphs: string[] = [p1, p2];
  if (p3) paragraphs.push(p3);

  const bullets = [...sectorFieldBullets, ...buildBullets(sectors, crossDepEnabled)];

  return {
    title: 'Cross-Infrastructure Synthesis',
    paragraphs,
    bullets,
  };
}
