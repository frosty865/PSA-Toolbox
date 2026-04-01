/**
 * ELECTRIC_POWER: requires_service true, has_backup false, time_to_impact 2h,
 * loss_fraction_no_backup 0.6, recovery 48h.
 * Expected: EP-01 (CONFIRMED) base MODERATE -> calibrated HIGH;
 *           EP-02 (CONFIRMED) base HIGH -> calibrated HIGH;
 *           EP-03 (CONFIRMED) base MODERATE -> calibrated HIGH.
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const epNoBackupShortTtiHighLoss: Assessment = assessment({
  categories: {
    ELECTRIC_POWER: {
      requires_service: true,
      time_to_impact_hours: 2,
      loss_fraction_no_backup: 0.6,
      has_backup_any: false,
      has_backup_generator: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 48,
    },
  },
});
