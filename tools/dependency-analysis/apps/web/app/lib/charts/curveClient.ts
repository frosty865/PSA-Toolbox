/**
 * Client-safe curve logic (deterministic, input-driven).
 * Direct mapping of user inputs to curve points.
 * Horizon 0–96h; capacity 0–100%. Zero is valid (e.g. timeToImpact=0, recovery=0).
 */
import type { CategoryInput } from 'schema';

/** Operational curve horizon (hours). All curves use 0–96 (matches Excel/report). */
const HORIZON_HOURS = 96;
const CAPACITY_MIN = 0;
const CAPACITY_MAX = 100;

/** Tolerance for treating two times as the same (hours). */
const TIME_EPS = 1e-6;

function hasTime(times: number[], t: number): boolean {
  return times.some((x) => Math.abs(x - t) < TIME_EPS);
}

function addTime(times: number[], t: number, maxHours: number): void {
  if (!Number.isFinite(t)) return;
  if (t < 0) return;
  if (t > maxHours + TIME_EPS) return;
  if (hasTime(times, t)) return;
  times.push(t);
}

export type BuildTimeGridOpts = {
  horizonHours: number;
  baseStepHours: number;
  activationDelayHr?: number | null;
  ttiHours?: number | null;
  backupEndHours?: number | null;
  recoveryStartHours?: number | null;
  recoveryEndHours?: number | null;
};

/**
 * Build a sorted, deduped time grid that includes integer steps and all transition times.
 * QC requires explicit points at activation delay, TTI, backup end, recovery boundaries.
 */
export function buildTimeGrid(opts: BuildTimeGridOpts): number[] {
  const {
    horizonHours,
    baseStepHours,
    activationDelayHr,
    ttiHours,
    backupEndHours,
    recoveryStartHours,
    recoveryEndHours,
  } = opts;
  const times: number[] = [];
  for (let h = 0; h <= horizonHours + TIME_EPS; h += baseStepHours) {
    if (h > horizonHours + TIME_EPS) break;
    addTime(times, h, horizonHours);
  }
  if (activationDelayHr != null) addTime(times, activationDelayHr, horizonHours);
  if (ttiHours != null) addTime(times, ttiHours, horizonHours);
  if (backupEndHours != null) addTime(times, backupEndHours, horizonHours);
  if (recoveryStartHours != null) addTime(times, recoveryStartHours, horizonHours);
  if (recoveryEndHours != null) addTime(times, recoveryEndHours, horizonHours);
  addTime(times, horizonHours, horizonHours);
  times.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const t of times) {
    if (deduped.length === 0 || Math.abs(t - deduped[deduped.length - 1]) > TIME_EPS) {
      deduped.push(t);
    }
  }
  return deduped;
}

export type CurvePoint = {
  t_hours: number;
  capacity_without_backup: number;
  capacity_with_backup: number;
};

/**
 * Clamp numeric value to [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Safe coercion: handles string/number; returns NaN if invalid. */
function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = String(v).trim().replace('%', '');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  if (v === null || v === undefined) return NaN;
  return NaN;
}

const MANUAL_OR_VENDOR_MODES = ['MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED'] as const;

function effectiveHasBackup(input: CategoryInput): boolean {
  const anyInput = input as Record<string, unknown>;
  if (input.has_backup_any !== undefined) return input.has_backup_any === true;
  if (input.has_backup === true) return true;
  // Support curve_* keys (e.g. Communications or stored shape)
  const curveBackup = anyInput.curve_backup_available;
  return curveBackup === true || curveBackup === 'yes';
}

/** Activation delay in hours for manual/vendor modes; 0 for AUTOMATIC or UNKNOWN. */
function getActivationDelayHours(input: CategoryInput): number {
  const ra = (input as Record<string, unknown>).redundancy_activation as
    | { mode?: string; activation_delay_min?: number | null }
    | undefined;
  if (!ra) return 0;
  const mode = ra.mode ?? 'UNKNOWN';
  if (mode === 'AUTOMATIC') return 0;
  if (mode === 'UNKNOWN') return 0;
  if (MANUAL_OR_VENDOR_MODES.includes(mode as (typeof MANUAL_OR_VENDOR_MODES)[number])) {
    const min = ra.activation_delay_min;
    if (min != null && Number.isFinite(min) && min >= 0) return Math.min(min / 60, CHART_MAX_HOURS);
  }
  return 0;
}

export function getCurveLegendLabels(input: CategoryInput): { without: string; with: string } {
  return {
    without: 'Without Backup',
    with: 'With Backup',
  };
}

/**
 * Deterministic impact curve model with explicit outage/recovery horizons.
 * Prescribed Agency math: capacity % + loss % = 100 (capacity = 100 - loss).
 * Chart and export must use capacity (0–100) consistently; do not mix loss and capacity.
 *
 * CRITICAL semantics:
 * - Backup expiration does NOT trigger recovery.
 * - Recovery starts only at T_outage (service restoration time).
 * - With-backup curve reverts to no-backup degraded capacity (L_no) after backup expires.
 * - All values stored as raw numeric: t_hours as number, capacity as number (0..100).
 * - Format only for display; never store formatted values in the curve dataset.
 *
 * Time horizons (0–96h chart):
 *   T_impact: Time when service becomes critical (gates WITHOUT BACKUP curve only)
 *   T_backup_end: T_backup (when backup is exhausted, measured from outage start t=0)
 *   T_outage: Service restoration time / outage horizon (96h)
 *   T_recovery_end: T_outage + T_recovery, capped at 96h
 */
const CHART_MAX_HOURS = HORIZON_HOURS;

export function buildCurveDeterministic(input: CategoryInput): CurvePoint[] {
  const points: CurvePoint[] = [];

  // Extract user inputs (support both curve_* and CategoryInput-style keys for all infra types).
  // When backup is available, the WITH_BACKUP curve uses L_with (loss_with_backup) in the sustainment window; otherwise same as no-backup.
  const anyInput = input as Record<string, unknown>;
  const requiresService =
    input.requires_service === true || anyInput.curve_requires_service === true;
  const T_impact = toNum(input.time_to_impact_hours ?? anyInput.curve_time_to_impact_hours ?? 0) || 0;
  const L_no = clamp((toNum(input.loss_fraction_no_backup ?? anyInput.curve_loss_fraction_no_backup ?? 0) || 0) * 100, 0, 100);
  const L_with = clamp((toNum(input.loss_fraction_with_backup ?? anyInput.curve_loss_fraction_with_backup ?? 0) || 0) * 100, 0, 100);
  const T_backup = toNum(input.backup_duration_hours ?? anyInput.curve_backup_duration_hours ?? 0) || 0;
  const T_recovery = toNum(input.recovery_time_hours ?? anyInput.curve_recovery_time_hours ?? 0) || 0;
  const hasBackup = effectiveHasBackup(input);

  let T_outage = toNum(anyInput.outage_duration_hours) || CHART_MAX_HOURS;
  if (!Number.isFinite(T_outage) || T_outage > CHART_MAX_HOURS) T_outage = CHART_MAX_HOURS;

  // Validate and enforce time ordering to prevent logical inconsistencies
  if (T_outage < T_impact && requiresService && L_no > 0) {
    console.warn('[Curve] Invalid time ordering: outage ends before impact time. Adjusting T_outage to T_impact.', {
      T_impact,
      T_outage_original: T_outage,
    });
    T_outage = T_impact; // Enforce minimum outage duration
  }

  // Cap recovery end at chart max so curve stays within 96 hours
  const T_recovery_start = T_outage;
  const T_recovery_end_raw = T_recovery_start + T_recovery;
  const T_recovery_end = Math.min(T_recovery_end_raw, CHART_MAX_HOURS);

  // Short-circuit: no service required => flat 100% capacity
  if (!requiresService) {
    points.push({
      t_hours: 0,
      capacity_without_backup: 100,
      capacity_with_backup: 100,
    });
    return points;
  }

  // Time horizons (all numeric, no formatting); recovery end capped at CHART_MAX_HOURS
  // Backup duration is measured from when alternate engages (after activation delay).
  // Time-to-impact only gates the WITHOUT BACKUP curve.
  const T_activation = hasBackup ? getActivationDelayHours(input) : 0; // Transition window: pre-alternate loss
  const T_backup_end = hasBackup ? T_activation + T_backup : 0; // When backup is exhausted (from alternate engagement)
  // QC requires an explicit point at activation_delay_min/60 whenever present; add to grid even when mode ignores it for semantics
  const ra = anyInput.redundancy_activation as { activation_delay_min?: number | null } | undefined;
  const delayHrForGrid =
    ra?.activation_delay_min != null && Number.isFinite(ra.activation_delay_min) && ra.activation_delay_min > 0
      ? ra.activation_delay_min / 60
      : null;

  // Loss at time t WITHOUT backup (percent loss 0..100)
  // Phases:
  //   [0, T_impact): 0 (normal)
  //   [T_impact, T_outage): L_no (full outage)
  //   [T_outage, T_recovery_end): linear ramp L_no -> 0 (recovery in progress)
  //   [T_recovery_end, ∞): 0 (recovered)
  function lossWithoutBackupAtTime(t: number): number {
    if (t < T_impact) {
      return 0; // Normal operation before asset becomes critical
    }

    // Outage window (pre-restoration): fixed loss
    if (t < T_outage) {
      return L_no;
    }

    // Post-restoration recovery ramp back to 0 loss
    if (T_recovery <= 0) {
      return 0; // Instant recovery (no ramp needed)
    }

    const frac = clamp((t - T_outage) / T_recovery, 0, 1);
    return L_no * (1 - frac);
  }

  // Loss at time t WITH backup (percent loss 0..100)
  // Phases:
  //   [0, T_activation): L_no (transition window: alternate not yet engaged)
  //   [T_activation, T_backup_end]: L_with (alternate active)
  //   (T_backup_end, T_outage): L_no (backup exhausted)
  //   [T_outage, T_recovery_end): same recovery ramp as WITHOUT BACKUP
  //   [T_recovery_end, ∞): 0 (recovered)
  function lossWithBackupAtTime(t: number): number {
    if (!hasBackup || T_backup_end <= 0) {
      return lossWithoutBackupAtTime(t);
    }

    // Transition window: from t=0 to T_activation use L_no (activation delay)
    if (T_activation > 0 && t < T_activation) {
      return L_no;
    }

    // Sustainment window: from T_activation through T_backup_end use L_with.
    // Inclusive end prevents an artificial drop exactly at horizon when backup_duration == 96.
    if (t <= T_backup_end) {
      return L_with;
    }

    // After backup expires: ungated outage loss
    if (t < T_outage) {
      return L_no;
    }

    // Recovery phase (same as without-backup)
    if (T_recovery <= 0) return 0;
    const frac = clamp((t - T_outage) / T_recovery, 0, 1);
    return L_no * (1 - frac);
  }

  const clamp01 = (n: number) => Math.min(100, Math.max(0, n));
  const toCapacityFromLoss = (lossPct: number) => 100 - clamp01(lossPct);

  // Grid must include every transition time so QC finds a point at activation_delay_hours etc.
  const timeGrid = buildTimeGrid({
    horizonHours: CHART_MAX_HOURS,
    baseStepHours: 1,
    activationDelayHr: delayHrForGrid ?? (hasBackup && T_activation > 0 ? T_activation : null),
    ttiHours: T_impact > 0 ? T_impact : null,
    backupEndHours: hasBackup && T_backup_end > 0 ? T_backup_end : null,
    recoveryStartHours: T_recovery_start <= CHART_MAX_HOURS ? T_recovery_start : null,
    recoveryEndHours: T_recovery_end <= CHART_MAX_HOURS ? T_recovery_end : null,
  });

  for (const t of timeGrid) {
    const lossNo = lossWithoutBackupAtTime(t);
    const lossWith = lossWithBackupAtTime(t);
    const capNo = clamp(toCapacityFromLoss(lossNo), CAPACITY_MIN, CAPACITY_MAX);
    const capWith = clamp(toCapacityFromLoss(lossWith), CAPACITY_MIN, CAPACITY_MAX);
    points.push({
      t_hours: t,
      capacity_without_backup: capNo,
      capacity_with_backup: capWith,
    });
    if (t < T_outage && t <= T_backup_end && t >= T_impact && capWith < capNo - 0.01) {
      console.warn(
        `[Curve] Invariant violated: with-backup (${capWith.toFixed(2)}%) < without-backup (${capNo.toFixed(2)}%) at t=${t}h (should not occur while backup active).`
      );
    }
  }

  // Sort by t_hours (grid is already sorted but ensure stable order)
  points.sort((a, b) => a.t_hours - b.t_hours);

  // Dev assertion: verify curve reflects inputs
  if (requiresService && L_no > 0) {
    const capAtImpact = points.find((p) => p.t_hours >= T_impact && p.t_hours < T_impact + 1);
    if (capAtImpact) {
      const expectedCapacity = 100 - L_no;
      if (Math.abs(capAtImpact.capacity_without_backup - expectedCapacity) > 0.1) {
        console.warn(
          `[Curve] Expected capacity ~${expectedCapacity.toFixed(2)}% after impact, got ${capAtImpact.capacity_without_backup.toFixed(2)}%`
        );
      }
    }
  }

  // Dev assertion: min/max capacity bounds
  const allCaps = points.flatMap((p) => [p.capacity_without_backup, p.capacity_with_backup]);
  const minCap = Math.min(...allCaps);
  const maxCap = Math.max(...allCaps);
  if (minCap < -0.01 || maxCap > 100.01) {
    console.warn(`[Curve] Capacity out of bounds: [${minCap.toFixed(2)}, ${maxCap.toFixed(2)}]%`);
  }

  return points;
}

// Backward-compatibility export (for existing imports)
export const buildCurveWorkbookAligned = buildCurveDeterministic;
