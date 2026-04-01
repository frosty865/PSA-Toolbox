/**
 * WATER: recovery_time_hours 96, loss_fraction_no_backup 0.3, time_to_impact 8,
 * has_backup false.
 * Expected: W-01 escalated to HIGH (recovery band).
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const waterLongRecovery: Assessment = assessment({
  categories: {
    WATER: {
      requires_service: true,
      time_to_impact_hours: 8,
      loss_fraction_no_backup: 0.3,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 96,
    },
  },
});
