/**
 * Priority Actions Content Engine
 *
 * Deterministic grouped action list for [[PRIORITY_ACTIONS]] anchor.
 * One action per driver category; affected sectors referenced inside the paragraph.
 *
 * DESIGN:
 * - Group by driver type: Structural Redundancy, Restoration Priority, Backup Activation Delay, Lack of Alternate Capability (+ Cascade, Recovery)
 * - One action per category; sectors named in paragraph (no "— SectorName" in titles)
 * - Cap 4–6 actions; ranked by time-to-impact severity and percentage functional loss
 * - Bold action title + concise operational paragraph
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

const SECTOR_ORDER_INDEX: Record<SectorCode, number> = {
  ELECTRIC_POWER: 0,
  COMMUNICATIONS: 1,
  INFORMATION_TECHNOLOGY: 2,
  WATER: 3,
  WASTEWATER: 4,
};

export type ActionKind =
  | 'REDUNDANCY_HARDENING'
  | 'SUSTAINMENT_EXTENSION'
  | 'ALTERNATE_CAPABILITY_CREATION'
  | 'PRIORITY_RESTORATION'
  | 'CASCADE_MITIGATION'
  | 'RECOVERY_ACCELERATION';

/** Display title per driver category (no sector suffix). */
const DRIVER_TITLES: Record<ActionKind, string> = {
  REDUNDANCY_HARDENING: 'Structural Redundancy',
  SUSTAINMENT_EXTENSION: 'Backup Activation Delay',
  ALTERNATE_CAPABILITY_CREATION: 'Lack of Alternate Capability',
  PRIORITY_RESTORATION: 'Restoration Priority',
  CASCADE_MITIGATION: 'Cascade Exposure',
  RECOVERY_ACCELERATION: 'Recovery Time',
};

/** Rank order for sorting categories: lower index = higher priority. */
const KIND_RANK: ActionKind[] = [
  'ALTERNATE_CAPABILITY_CREATION',
  'CASCADE_MITIGATION',
  'SUSTAINMENT_EXTENSION',
  'REDUNDANCY_HARDENING',
  'PRIORITY_RESTORATION',
  'RECOVERY_ACCELERATION',
];

export type PriorityAction = {
  id: string;
  sector: SectorCode;
  kind: ActionKind;
  title: string;
  text: string;
  score: number;
};

/** ReportVM: minimal view model for priority actions (summary + assessment + cross-dependency flag). */
export type ReportVM = {
  summary: SummaryRow[];
  assessment: Assessment;
  crossDependencyEnabled: boolean;
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

/** TTI display: never "~0"; use "0". Fractional round to 0.25. */
function formatTti(tti: number): string {
  const clamped = clamp(tti, 0, 72);
  if (clamped === 0) return '0';
  return String(roundHours(clamped));
}

function getCascadeSrc(edges: CrossDependencyEdge[]): SectorCode | null {
  const outDegrees = new Map<string, number>();
  for (const e of edges) {
    if (e.from_category && e.from_category !== 'CRITICAL_PRODUCTS') {
      outDegrees.set(e.from_category, (outDegrees.get(e.from_category) ?? 0) + 1);
    }
  }
  const maxOut = Math.max(0, ...outDegrees.values());
  if (maxOut === 0) return null;
  const top = [...outDegrees.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? (top[0] as SectorCode) : null;
}

/** IllusionOfRedundancy: ALT_PRESENT && (ALT_SUST < 12 OR (ALT_LOSS != null && ALT_LOSS >= LOSS - 10)) */
function isIllusionOfRedundancy(s: SectorData): boolean {
  if (!s.altSust) return false;
  if (s.altSust < 12) return true;
  if (s.lossWithAlt != null && s.lossWithAlt >= s.loss - 10) return true;
  return false;
}

function getOutDegreePercentile(s: SectorData, sectors: SectorData[]): number {
  const maxOut = Math.max(1, ...sectors.map((x) => x.outDegree));
  return s.outDegree / maxOut;
}

function timeFactor(tti: number): number {
  return clamp((72 - tti) / 72, 0, 1);
}

/** Build justification clause. */
function buildJustification(tti: number, loss: number): string {
  const ttiDisplay = formatHours(clamp(tti, 0, 72));
  const lossClamped = roundPct(clamp(loss, 0, 100));
  return `This dependency reaches severe impact in ${ttiDisplay} with ~${lossClamped}% functional loss.`;
}

/**
 * Group sectors by driver category. Each sector can appear in multiple categories.
 */
function groupSectorsByDriverKind(
  sectors: SectorData[],
  edges: CrossDependencyEdge[],
  crossDepEnabled: boolean
): Map<ActionKind, SectorData[]> {
  const cascadeSrc = crossDepEnabled ? getCascadeSrc(edges) : null;
  const groups = new Map<ActionKind, SectorData[]>();

  for (const s of sectors) {
    const hasData = (s.tti != null && s.tti < 72) || s.loss > 0 || s.altSust != null;
    if (!hasData && s.sectorSeverityScore === 0) continue;

    const outDegreePct = getOutDegreePercentile(s, sectors);
    const cascadeCondition = crossDepEnabled && (cascadeSrc === s.code || outDegreePct >= 0.75);

    if (s.altSust == null) {
      pushToGroup(groups, 'ALTERNATE_CAPABILITY_CREATION', s);
    }
    if (s.altSust != null && s.altSust < 24) {
      pushToGroup(groups, 'SUSTAINMENT_EXTENSION', s);
    }
    if (s.redund !== 'STRONG' || s.corridor === 'COLOCATED') {
      pushToGroup(groups, 'REDUNDANCY_HARDENING', s);
    }
    if (s.priorityRestore !== 'YES') {
      pushToGroup(groups, 'PRIORITY_RESTORATION', s);
    }
    if (cascadeCondition) {
      pushToGroup(groups, 'CASCADE_MITIGATION', s);
    }
    if (s.rec > 24) {
      pushToGroup(groups, 'RECOVERY_ACCELERATION', s);
    }
  }

  return groups;
}

function pushToGroup(map: Map<ActionKind, SectorData[]>, kind: ActionKind, sector: SectorData): void {
  const list = map.get(kind) ?? [];
  list.push(sector);
  map.set(kind, list);
}

/** Worst TTI in group (lower = more severe); then worst loss (higher = more severe). */
function groupSeverityScore(sectors: SectorData[]): { tti: number; loss: number } {
  let tti = 72;
  let loss = 0;
  for (const s of sectors) {
    const t = clamp(s.tti ?? 72, 0, 72);
    if (t < tti) tti = t;
    const l = roundPct(s.loss);
    if (l > loss) loss = l;
  }
  return { tti, loss };
}

/** Sort grouped actions by time-to-impact severity (lower first) then % functional loss (higher first). */
function sortGroupedBySeverity(
  entries: Array<{ kind: ActionKind; sectors: SectorData[] }>
): typeof entries {
  return [...entries].sort((a, b) => {
    const sa = groupSeverityScore(a.sectors);
    const sb = groupSeverityScore(b.sectors);
    if (sa.tti !== sb.tti) return sa.tti - sb.tti;
    if (sb.loss !== sa.loss) return sb.loss - sa.loss;
    return KIND_RANK.indexOf(a.kind) - KIND_RANK.indexOf(b.kind);
  });
}

/** Format sector labels for "Affected sectors: A, B, C." */
function formatAffectedSectors(sectors: SectorData[]): string {
  const labels = [...sectors]
    .sort((a, b) => SECTOR_ORDER_INDEX[a.code] - SECTOR_ORDER_INDEX[b.code])
    .map((s) => s.label);
  if (labels.length === 0) return '';
  if (labels.length === 1) return `Affected sector: ${labels[0]}.`;
  return `Affected sectors: ${labels.join(', ')}.`;
}

/**
 * Build one consolidated action for a driver category: title (no sector suffix) + paragraph with sectors and guidance.
 */
function buildGroupedAction(
  kind: ActionKind,
  sectors: SectorData[]
): { title: string; text: string; score: number; leadSector: SectorData } {
  const { tti, loss } = groupSeverityScore(sectors);
  const justification = buildJustification(tti, loss);
  const affected = formatAffectedSectors(sectors);
  const leadSector = sectors.slice().sort((a, b) => {
    const ta = clamp(a.tti ?? 72, 0, 72);
    const tb = clamp(b.tti ?? 72, 0, 72);
    if (ta !== tb) return ta - tb;
    return roundPct(b.loss) - roundPct(a.loss);
  })[0];

  const score =
    0.5 * (leadSector.sectorSeverityScore / 100) +
    0.2 * timeFactor(tti) +
    0.2 * (leadSector.loss / 100);

  let operational = '';
  switch (kind) {
    case 'ALTERNATE_CAPABILITY_CREATION':
      operational = 'Develop alternate capability where missing to prevent immediate or near-term operational degradation.';
      break;
    case 'SUSTAINMENT_EXTENSION': {
      const hours = sectors.map((s) => s.altSust ?? 24).filter((h) => h > 0);
      const minSust = hours.length > 0 ? Math.min(...hours) : 24;
      const sustDisplay = formatHours(roundHours(minSust));
      operational = `Extend alternate sustainment capacity beyond ${sustDisplay} where short to reduce early degradation risk.`;
      break;
    }
    case 'REDUNDANCY_HARDENING':
      operational = 'Establish geographically separated and independently survivable service paths to reduce single-point failure exposure.';
      break;
    case 'PRIORITY_RESTORATION':
      operational = 'Formalize priority restoration agreements with providers to reduce recovery uncertainty.';
      break;
    case 'CASCADE_MITIGATION':
      operational = `Reduce downstream cascade exposure by improving resilience before the ${formatHours(tti)} severe impact threshold.`;
      break;
    case 'RECOVERY_ACCELERATION':
      operational = 'Reduce recovery time by improving restoration logistics and pre-event coordination.';
      break;
    default:
      operational = 'Address identified gaps to reduce operational risk.';
  }

  const text = `${affected} ${operational} ${justification}`.trim();
  const title = DRIVER_TITLES[kind];
  return { title, text, score, leadSector };
}

/**
 * Build Priority Actions for [[PRIORITY_ACTIONS]] anchor.
 * One action per driver category; sectors referenced in paragraph. Cap 4–6 actions; ranked by TTI and loss.
 */
export function buildPriorityActions(vm: ReportVM): PriorityAction[] {
  const { summary, assessment, crossDependencyEnabled } = vm;
  const node = getCrossDependenciesNode(assessment);
  const edges = node.edges ?? [];
  const crossDepEnabled = crossDependencyEnabled && edges.length > 0;

  const sectors = buildSectorData(summary, assessment, edges);
  const groups = groupSectorsByDriverKind(sectors, edges, crossDepEnabled);

  const entries = Array.from(groups.entries()).map(([kind, sectorList]) => ({ kind, sectors: sectorList }));
  const sorted = sortGroupedBySeverity(entries);
  const capped = sorted.slice(0, 6);

  return capped.map(({ kind, sectors: sectorList }, i) => {
    const { title, text, score, leadSector } = buildGroupedAction(kind, sectorList);
    return {
      id: `pa-${i + 1}`,
      sector: leadSector.code,
      kind,
      title,
      text,
      score,
    };
  });
}
