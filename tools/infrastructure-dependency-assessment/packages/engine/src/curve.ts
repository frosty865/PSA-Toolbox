import type { CategoryInput } from 'schema';

export type CurvePoint = {
  t_hours: number;
  capacity_without_backup: number;
  capacity_with_backup: number;
};

/**
 * Format number to 1 decimal place, clamped to 0-100.
 */
function pct(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

const MANUAL_OR_VENDOR_MODES = ['MANUAL_ONSITE', 'MANUAL_REMOTE', 'VENDOR_REQUIRED'] as const;

/** Effective "has backup" from EP (has_backup_any), legacy (has_backup), or curve_* (e.g. Comms). */
function effectiveHasBackup(input: CategoryInput): boolean {
  if (input.has_backup_any !== undefined) return input.has_backup_any === true;
  if (input.has_backup === true) return true;
  const curveBackup = (input as Record<string, unknown>).curve_backup_available;
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
    if (min != null && Number.isFinite(min) && min >= 0) return min / 60;
  }
  return 0;
}

/** Whether backup is specifically a generator (for legend wording). */
export function hasBackupGenerator(input: CategoryInput): boolean {
  return input.has_backup_generator === true;
}

/**
 * Legend labels for impact curves (standardized across all categories).
 */
export function getCurveLegendLabels(input: CategoryInput): { without: string; with: string } {
  return {
    without: 'Without Backup',
    with: 'With Backup',
  };
}

/** Chart and curve horizon per workbook (last tabs): 78 hours. */
const CHART_MAX_HOURS = 78;

/**
 * Deterministic impact curve: workbook-aligned (78h horizon).
 * Prescribed Agency math: capacity % + loss % = 100 (capacity = 100 - loss).
 * All curve points use capacity (0–100); never mix loss and capacity in the same display.
 *
 * WITHOUT BACKUP:
 *   [0, T_impact): 0 loss → 100% capacity
 *   [T_impact, T_outage): L_no loss → (100 - L_no)% capacity
 *   [T_outage, T_recovery_end): linear ramp L_no -> 0
 *   [T_recovery_end, inf): 0 loss → 100% capacity
 *
 * WITH BACKUP:
 *   [0, T_backup_end]: L_with loss → (100 - L_with)% capacity (backup from t=0)
 *   (T_backup_end, T_outage): L_no loss → same as without backup
 *   [T_outage, T_recovery_end): same recovery ramp
 * Recovery starts at T_outage (78h), not at backup end.
 */
export function buildCurveWorkbookAligned(input: CategoryInput): CurvePoint[] {
  const points: CurvePoint[] = [];
  const anyInput = input as Record<string, unknown>;

  // Support both CategoryInput and curve_* keys (e.g. Communications)
  const requiresService = input.requires_service === true;
  const T_impact = (input.time_to_impact_hours ?? anyInput.curve_time_to_impact_hours ?? 0) as number;
  const L_no = Math.min(100, Math.max(0, ((input.loss_fraction_no_backup ?? anyInput.curve_loss_fraction_no_backup ?? 0) as number) * 100));
  const L_with = Math.min(100, Math.max(0, ((input.loss_fraction_with_backup ?? anyInput.curve_loss_fraction_with_backup ?? 0) as number) * 100));
  const T_backup = (input.backup_duration_hours ?? anyInput.curve_backup_duration_hours ?? 0) as number;
  const T_recovery = (input.recovery_time_hours ?? anyInput.curve_recovery_time_hours ?? 0) as number;
  const hasBackup = effectiveHasBackup(input);

  const T_outage = CHART_MAX_HOURS; // Outage horizon 78h per workbook
  const T_activation = hasBackup ? getActivationDelayHours(input) : 0;
  const T_backup_end = hasBackup ? T_activation + T_backup : 0; // Backup exhausted from alternate engagement
  const T_recovery_start = T_outage;
  const T_recovery_end = Math.min(T_recovery_start + T_recovery, CHART_MAX_HOURS);

  if (!requiresService) {
    points.push({ t_hours: 0, capacity_without_backup: 100, capacity_with_backup: 100 });
    return points;
  }

  function lossWithoutBackupAtTime(t: number): number {
    if (t < T_impact) return 0;
    if (t < T_outage) return L_no;
    if (T_recovery <= 0) return 0;
    const frac = Math.min(1, Math.max(0, (t - T_outage) / T_recovery));
    return L_no * (1 - frac);
  }

  function lossWithBackupAtTime(t: number): number {
    if (!hasBackup || T_backup_end <= 0) return lossWithoutBackupAtTime(t);
    // Transition window: from t=0 to T_activation use L_no (manual/vendor initiation delay)
    if (T_activation > 0 && t < T_activation) return L_no;
    // Sustainment window: from T_activation to T_backup_end use L_with
    if (t <= T_backup_end) return L_with;
    if (t < T_outage) return L_no;
    if (T_recovery <= 0) return 0;
    const frac = Math.min(1, Math.max(0, (t - T_outage) / T_recovery));
    return L_no * (1 - frac);
  }

  const criticalTimes = new Set<number>();
  criticalTimes.add(0);
  if (T_impact > 0 && T_impact <= CHART_MAX_HOURS) criticalTimes.add(T_impact);
  if (hasBackup && T_activation > 0 && T_activation <= CHART_MAX_HOURS) criticalTimes.add(T_activation);
  if (hasBackup && T_backup_end > 0 && T_backup_end <= CHART_MAX_HOURS) criticalTimes.add(T_backup_end);
  if (T_recovery_start <= CHART_MAX_HOURS) criticalTimes.add(T_recovery_start);
  criticalTimes.add(T_recovery_end);
  criticalTimes.add(CHART_MAX_HOURS);

  const sortedCritical = Array.from(criticalTimes).sort((a, b) => a - b).filter((t) => t <= CHART_MAX_HOURS);
  const seenTimes = new Set<number>();

  for (let i = 0; i < sortedCritical.length - 1; i++) {
    const t_start = sortedCritical[i];
    const t_end = sortedCritical[i + 1];
    const step = t_end - t_start > 20 ? 3 : 1;
    for (let t = t_start; t <= t_end; t += step) {
      if (t > CHART_MAX_HOURS) continue;
      if (seenTimes.has(t)) continue;
      seenTimes.add(t);
      points.push({
        t_hours: t,
        capacity_without_backup: pct(100 - lossWithoutBackupAtTime(t)),
        capacity_with_backup: pct(100 - lossWithBackupAtTime(t)),
      });
    }
  }

  if (!seenTimes.has(CHART_MAX_HOURS)) {
    points.push({
      t_hours: CHART_MAX_HOURS,
      capacity_without_backup: pct(100 - lossWithoutBackupAtTime(CHART_MAX_HOURS)),
      capacity_with_backup: pct(100 - lossWithBackupAtTime(CHART_MAX_HOURS)),
    });
  }

  return points;
}

/**
 * Build curve points for t = 0, stepHours, ... horizonHours.
 * Capacities are percent 0..100, clamped and rounded to 1 decimal.
 * 
 * (Deprecated: Use buildCurveWorkbookAligned for deterministic input-driven curves)
 */
export function buildCurve(
  input: CategoryInput,
  horizonHours = 72,
  stepHours = 3
): CurvePoint[] {
  const points: CurvePoint[] = [];
  const hasBackup = effectiveHasBackup(input);

  for (let t = 0; t <= horizonHours; t += stepHours) {
    let capacityNoBackup: number;
    let capacityWithBackup: number;

    if (!input.requires_service) {
      capacityNoBackup = 100;
      capacityWithBackup = 100;
    } else {
      const tti = input.time_to_impact_hours ?? 0;
      const lossNo = input.loss_fraction_no_backup ?? 0;
      if (t < tti) {
        capacityNoBackup = 100;
      } else {
        capacityNoBackup = (1 - lossNo) * 100;
      }

      if (!hasBackup) {
        capacityWithBackup = capacityNoBackup;
      } else {
        const duration = input.backup_duration_hours!;
        const lossWith = input.loss_fraction_with_backup!;
        if (t < duration) {
          capacityWithBackup = 100;
        } else {
          capacityWithBackup = (1 - lossWith) * 100;
        }
      }
    }

    points.push({
      t_hours: t,
      capacity_without_backup: pct(capacityNoBackup),
      capacity_with_backup: pct(capacityWithBackup),
    });
  }

  return points;
}
