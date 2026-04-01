/**
 * Explicit cell map for workbook UI. Matches the workbook's actual layout.
 * QUESTION (q), ANSWER/INPUT (a), UNIT (u) cells.
 * One authoritative map; fail hard if mapped cells are missing.
 */

export interface SheetCell {
  sheet: string;
  cell: string;
}

export type XLSMCategoryMap = {
  q: Record<string, SheetCell>;
  a: Record<string, SheetCell>;
  u?: Record<string, SheetCell>;
};

/** Critical Products: table-driven UI. Column headers + data range. No curve fields. */
export interface XLSMCriticalProductsTable {
  sheet: string;
  /** Row (1-based) where column headers live. */
  headerRow: number;
  /** Column letter for each field; data starts at headerRow + 1. */
  columns: Array<{ key: string; headerCell: string; dataCol: string; type: 'text' | 'boolean' }>;
  maxRows: number;
}

export const XLSM_CELL_MAP: Record<string, XLSMCategoryMap> = {
  ELECTRIC_POWER: {
    q: {
      requires_service: { sheet: "Electric Power", cell: "D25" },
      time_to_impact_hours: { sheet: "Electric Power", cell: "D28" },
      loss_fraction_no_backup: { sheet: "Electric Power", cell: "D32" },
      has_backup_any: { sheet: "Electric Power", cell: "D39" },
      has_backup_generator: { sheet: "Electric Power", cell: "H43" },
      backup_duration_hours: { sheet: "Electric Power", cell: "H46" },
      loss_fraction_with_backup: { sheet: "Electric Power", cell: "D52" },
      recovery_time_hours: { sheet: "Electric Power", cell: "D58" },
    },
    a: {
      requires_service: { sheet: "Electric Power", cell: "L25" },
      time_to_impact_hours: { sheet: "Electric Power", cell: "L28" },
      loss_fraction_no_backup: { sheet: "Electric Power", cell: "L32" },
      has_backup_any: { sheet: "Electric Power", cell: "L39" },
      has_backup_generator: { sheet: "Electric Power", cell: "L43" },
      backup_duration_hours: { sheet: "Electric Power", cell: "L46" },
      loss_fraction_with_backup: { sheet: "Electric Power", cell: "L52" },
      recovery_time_hours: { sheet: "Electric Power", cell: "L58" },
    },
    u: {
      time_to_impact_hours: { sheet: "Electric Power", cell: "M28" },
      backup_duration_hours: { sheet: "Electric Power", cell: "M46" },
      recovery_time_hours: { sheet: "Electric Power", cell: "M58" },
    },
  },
  // COMMUNICATIONS, INFORMATION_TECHNOLOGY, WATER, WASTEWATER: add q/a/u mappings from workbook when layout is known.
};

/** Critical Products: table only. Update headerCell/dataCol to match workbook. */
export const XLSM_CRITICAL_PRODUCTS_TABLE: XLSMCriticalProductsTable = {
  sheet: "Critical Products",
  headerRow: 5,
  maxRows: 20,
  columns: [
    { key: "product_or_service", headerCell: "B5", dataCol: "B", type: "text" },
    { key: "dependency_present", headerCell: "C5", dataCol: "C", type: "boolean" },
    { key: "notes", headerCell: "D5", dataCol: "D", type: "text" },
    { key: "single_source", headerCell: "E5", dataCol: "E", type: "boolean" },
    { key: "alternate_supplier_identified", headerCell: "F5", dataCol: "F", type: "boolean" },
  ],
};
