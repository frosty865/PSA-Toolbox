/**
 * ELECTRIC_POWER: conditions match EP-01, EP-02, EP-03, plus EP-04, EP-05 (from MINIMAL + EP_EXTRA_FOR_CAP).
 * Expected: Exactly 4 returned for ELECTRIC_POWER after sort (calibrated severity, applicability, id).
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const capFourPerCategory: Assessment = assessment({
  categories: {
    ELECTRIC_POWER: {
      requires_service: true,
      time_to_impact_hours: 2,
      loss_fraction_no_backup: 0.6,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 48,
    },
  },
});
