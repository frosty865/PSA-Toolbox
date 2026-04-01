/**
 * Human-readable calibration explanation. No numeric thresholds.
 */

import type { VOFC, VOFCSeverity } from "schema";

const RANK: Record<VOFCSeverity, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };

/**
 * Returns a short explanation of how severity was calibrated.
 * - Same: "Severity aligns with baseline library classification."
 * - Escalated: "Severity escalated based on operational dependency conditions (impact, time-to-impact, recovery, or backup posture)."
 * - Downgraded: "Severity adjusted downward based on observed operational dependency conditions."
 */
export function explainCalibration(vofc: VOFC): string {
  const base = vofc.base_severity;
  const cal = vofc.calibrated_severity;
  if (base === cal) {
    return "Severity aligns with baseline library classification.";
  }
  if (RANK[cal] > RANK[base]) {
    return "Severity escalated based on operational dependency conditions (impact, time-to-impact, recovery, or backup posture).";
  }
  return "Severity adjusted downward based on observed operational dependency conditions.";
}
