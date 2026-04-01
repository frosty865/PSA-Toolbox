/**
 * Severity bands doctrine: map operational conditions to HIGH / MODERATE / LOW.
 * Used for calibrated_severity; does not change which VOFCs are selected.
 */

import type { VOFCSeverity } from "schema";
import type { SummaryRow } from "../summary";

type CategoryInput = {
  requires_service: boolean;
  time_to_impact_hours: number;
  loss_fraction_no_backup: number;
  has_backup?: boolean;
  has_backup_any?: boolean;
  backup_duration_hours: number | null;
  recovery_time_hours: number;
  critical_product_single_source?: boolean;
  critical_product_no_alt_supplier?: boolean;
};

const RANK: Record<VOFCSeverity, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

function maxSeverity(a: VOFCSeverity, b: VOFCSeverity): VOFCSeverity {
  return RANK[a] >= RANK[b] ? a : b;
}

/** IMPACT_BANDS: HIGH if capacity <= 50% or loss >= 0.5; MODERATE if capacity <= 75% or loss >= 0.25; else LOW. */
export function getImpactBand(row: { capacity_after_impact_no_backup: number }): VOFCSeverity {
  const cap = row.capacity_after_impact_no_backup;
  if (cap <= 50) return "HIGH";
  if (cap <= 75) return "MODERATE";
  return "LOW";
}

/** TIME_BANDS: HIGH if time_to_impact <= 4h; MODERATE if <= 12h; else LOW. */
export function getTimeBand(input: { time_to_impact_hours: number }): VOFCSeverity {
  const t = input.time_to_impact_hours;
  if (t <= 4) return "HIGH";
  if (t <= 12) return "MODERATE";
  return "LOW";
}

/** RECOVERY_BANDS: HIGH if recovery >= 72h; MODERATE if >= 24h; else LOW. */
export function getRecoveryBand(input: { recovery_time_hours: number }): VOFCSeverity {
  const r = input.recovery_time_hours;
  if (r >= 72) return "HIGH";
  if (r >= 24) return "MODERATE";
  return "LOW";
}

function effectiveHasBackup(input: CategoryInput): boolean {
  if (input.has_backup_any !== undefined) return input.has_backup_any === true;
  return input.has_backup === true;
}

/** BACKUP_BANDS: HIGH if no backup and requires_service; MODERATE if backup but duration < 8h; else LOW. */
export function getBackupBand(input: {
  has_backup?: boolean;
  has_backup_any?: boolean;
  requires_service: boolean;
  backup_duration_hours: number | null;
}): VOFCSeverity {
  const hasBackup = effectiveHasBackup(input as CategoryInput);
  if (hasBackup === false && input.requires_service === true) return "HIGH";
  if (hasBackup === true && input.backup_duration_hours != null && input.backup_duration_hours < 8)
    return "MODERATE";
  return "LOW";
}

/** CP_BANDS: HIGH if both single-source and no-alt; MODERATE if only one true; else LOW. */
export function getCPBand(input: {
  critical_product_single_source?: boolean;
  critical_product_no_alt_supplier?: boolean;
}): VOFCSeverity {
  const a = input.critical_product_single_source === true;
  const b = input.critical_product_no_alt_supplier === true;
  if (a && b) return "HIGH";
  if (a || b) return "MODERATE";
  return "LOW";
}

/**
 * Operational risk band for a category: MAX of IMPACT, TIME, RECOVERY, BACKUP bands.
 * For CRITICAL_PRODUCTS uses CP_BANDS only.
 */
export function getOperationalRiskBand(
  category: string,
  summaryRow: SummaryRow | undefined,
  categoryInput: CategoryInput | undefined
): VOFCSeverity {
  if (category === "CRITICAL_PRODUCTS") {
    if (!categoryInput) return "LOW";
    return getCPBand(categoryInput);
  }
  if (!summaryRow || !categoryInput) return "LOW";
  const impact = getImpactBand(summaryRow);
  const time = getTimeBand(categoryInput);
  const recovery = getRecoveryBand(categoryInput);
  const backup = getBackupBand(categoryInput);
  let band: VOFCSeverity = "LOW";
  band = maxSeverity(band, impact);
  band = maxSeverity(band, time);
  band = maxSeverity(band, recovery);
  band = maxSeverity(band, backup);
  return band;
}
