/**
 * Full assessment (all 6 categories) for export smoke tests.
 * Combines conditions from ep_no_backup, water_long, critical_products plus minimal others.
 */
import type { Assessment } from "schema";
import { assessment } from "./base";

export const fullAssessmentForExport: Assessment = assessment({
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
    COMMUNICATIONS: {
      requires_service: true,
      time_to_impact_hours: 12,
      loss_fraction_no_backup: 0.2,
      has_backup: true,
      backup_duration_hours: 4,
      loss_fraction_with_backup: 0.4,
      recovery_time_hours: 24,
    },
    INFORMATION_TECHNOLOGY: {
      requires_service: false,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 0,
    },
    WATER: {
      requires_service: true,
      time_to_impact_hours: 8,
      loss_fraction_no_backup: 0.3,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 96,
    },
    WASTEWATER: {
      requires_service: false,
      time_to_impact_hours: 0,
      loss_fraction_no_backup: 0,
      has_backup: false,
      backup_duration_hours: null,
      loss_fraction_with_backup: null,
      recovery_time_hours: 0,
    },
    CRITICAL_PRODUCTS: {
      critical_products: [
        {
          product_or_service: "Chemical feedstock A",
          dependency_present: true,
          notes: "Single regional supplier",
          single_source: true,
          alternate_supplier_identified: false,
          alternate_supplier_name: null,
          multi_source_currently_used: null,
        },
        {
          product_or_service: "Spare parts",
          dependency_present: false,
          notes: null,
          single_source: null,
          alternate_supplier_identified: null,
          alternate_supplier_name: null,
          multi_source_currently_used: null,
        },
      ],
    },
  },
});
