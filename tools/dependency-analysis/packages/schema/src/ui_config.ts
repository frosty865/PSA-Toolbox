import type { CategoryCode } from './assessment';

/** Required source of the label (workbook sheet + cell). */
export interface UILabelSource {
  sheet: string;
  cell: string;
}

/** Optional source of help text (workbook sheet + cell). */
export interface UIHelpSource {
  sheet: string;
  cell: string;
}

/**
 * Single field in the UI. Workbook is source-of-truth for labels.
 * - label + label_source are REQUIRED (from XLSM).
 * - help + help_source are optional.
 */
export interface UIFieldConfig {
  key: string;
  /** Question label; MUST come from UI_CONFIG (workbook). */
  label: string;
  /** Where this label was read from (sheet + cell address). */
  label_source: UILabelSource;
  help: string | null;
  /** Where help was read from, if any. */
  help_source?: UIHelpSource | null;
  /** Optional examples (max 3). Not stored with assessment data. */
  examples?: string[];
  type: 'boolean' | 'number' | 'text' | 'select';
  min?: number;
  max?: number;
  step?: number;
  /** Unit label from workbook (e.g. "Hours", "%"). */
  unit?: 'Hours' | '%' | null;
  /** When "percent", UI shows 0–100 and converts to/from stored fraction (0–1). Set only by extractor for loss_fraction fields. */
  displayAs?: 'fraction' | 'percent' | null;
  defaultValue: unknown;
}

/** Table column config for Critical Products (workbook column header + type). */
export interface UICategoryTableColumn {
  key: string;
  label: string;
  label_source: UILabelSource;
  type: 'text' | 'boolean';
}

/**
 * Table-driven category (e.g. Critical Products). When present, category is rendered as a grid.
 */
export interface UICategoryTableConfig {
  columns: UICategoryTableColumn[];
  maxRows: number;
}

/**
 * Category section: title, description, and ordered list of fields (or table for CP).
 */
export interface UICategoryConfig {
  category: CategoryCode;
  title: string;
  description: string | null;
  fields: UIFieldConfig[];
  /** When set, category is table-driven (e.g. Critical Products). No curve. */
  table?: UICategoryTableConfig | null;
}

/**
 * Full UI configuration. Populated by ui_config.generated.ts from XLSM extraction.
 */
export type UI_CONFIG = UICategoryConfig[];
