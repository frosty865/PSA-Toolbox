/**
 * Single source of truth for export/report curve inputs.
 * Picks: categories.<CAT>.answers.curve_* first (newest UI), then category.curve_*, then category.*.
 * Writes normalized values back onto the category so report VM and reporter see consistent data.
 */
import type { Assessment } from 'schema';

const CURVE_CATEGORIES = [
  'ELECTRIC_POWER',
  'COMMUNICATIONS',
  'INFORMATION_TECHNOLOGY',
  'WATER',
  'WASTEWATER',
] as const;

function pick<T>(...candidates: (T | undefined | null)[]): T | undefined {
  for (const v of candidates) {
    if (v !== undefined && v !== null && v !== '') return v as T;
  }
  return undefined;
}

/** Coerce to number when valid; used so curve_* string values from JSON are written to category. */
function toNum(v: number | string | null | undefined): number | null | undefined {
  if (v === null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickNum(
  ...candidates: (number | string | null | undefined)[]
): number | null | undefined {
  for (const v of candidates) {
    const n = toNum(v);
    if (n !== undefined) return n;
    if (v === null) return null;
  }
  return undefined;
}

function pickBoolOrYesNo(
  ...candidates: (boolean | string | null | undefined)[]
): boolean | 'yes' | 'no' | undefined {
  for (const v of candidates) {
    if (v === true || v === 'yes') return true;
    if (v === false || v === 'no') return false;
  }
  return undefined;
}

export type NormalizedCurveInputs = {
  requires_service: boolean | undefined;
  time_to_impact_hours: number | null | undefined;
  loss_fraction_no_backup: number | null | undefined;
  backup_available: 'yes' | 'no' | undefined;
  backup_duration_hours: number | null | undefined;
  loss_fraction_with_backup: number | null | undefined;
  recovery_time_hours: number | null | undefined;
  primary_provider: string | null | undefined;
  secondary_provider: string | null | undefined;
};

/**
 * Normalize curve fields for one category from answers.curve_* then category.curve_* then category.*.
 * Mutates category with the chosen values so downstream (VM, reporter) sees one source of truth.
 */
export function normalizeCurveInputs(categoryObj: Record<string, unknown>): NormalizedCurveInputs {
  const answers = (categoryObj.answers as Record<string, unknown>) ?? {};
  const cat = categoryObj;

  const backupAvailableChoice = pickBoolOrYesNo(
    answers.curve_backup_available as string | undefined,
    cat.curve_backup_available as string | undefined,
    (cat.has_backup_any === true || cat.has_backup === true) ? 'yes' : (cat.has_backup_any === false || cat.has_backup === false) ? 'no' : undefined
  );
  const backup_available =
    backupAvailableChoice === true ? 'yes' : backupAvailableChoice === false ? 'no' : undefined;

  const requires_service = pick(
    answers.curve_requires_service as boolean | undefined,
    cat.curve_requires_service as boolean | undefined,
    cat.requires_service as boolean | undefined
  );
  const time_to_impact_hours = pickNum(
    answers.curve_time_to_impact_hours as number | undefined,
    cat.curve_time_to_impact_hours as number | undefined,
    cat.time_to_impact_hours as number | undefined
  );
  const loss_fraction_no_backup = pickNum(
    answers.curve_loss_fraction_no_backup as number | undefined,
    cat.curve_loss_fraction_no_backup as number | undefined,
    cat.loss_fraction_no_backup as number | undefined
  );
  const backup_duration_hours = pickNum(
    answers.curve_backup_duration_hours as number | undefined,
    cat.curve_backup_duration_hours as number | undefined,
    cat.backup_duration_hours as number | undefined
  );
  let loss_fraction_with_backup = pickNum(
    answers.curve_loss_fraction_with_backup as number | undefined,
    cat.curve_loss_fraction_with_backup as number | undefined,
    cat.loss_fraction_with_backup as number | undefined
  );
  // With-backup plateau: when backup is yes, require loss_fraction_with_backup (default to no_backup if missing)
  if (backup_available === 'yes' && (loss_fraction_with_backup === undefined || loss_fraction_with_backup === null)) {
    loss_fraction_with_backup = loss_fraction_no_backup ?? null;
  }
  if (backup_available === 'yes' && (loss_fraction_with_backup === undefined || loss_fraction_with_backup === null)) {
    throw new Error(
      `Curve validation: backup_available is "yes" but loss_fraction_with_backup is missing and loss_fraction_no_backup is not set. ` +
        `Set curve_loss_fraction_with_backup or loss_fraction_with_backup for this category.`
    );
  }
  const recovery_time_hours = pickNum(
    answers.curve_recovery_time_hours as number | undefined,
    cat.curve_recovery_time_hours as number | undefined,
    cat.recovery_time_hours as number | undefined
  );
  const primary_provider = pick(
    answers.curve_primary_provider as string | undefined,
    cat.curve_primary_provider as string | undefined
  ) as string | null | undefined;
  const secondary_provider = pick(
    answers.curve_secondary_provider as string | undefined,
    cat.curve_secondary_provider as string | undefined
  ) as string | null | undefined;

  // Write back to category so report and reporter use one source
  if (requires_service !== undefined) cat.requires_service = requires_service;
  if (time_to_impact_hours !== undefined) {
    cat.time_to_impact_hours = time_to_impact_hours;
    cat.curve_time_to_impact_hours = time_to_impact_hours;
  }
  if (loss_fraction_no_backup !== undefined) {
    cat.loss_fraction_no_backup = loss_fraction_no_backup;
    cat.curve_loss_fraction_no_backup = loss_fraction_no_backup;
  }
  if (backup_available !== undefined) {
    cat.curve_backup_available = backup_available;
    cat.has_backup_any = backup_available === 'yes';
  }
  if (backup_duration_hours !== undefined) {
    cat.backup_duration_hours = backup_duration_hours;
    cat.curve_backup_duration_hours = backup_duration_hours;
  }
  if (loss_fraction_with_backup !== undefined) {
    cat.loss_fraction_with_backup = loss_fraction_with_backup;
    cat.curve_loss_fraction_with_backup = loss_fraction_with_backup;
  }
  if (recovery_time_hours !== undefined) {
    cat.recovery_time_hours = recovery_time_hours;
    cat.curve_recovery_time_hours = recovery_time_hours;
  }
  if (primary_provider !== undefined) cat.curve_primary_provider = primary_provider ?? null;
  if (secondary_provider !== undefined) cat.curve_secondary_provider = secondary_provider ?? null;

  return {
    requires_service,
    time_to_impact_hours,
    loss_fraction_no_backup,
    backup_available,
    backup_duration_hours,
    loss_fraction_with_backup,
    recovery_time_hours,
    primary_provider: primary_provider ?? null,
    secondary_provider: secondary_provider ?? null,
  };
}

/**
 * Run curve normalization for all curve-backed categories and optionally sync to infrastructure.curve.
 * Call once before building report VM / sending payload so export uses one source of truth.
 */
export function normalizeCurveInputsForExport(assessment: Assessment): void {
  const categories = assessment.categories as Record<string, Record<string, unknown>> | undefined;
  if (!categories) return;

  for (const code of CURVE_CATEGORIES) {
    const cat = categories[code];
    if (!cat || typeof cat !== 'object') continue;
    normalizeCurveInputs(cat);
  }

  // Ensure infrastructure.curve is populated from normalized category data for reporter
  const infra = assessment.infrastructure as Record<string, { curve?: Record<string, unknown> }> | undefined;
  if (infra) {
    for (const code of CURVE_CATEGORIES) {
      const key =
        code === 'ELECTRIC_POWER'
          ? 'energy'
          : code === 'COMMUNICATIONS'
            ? 'communications'
            : code === 'INFORMATION_TECHNOLOGY'
              ? 'information_technology'
              : code === 'WATER'
                ? 'water'
                : 'wastewater';
      const cat = categories[code];
      if (!cat) continue;
      const curve = infra[key]?.curve ?? {};
      const req = cat.requires_service;
      const tti = cat.time_to_impact_hours ?? cat.curve_time_to_impact_hours;
      const lossNo = cat.loss_fraction_no_backup ?? cat.curve_loss_fraction_no_backup;
      const backupHrs = cat.backup_duration_hours ?? cat.curve_backup_duration_hours;
      const lossWith = cat.loss_fraction_with_backup ?? cat.curve_loss_fraction_with_backup;
      const rec = cat.recovery_time_hours ?? cat.curve_recovery_time_hours;
      if (req !== undefined) (curve as Record<string, unknown>).requires_service = req;
      if (tti !== undefined) (curve as Record<string, unknown>).time_to_impact = tti;
      if (lossNo !== undefined) (curve as Record<string, unknown>).loss_no_backup = lossNo;
      if (backupHrs !== undefined) (curve as Record<string, unknown>).backup_duration = backupHrs;
      if (lossWith !== undefined) (curve as Record<string, unknown>).loss_with_backup = lossWith;
      if (rec !== undefined) (curve as Record<string, unknown>).recovery_time = rec;
      if (!infra[key]) (assessment.infrastructure as Record<string, unknown>)[key] = { curve };
      else infra[key].curve = curve;
    }
  }
}
