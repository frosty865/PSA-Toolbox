/**
 * Calibrate VOFC severity from operational impact bands.
 * Escalation when band > base; optional downgrade when env VOFC_ALLOW_DOWNGRADE=1.
 */

import type { Assessment, VOFC, VOFCSeverity } from "schema";
import type { SummaryRow } from "../summary";
import { getOperationalRiskBand } from "./severity_bands";

const RANK: Record<VOFCSeverity, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

const ESCALATION_REASON =
  "Escalated based on operational dependency conditions (impact/time/recovery/backup band).";
const DOWNGRADE_REASON =
  "Adjusted downward based on operational dependency conditions.";

function allowDowngrade(): boolean {
  return process.env.VOFC_ALLOW_DOWNGRADE === "1";
}

/**
 * Returns calibrated severity and optional reason.
 * - If operational_risk_band > base: calibrate up, reason set.
 * - If band < base: by default no downgrade (calibrated = base, reason = null);
 *   if VOFC_ALLOW_DOWNGRADE=1: calibrate down, reason set.
 * - Never above HIGH or below LOW.
 */
export function calibrateSeverity(
  vofc: VOFC,
  assessment: Assessment,
  summary: SummaryRow[]
): { calibrated: VOFCSeverity; reason: string | null } {
  const base = vofc.base_severity;
  const categories = assessment.categories ?? {};
  const input = categories[vofc.category] as
    | {
        requires_service: boolean;
        time_to_impact_hours: number;
        loss_fraction_no_backup: number;
        has_backup: boolean;
        backup_duration_hours: number | null;
        recovery_time_hours: number;
        critical_product_single_source?: boolean;
        critical_product_no_alt_supplier?: boolean;
      }
    | undefined;
  const summaryRow = summary.find((r) => r.category === vofc.category);
  const band = getOperationalRiskBand(vofc.category, summaryRow, input);

  if (RANK[band] > RANK[base]) {
    return { calibrated: band, reason: ESCALATION_REASON };
  }
  if (RANK[band] < RANK[base] && allowDowngrade()) {
    return { calibrated: band, reason: DOWNGRADE_REASON };
  }
  return { calibrated: base, reason: null };
}
