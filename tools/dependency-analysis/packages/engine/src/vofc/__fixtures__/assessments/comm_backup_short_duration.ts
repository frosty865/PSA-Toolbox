/**
 * COMMUNICATIONS: has_backup true, backup_duration 4, loss_fraction_with_backup 0.4.
 * Expected: COM-01 matched, may escalate (BACKUP_BANDS yields MODERATE for <8h).
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const commBackupShortDuration: Assessment = assessment({
  categories: {
    COMMUNICATIONS: {
      requires_service: true,
      time_to_impact_hours: 12,
      loss_fraction_no_backup: 0.2,
      has_backup: true,
      backup_duration_hours: 4,
      loss_fraction_with_backup: 0.4,
      recovery_time_hours: 24,
    },
  },
});
