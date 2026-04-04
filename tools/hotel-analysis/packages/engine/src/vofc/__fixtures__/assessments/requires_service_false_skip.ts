/**
 * ELECTRIC_POWER: requires_service false.
 * Expected: No VOFCs for this category (skip when requires_service=false for non-CP).
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const requiresServiceFalseSkip: Assessment = assessment({
  categories: {
    ELECTRIC_POWER: {
      requires_service: false,
      time_to_impact_hours: 12,
      loss_fraction_no_backup: 0.5,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
    },
  },
});
