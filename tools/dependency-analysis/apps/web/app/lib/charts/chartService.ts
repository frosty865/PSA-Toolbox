/**
 * Single source of truth for category impact curves (client-safe).
 * Uses curveClient (workbook-aligned) for parity with engine export.
 * COMMUNICATIONS uses PACE-layered curve instead of binary with/without backup.
 */
import type { CategoryCode, CategoryInput } from 'schema';
import { buildCurveWorkbookAligned, getCurveLegendLabels, type CurvePoint } from './curveClient';
import {
  buildCommunicationsPaceCurve,
  HORIZON_HOURS,
  type CommsPaceCurveInput,
  type CommsPaceCurveResult,
  type PaceCurveSegment,
} from './communications_pace_curve';

export const CHART_CATEGORIES: CategoryCode[] = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
];

/** Shared curve constants: capacity domain for all operational curves. */
export const CAPACITY_MIN = 0;
export const CAPACITY_MAX = 100;

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

function toNumPct(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const s = String(v).trim().replace('%', '');
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function lossToCapacity(lossPct: number): number {
  return 100 - clampPct(lossPct);
}

/** All operational curves use 96h horizon (matches Excel/report). */
const CHART_MAX_HOURS = HORIZON_HOURS;

const HORIZON_GRID = Array.from({ length: HORIZON_HOURS + 1 }, (_, i) => i);

function isCurveDebugEnabled(): boolean {
  return process.env.ADA_VULN_DEBUG === '1' || process.env.ADA_VULN_DEBUG === 'true';
}

/** Step-hold: last known value at or before t. */
function sampleAt(sorted: ChartDataPoint[], t: number, key: 'withoutBackup' | 'withBackup'): number {
  let y = 0;
  for (const p of sorted) {
    if (p.t_hours <= t) y = p[key];
    else break;
  }
  return y;
}

/** Resample to 1-hour grid (0..96) for consistent Summary charts. */
function resampleToHourly(points: ChartDataPoint[]): ChartDataPoint[] {
  const sorted = [...(points ?? [])].sort((a, b) => a.t_hours - b.t_hours);
  return HORIZON_GRID.map((t) => ({
    t_hours: t,
    withoutBackup: sampleAt(sorted, t, 'withoutBackup'),
    withBackup: sampleAt(sorted, t, 'withBackup'),
  }));
}

export type ChartDataPoint = { t_hours: number; withoutBackup: number; withBackup: number };

/** Multi-series PACE curve: Effective + per-layer lines with visibility toggles. */
export type PaceSeriesItem = {
  id: string;
  label: string;
  dataKey: string;
  points: Array<{ t_hours: number; capacity_pct: number }>;
  stroke: string;
  strokeWidth: number;
  defaultVisible: boolean;
};

export type CategoryChartData = {
  withoutBackup: ChartDataPoint[];
  withBackup: ChartDataPoint[];
  legend: { without: string; with: string };
  /** When alternate exists and activation_delay_min > 0, hour at which alternate engages (for "Alternate engaged" annotation). */
  activationDelayHours?: number;
  /** Communications only: PACE segments for tooltip and legend (P/A/C/E). */
  paceSegments?: PaceCurveSegment[];
  /** Communications only: multi-line PACE series (Primary, Alternate, Contingency, Emergency, Effective). */
  paceMultiSeries?: PaceSeriesItem[];
  /** When true, render only paceMultiSeries (no withoutBackup/withBackup lines). */
  usePaceOnly?: boolean;
  /** Flattened data for multi-series chart (t_hours + all series keys). */
  _flatData?: Record<string, number>[];
};

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = String(v).trim().replace('%', '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function toChartPoints(points: CurvePoint[]): ChartDataPoint[] {
  const raw = points ?? [];
  const out: ChartDataPoint[] = [];
  for (const p of raw) {
    const t = toNum(p.t_hours);
    const cNo = toNum(p.capacity_without_backup);
    const cWith = toNum(p.capacity_with_backup);
    if (!Number.isFinite(t) || !Number.isFinite(cNo) || !Number.isFinite(cWith)) continue;
    if (t < 0 || t > HORIZON_HOURS) continue;
    out.push({
      t_hours: t,
      withoutBackup: Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, cNo)),
      withBackup: Math.min(CAPACITY_MAX, Math.max(CAPACITY_MIN, cWith)),
    });
  }
  if (isCurveDebugEnabled() && raw.length > 0 && out.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[toChartPoints] filtered all points', { raw_sample: raw.slice(0, 5) });
  }
  return out;
}

function toCommsPaceInput(slice: CategoryInput): CommsPaceCurveInput {
  const s = slice as Record<string, unknown>;
  const curveRequiresService = slice.requires_service ?? (s.curve_requires_service as boolean | undefined);
  const curveTimeToImpact = slice.time_to_impact_hours ?? (s.curve_time_to_impact_hours as number | undefined) ?? null;
  const curveLossNoBackup = slice.loss_fraction_no_backup ?? (s.curve_loss_fraction_no_backup as number | undefined) ?? null;
  const curveRecovery = slice.recovery_time_hours ?? (s.curve_recovery_time_hours as number | undefined) ?? null;
  return {
    curve_requires_service: curveRequiresService,
    curve_time_to_impact_hours: curveTimeToImpact,
    curve_loss_fraction_no_backup: curveLossNoBackup,
    curve_recovery_time_hours: curveRecovery,
    comm_pace_P: s.comm_pace_P as CommsPaceCurveInput['comm_pace_P'],
    comm_pace_A: s.comm_pace_A as CommsPaceCurveInput['comm_pace_A'],
    comm_pace_C: s.comm_pace_C as CommsPaceCurveInput['comm_pace_C'],
    comm_pace_E: s.comm_pace_E as CommsPaceCurveInput['comm_pace_E'],
  };
}

/** Sample capacity at time t from PACE curve points (step curve: use capacity at last point where point.t <= t). */
function samplePaceCapacityAt(points: Array<{ t: number; capacity: number }>, t: number): number {
  let cap = 100;
  for (const p of points) {
    if (p.t <= t) cap = p.capacity;
    else break;
  }
  return cap;
}

function clampCapacity(c: number): number {
  return Math.max(CAPACITY_MIN, Math.min(CAPACITY_MAX, c));
}

const PACE_SERIES_STYLE: Record<string, { stroke: string; strokeWidth: number; defaultVisible: boolean }> = {
  primary: { stroke: '#0071bc', strokeWidth: 2.5, defaultVisible: true },
  alternate: { stroke: '#02bfe7', strokeWidth: 2, defaultVisible: true },
  contingency: { stroke: '#e87500', strokeWidth: 2, defaultVisible: true },
  emergency: { stroke: '#cd2026', strokeWidth: 2, defaultVisible: true },
  effectiveMax: { stroke: '#1b365d', strokeWidth: 3, defaultVisible: false },
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Primary = infrastructure dependency drop curve (100 → capacityAfterImpact at timeToImpact). */
function primaryCapacityAtHour(h: number, timeToImpact: number, capacityAfterImpact: number): number {
  return h < timeToImpact ? 100 : capacityAfterImpact;
}

/**
 * Layer capacity with activation + sustain window. sustainHours null => through horizon (EMERGENCY unlimited).
 */
function layerCapacityAtHour(
  h: number,
  activateAfter: number,
  sustainHours: number | null,
  capacityPct: number,
  horizon: number
): number {
  const cap = clamp(capacityPct, 0, 100);
  if (cap <= 0) return 0;
  if (h < activateAfter) return 0;
  if (sustainHours == null) return cap;
  const end = activateAfter + sustainHours;
  if (h > end) return 0;
  return cap;
}

function buildSeriesFromAtHour(
  id: string,
  label: string,
  atHour: (h: number) => number,
  style: { stroke: string; strokeWidth: number; defaultVisible: boolean }
): PaceSeriesItem {
  const points = HORIZON_GRID.map((h) => ({
    t_hours: h,
    capacity_pct: clamp(atHour(h), CAPACITY_MIN, CAPACITY_MAX),
  }));
  return { id, label, dataKey: id, points, ...style };
}

function toNumFallback(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(String(v).trim().replace('%', ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

type CommsLayerRaw = {
  sustain_hours?: number | null;
  effective_capacity_pct?: number | null;
  activate_after_hours?: number | null;
  system_type?: string | null;
};

function isLayerViable(layer: CommsLayerRaw): boolean {
  const st = layer?.system_type;
  return !!(st && st !== 'NONE' && st !== 'UNKNOWN');
}

/** Build Communications chart data: 1 line per P/A/C/E + optional Effective (max). */
function buildCommsChartData(input: CommsPaceCurveInput, slice: CategoryInput): CategoryChartData {
  const req = input.curve_requires_service ?? (slice as Record<string, unknown>).curve_requires_service;
  if (!req) {
    const empty = HORIZON_GRID.map((h) => ({ t_hours: h, withoutBackup: 0, withBackup: 0 }));
    return {
      withoutBackup: empty,
      withBackup: empty,
      legend: { without: 'Primary', with: 'Effective' },
    };
  }

  const tImpact = clamp(toNumFallback(input.curve_time_to_impact_hours, 0), 0, CHART_MAX_HOURS);
  const lossNoBackup = clamp((input.curve_loss_fraction_no_backup ?? 0) * 100, 0, 100);
  const capAfterImpact = 100 - lossNoBackup;

  const primary = buildSeriesFromAtHour(
    'primary',
    'Primary',
    (h) => primaryCapacityAtHour(h, tImpact, capAfterImpact),
    PACE_SERIES_STYLE.primary
  );

  const A = (input.comm_pace_A ?? {}) as CommsLayerRaw;
  const aViable = isLayerViable(A);
  const aActivate = clamp(toNumFallback(A.activate_after_hours, 0), 0, CHART_MAX_HOURS);
  const aCap = aViable ? clamp(toNumFallback(A.effective_capacity_pct, 0), 0, 100) : 0;
  const aSustainRaw = toNumFallback(A.sustain_hours, 0);
  const aSustain = aSustainRaw > 0 ? clamp(aSustainRaw, 0, 96) : 0;

  const alternate = buildSeriesFromAtHour(
    'alternate',
    'Alternate',
    (h) =>
      aCap > 0 && aSustain > 0 ? layerCapacityAtHour(h, aActivate, aSustain, aCap, CHART_MAX_HOURS) : 0,
    PACE_SERIES_STYLE.alternate
  );

  const C = (input.comm_pace_C ?? {}) as CommsLayerRaw;
  const cViable = isLayerViable(C);
  const cActivate = clamp(toNumFallback(C.activate_after_hours, 0), 0, CHART_MAX_HOURS);
  const cCap = cViable ? clamp(toNumFallback(C.effective_capacity_pct, 0), 0, 100) : 0;
  const cSustainRaw = toNumFallback(C.sustain_hours, 0);
  const cSustain = cSustainRaw > 0 ? clamp(cSustainRaw, 0, 96) : 0;

  const contingency = buildSeriesFromAtHour(
    'contingency',
    'Contingency',
    (h) =>
      cCap > 0 && cSustain > 0 ? layerCapacityAtHour(h, cActivate, cSustain, cCap, CHART_MAX_HOURS) : 0,
    PACE_SERIES_STYLE.contingency
  );

  const E = (input.comm_pace_E ?? {}) as CommsLayerRaw;
  const eViable = isLayerViable(E);
  const eActivate = clamp(toNumFallback(E.activate_after_hours, 0), 0, CHART_MAX_HOURS);
  const eCap = eViable ? clamp(toNumFallback(E.effective_capacity_pct, 0), 0, 100) : 0;
  const eSustainRaw = toNumFallback(E.sustain_hours, NaN);
  const eSustain =
    Number.isFinite(eSustainRaw) && eSustainRaw > 0 ? clamp(eSustainRaw, 0, 96) : null;

  const emergency = buildSeriesFromAtHour(
    'emergency',
    'Emergency',
    (h) => (eCap > 0 ? layerCapacityAtHour(h, eActivate, eSustain, eCap, CHART_MAX_HOURS) : 0),
    PACE_SERIES_STYLE.emergency
  );

  const effectiveMax = buildSeriesFromAtHour(
    'effectiveMax',
    'Effective (max)',
    (h) =>
      Math.max(
        primary.points[h]?.capacity_pct ?? 0,
        alternate.points[h]?.capacity_pct ?? 0,
        contingency.points[h]?.capacity_pct ?? 0,
        emergency.points[h]?.capacity_pct ?? 0
      ),
    PACE_SERIES_STYLE.effectiveMax
  );

  const paceMultiSeries: PaceSeriesItem[] = [
    primary,
    alternate,
    contingency,
    emergency,
    effectiveMax,
  ];

  const chartPoints: ChartDataPoint[] = primary.points.map((p) => ({
    t_hours: p.t_hours,
    withoutBackup: p.capacity_pct,
    withBackup: p.capacity_pct,
  }));

  const flatData: Record<string, number>[] = HORIZON_GRID.map((h) => {
    const rec: Record<string, number> = {
      t_hours: h,
      withoutBackup: primary.points[h]?.capacity_pct ?? 0,
      withBackup: effectiveMax.points[h]?.capacity_pct ?? 0,
    };
    for (const s of paceMultiSeries) {
      rec[s.id] = s.points[h]?.capacity_pct ?? 0;
    }
    return rec;
  });

  return {
    withoutBackup: chartPoints,
    withBackup: chartPoints,
    legend: { without: 'Primary', with: 'Effective' },
    paceMultiSeries,
    usePaceOnly: true,
    _flatData: flatData,
  };
}

/**
 * Build chart-ready data for a category. Returns null if category is not curve-capable or input is missing.
 * COMMUNICATIONS uses PACE-layered curve (regional scenario).
 */
export function buildCategoryChartData(
  categoryCode: CategoryCode,
  assessmentSlice: CategoryInput | null | undefined
): CategoryChartData | null {
  if (!CHART_CATEGORIES.includes(categoryCode) || !assessmentSlice) return null;
  if (categoryCode === 'COMMUNICATIONS') {
    const input = toCommsPaceInput(assessmentSlice);
    return buildCommsChartData(input, assessmentSlice as CategoryInput);
  }
  const points = buildCurveWorkbookAligned(assessmentSlice);
  const chartPoints = resampleToHourly(toChartPoints(points));
  const legend = getCurveLegendLabels(assessmentSlice);
  const slice = assessmentSlice as Record<string, unknown>;
  const hasBackup =
    assessmentSlice.has_backup_any === true ||
    assessmentSlice.has_backup === true ||
    slice.curve_backup_available === true ||
    slice.curve_backup_available === 'yes';
  const ra = slice.redundancy_activation as { mode?: string; activation_delay_min?: number | null } | undefined;
  const delayMin = ra?.activation_delay_min;
  const activationDelayHours =
    hasBackup && delayMin != null && Number.isFinite(delayMin) && delayMin > 0 ? delayMin / 60 : undefined;
  if (isCurveDebugEnabled() && points.length > 0) {
    const raw = assessmentSlice as Record<string, unknown>;
    const lossNo = raw.curve_loss_fraction_no_backup ?? raw.loss_fraction_no_backup;
    const lossNoPct = typeof lossNo === 'number' ? (lossNo <= 1 ? lossNo * 100 : lossNo) : NaN;
    const tti = toNum(raw.curve_time_to_impact_hours ?? raw.time_to_impact_hours ?? 0) || 0;
    const idxAfterImpact = Math.min(Math.max(0, Math.ceil(tti)), chartPoints.length - 1);
    const ptAfterImpact = chartPoints[idxAfterImpact];
    // eslint-disable-next-line no-console
    console.log('[CURVE INPUTS]', categoryCode, {
      timeToImpact_hours: tti,
      loss_without_backup_pct: lossNoPct,
      expected_capacity_pct: lossToCapacity(lossNoPct),
      plotted_capacity_at_t0: chartPoints[0]?.withoutBackup,
      plotted_capacity_after_impact: ptAfterImpact?.withoutBackup,
      point_count: chartPoints.length,
    });
  }
  return {
    withoutBackup: chartPoints,
    withBackup: chartPoints,
    legend,
    ...(activationDelayHours != null && { activationDelayHours }),
  };
}

/** Communications only: return PACE curve debug for "How this curve was built" panel. */
export function getCommsPaceCurveDebug(
  assessmentSlice: CategoryInput | null | undefined
): CommsPaceCurveResult['debug'] | null {
  if (!assessmentSlice) return null;
  const input = toCommsPaceInput(assessmentSlice);
  const result = buildCommunicationsPaceCurve(input, {
    scenario: 'regional',
    time_horizon: CHART_MAX_HOURS,
  });
  return result.debug;
}

/**
 * Whether the category has enough data to show a meaningful curve.
 * Requires requires_service and at least one curve input. Treats 0 as valid (e.g. immediate impact).
 * Do not use truthy checks: timeToImpact=0 and loss=0 are valid.
 */
export function shouldShowChart(
  categoryCode: CategoryCode,
  assessmentSlice: CategoryInput | null | undefined
): boolean {
  if (!CHART_CATEGORIES.includes(categoryCode) || !assessmentSlice) return false;
  const slice = assessmentSlice as Record<string, unknown>;
  const req =
    assessmentSlice.requires_service === true || slice.curve_requires_service === true;
  const ttiRaw = slice.curve_time_to_impact_hours ?? slice.time_to_impact_hours;
  const lossNoRaw = slice.curve_loss_fraction_no_backup ?? slice.loss_fraction_no_backup;
  const toNum = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? Number(v) : NaN;
  const hasTti = ttiRaw != null && Number.isFinite(toNum(ttiRaw));
  const hasLossNo = lossNoRaw != null && Number.isFinite(toNum(lossNoRaw));
  if (categoryCode === 'COMMUNICATIONS') {
    if (!req) return false;
    return (
      hasTti ||
      hasLossNo ||
      [slice.comm_pace_P, slice.comm_pace_A, slice.comm_pace_C, slice.comm_pace_E].some((l) => l != null && typeof l === 'object')
    );
  }
  if (!req) return false;
  return hasTti || hasLossNo;
}

export { getCurveLegendLabels, HORIZON_HOURS };

/** Human-readable labels for PACE system type codes (e.g. "How this curve was built" table). */
const PACE_SYSTEM_TYPE_LABELS: Record<string, string> = {
  CELLULAR_VOICE: 'Cellular voice',
  PUSH_TO_TALK_CELLULAR: 'Push-to-talk cellular',
  RADIO_DIGITAL: 'Digital radio',
  RADIO_ANALOG: 'Analog radio',
  LANDLINE_VOIP_TRUNK: 'Landline / VoIP trunk',
  SATELLITE_PHONE: 'Satellite phone',
  INTERNAL_PA: 'Internal PA',
  MANUAL_RUNNER: 'Manual runner',
  PUBLIC_SAFETY_RADIO_NETWORK: 'Public safety radio network',
  NONE: 'None (no written PACE plan)',
  UNKNOWN: 'Unknown',
};
export function getPaceSystemTypeDisplayLabel(code: string | undefined): string {
  if (code == null || code === '') return '—';
  return PACE_SYSTEM_TYPE_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

/** Cache key for memoization: category + JSON of relevant curve inputs. */
export function chartDataCacheKey(categoryCode: CategoryCode, input: CategoryInput | null | undefined): string {
  if (!input) return `${categoryCode}:null`;
  const s = input as Record<string, unknown>;
  const slice: Record<string, unknown> = {
    requires_service: input.requires_service,
    time_to_impact_hours: input.time_to_impact_hours ?? s.curve_time_to_impact_hours,
    loss_fraction_no_backup: input.loss_fraction_no_backup ?? s.curve_loss_fraction_no_backup,
    has_backup: input.has_backup,
    has_backup_any: input.has_backup_any,
    backup_duration_hours: input.backup_duration_hours ?? s.curve_backup_duration_hours,
    loss_fraction_with_backup: input.loss_fraction_with_backup ?? s.curve_loss_fraction_with_backup,
    recovery_time_hours: input.recovery_time_hours ?? s.curve_recovery_time_hours,
    redundancy_activation: s.redundancy_activation,
  };
  if (categoryCode === 'COMMUNICATIONS') {
    slice.comm_pace_P = s.comm_pace_P;
    slice.comm_pace_A = s.comm_pace_A;
    slice.comm_pace_C = s.comm_pace_C;
    slice.comm_pace_E = s.comm_pace_E;
  }
  return `${categoryCode}:${JSON.stringify(slice)}`;
}
