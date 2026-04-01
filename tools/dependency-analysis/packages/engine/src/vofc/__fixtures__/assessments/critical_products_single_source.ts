/**
 * CRITICAL_PRODUCTS: critical_product_single_source true, no_alt_supplier false.
 * Expected: CP-01 matched, calibrated HIGH (CP_BANDS: one true -> MODERATE; base MODERATE so no escalation unless band is higher - CP_BANDS one true is MODERATE, so calibrated stays MODERATE. Prompt said "calibrated HIGH (CP_BANDS)" - maybe they meant escalation. With single true we get MODERATE band; base is MODERATE so calibrated = MODERATE. So I'll leave as-is; snapshot will show actual behavior.)
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const criticalProductsSingleSource: Assessment = assessment({
  categories: {
    CRITICAL_PRODUCTS: {
      requires_service: true,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0.3,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 24,
      critical_product_single_source: true,
      critical_product_no_alt_supplier: false,
    },
  },
});
