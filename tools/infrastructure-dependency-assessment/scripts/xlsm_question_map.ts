/**
 * This map is authoritative. If the workbook changes, update the map.
 * Labels are read ONLY from these cells; the extractor fails if a mapped cell is missing.
 */

/** Used for categories not in XLSM_CELL_MAP. ELECTRIC_POWER is built from XLSM_CELL_MAP only. */
export const QUESTION_CELL_MAP: Record<string, Record<string, string>> = {
  COMMUNICATIONS: {
    requires_service: 'B1',
    time_to_impact_hours: 'B2',
    loss_fraction_no_backup: 'B3',
    has_backup: 'B4',
    backup_duration_hours: 'B5',
    loss_fraction_with_backup: 'B6',
    recovery_time_hours: 'B7',
  },
  INFORMATION_TECHNOLOGY: {
    requires_service: 'B1',
    time_to_impact_hours: 'B2',
    loss_fraction_no_backup: 'B3',
    has_backup: 'B4',
    backup_duration_hours: 'B5',
    loss_fraction_with_backup: 'B6',
    recovery_time_hours: 'B7',
  },
  WATER: {
    requires_service: 'B1',
    time_to_impact_hours: 'B2',
    loss_fraction_no_backup: 'B3',
    has_backup: 'B4',
    backup_duration_hours: 'B5',
    loss_fraction_with_backup: 'B6',
    recovery_time_hours: 'B7',
  },
  WASTEWATER: {
    requires_service: 'B1',
    time_to_impact_hours: 'B2',
    loss_fraction_no_backup: 'B3',
    has_backup: 'B4',
    backup_duration_hours: 'B5',
    loss_fraction_with_backup: 'B6',
    recovery_time_hours: 'B7',
  },
  CRITICAL_PRODUCTS: {
    requires_service: 'B1',
    time_to_impact_hours: 'B2',
    loss_fraction_no_backup: 'B3',
    has_backup: 'B4',
    backup_duration_hours: 'B5',
    loss_fraction_with_backup: 'B6',
    recovery_time_hours: 'B7',
    critical_product_single_source: 'B8',
    critical_product_no_alt_supplier: 'B9',
  },
};
