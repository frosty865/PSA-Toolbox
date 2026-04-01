/**
 * One-time (or re-run after workbook changes) extraction of UI field config from XLSM.
 * Reads Asset Dependency Visualization.xlsm and emits packages/schema/src/ui_config.generated.ts.
 * All categories are driven by XLSM_CELL_MAP (curve) or XLSM_CRITICAL_PRODUCTS_TABLE (table). Fail hard if mapped cells missing.
 */
import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';
import { QUESTION_CELL_MAP } from './xlsm_question_map';
import { XLSM_CELL_MAP, XLSM_CRITICAL_PRODUCTS_TABLE } from './xlsm_cell_map';

const ROOT = path.resolve(__dirname, '..');
const XLSM_PATH = path.join(ROOT, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
const OUT_PATH = path.join(ROOT, 'packages', 'schema', 'src', 'ui_config.generated.ts');

const SHEET_TO_CATEGORY: Record<string, { code: string; title: string }> = {
  'Electric Power': { code: 'ELECTRIC_POWER', title: 'Electric Power' },
  'Communication': { code: 'COMMUNICATIONS', title: 'Communications' },
  'Information Technology': { code: 'INFORMATION_TECHNOLOGY', title: 'Information Technology' },
  'Water': { code: 'WATER', title: 'Water' },
  'Wastewater': { code: 'WASTEWATER', title: 'Wastewater' },
  'Critical Products': { code: 'CRITICAL_PRODUCTS', title: 'Critical Products' },
};

/** Field metadata for all curve categories (used when building from XLSM_CELL_MAP). */
const CURVE_FIELD_META: Record<string, { type: 'boolean' | 'number' | 'text'; min?: number; max?: number; step?: number }> = {
  requires_service: { type: 'boolean' },
  time_to_impact_hours: { type: 'number', min: 0, max: 72, step: 1 },
  loss_fraction_no_backup: { type: 'number', min: 0, max: 1, step: 0.01 },
  has_backup_any: { type: 'boolean' },
  has_backup_generator: { type: 'boolean' },
  backup_duration_hours: { type: 'number', min: 0, max: 96, step: 1 },
  loss_fraction_with_backup: { type: 'number', min: 0, max: 1, step: 0.01 },
  recovery_time_hours: { type: 'number', min: 0, max: 168, step: 1 },
};

const CATEGORY_FIELDS: Record<string, Array<{ key: string; type: 'boolean' | 'number' | 'text'; min?: number; max?: number; step?: number; default: unknown }>> = {
  COMMUNICATIONS: [
    { key: 'requires_service', type: 'boolean', default: false },
    { key: 'time_to_impact_hours', type: 'number', min: 0, max: 72, step: 1, default: 0 },
    { key: 'loss_fraction_no_backup', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'has_backup', type: 'boolean', default: false },
    { key: 'backup_duration_hours', type: 'number', min: 0, max: 96, step: 1, default: null },
    { key: 'loss_fraction_with_backup', type: 'number', min: 0, max: 1, step: 0.01, default: null },
    { key: 'recovery_time_hours', type: 'number', min: 0, max: 168, step: 1, default: 0 },
  ],
  INFORMATION_TECHNOLOGY: [
    { key: 'requires_service', type: 'boolean', default: false },
    { key: 'time_to_impact_hours', type: 'number', min: 0, max: 72, step: 1, default: 0 },
    { key: 'loss_fraction_no_backup', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'has_backup', type: 'boolean', default: false },
    { key: 'backup_duration_hours', type: 'number', min: 0, max: 96, step: 1, default: null },
    { key: 'loss_fraction_with_backup', type: 'number', min: 0, max: 1, step: 0.01, default: null },
    { key: 'recovery_time_hours', type: 'number', min: 0, max: 168, step: 1, default: 0 },
  ],
  WATER: [
    { key: 'requires_service', type: 'boolean', default: false },
    { key: 'time_to_impact_hours', type: 'number', min: 0, max: 72, step: 1, default: 0 },
    { key: 'loss_fraction_no_backup', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'has_backup', type: 'boolean', default: false },
    { key: 'backup_duration_hours', type: 'number', min: 0, max: 96, step: 1, default: null },
    { key: 'loss_fraction_with_backup', type: 'number', min: 0, max: 1, step: 0.01, default: null },
    { key: 'recovery_time_hours', type: 'number', min: 0, max: 168, step: 1, default: 0 },
  ],
  WASTEWATER: [
    { key: 'requires_service', type: 'boolean', default: false },
    { key: 'time_to_impact_hours', type: 'number', min: 0, max: 72, step: 1, default: 0 },
    { key: 'loss_fraction_no_backup', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'has_backup', type: 'boolean', default: false },
    { key: 'backup_duration_hours', type: 'number', min: 0, max: 96, step: 1, default: null },
    { key: 'loss_fraction_with_backup', type: 'number', min: 0, max: 1, step: 0.01, default: null },
    { key: 'recovery_time_hours', type: 'number', min: 0, max: 168, step: 1, default: 0 },
  ],
  CRITICAL_PRODUCTS: [
    { key: 'requires_service', type: 'boolean', default: false },
    { key: 'time_to_impact_hours', type: 'number', min: 0, max: 72, step: 1, default: 0 },
    { key: 'loss_fraction_no_backup', type: 'number', min: 0, max: 1, step: 0.01, default: 0 },
    { key: 'has_backup', type: 'boolean', default: false },
    { key: 'backup_duration_hours', type: 'number', min: 0, max: 96, step: 1, default: null },
    { key: 'loss_fraction_with_backup', type: 'number', min: 0, max: 1, step: 0.01, default: null },
    { key: 'recovery_time_hours', type: 'number', min: 0, max: 168, step: 1, default: 0 },
    { key: 'critical_product_single_source', type: 'boolean', default: false },
    { key: 'critical_product_no_alt_supplier', type: 'boolean', default: false },
  ],
};

/** Curve field keys used by Comms/IT questionnaire sections; flat key → curve key (has_backup → curve_backup_available). */
const CURVE_FIELD_MAPPINGS: Array<{ flat: string; curve: string; type: 'boolean' | 'number' | 'text' }> = [
  { flat: 'requires_service', curve: 'curve_requires_service', type: 'boolean' },
  { flat: 'time_to_impact_hours', curve: 'curve_time_to_impact_hours', type: 'number' },
  { flat: 'loss_fraction_no_backup', curve: 'curve_loss_fraction_no_backup', type: 'number' },
  { flat: 'has_backup', curve: 'curve_backup_available', type: 'text' },
  { flat: 'backup_duration_hours', curve: 'curve_backup_duration_hours', type: 'number' },
  { flat: 'loss_fraction_with_backup', curve: 'curve_loss_fraction_with_backup', type: 'number' },
  { flat: 'recovery_time_hours', curve: 'curve_recovery_time_hours', type: 'number' },
];

/** Min/max/step for curve_* number fields (Comms/IT). */
const CURVE_NUMBER_META: Record<string, { min: number; max: number; step: number }> = {
  curve_time_to_impact_hours: { min: 0, max: 72, step: 1 },
  curve_loss_fraction_no_backup: { min: 0, max: 1, step: 0.01 },
  curve_backup_duration_hours: { min: 0, max: 96, step: 1 },
  curve_loss_fraction_with_backup: { min: 0, max: 1, step: 0.01 },
  curve_recovery_time_hours: { min: 0, max: 168, step: 1 },
};

function decodeAddress(cellAddress: string): { r: number; c: number } {
  const match = cellAddress.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid cell address: ${cellAddress}`);
  const colStr = match[1].toUpperCase();
  let c = 0;
  for (let i = 0; i < colStr.length; i++) {
    c = c * 26 + (colStr.charCodeAt(i) - 65);
  }
  const r = parseInt(match[2], 10) - 1;
  return { r, c };
}

function getCell(sh: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sh[XLSX.utils.encode_cell({ r, c })];
  if (!cell) return '';
  return (cell.w !== undefined ? String(cell.w) : String(cell.v ?? '')).trim();
}

/** Get raw value (v) for number/boolean parsing; falls back to string. */
function getCellValueRaw(sh: XLSX.WorkSheet, sheetName: string, cellAddress: string): unknown {
  const { r, c } = decodeAddress(cellAddress);
  const cell = sh[XLSX.utils.encode_cell({ r, c })];
  if (!cell) {
    throw new Error(`Missing cell in sheet "${sheetName}" at ${cellAddress}.`);
  }
  const v = cell.v;
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    throw new Error(`Empty cell in sheet "${sheetName}" at ${cellAddress}.`);
  }
  return v;
}

/** Returns true if the label looks like a key (e.g. "requires_service") rather than workbook text. */
function isKeyLikeLabel(label: string, fieldKey: string): boolean {
  const t = String(label).trim();
  return t === fieldKey || /^[a-z0-9_]+$/i.test(t);
}

/** Parse cell address; return trimmed string. Throws if cell missing, empty, or key-like. */
function getCellByAddress(
  sh: XLSX.WorkSheet,
  sheetName: string,
  cellAddress: string,
  fieldKey: string
): string {
  const { r, c } = decodeAddress(cellAddress);
  const raw = getCell(sh, r, c);
  if (raw === '') {
    throw new Error(
      `Empty or missing label cell in sheet "${sheetName}" at ${cellAddress}. Labels must come from the workbook.`
    );
  }
  const trimmed = raw.trim();
  if (isKeyLikeLabel(trimmed, fieldKey)) {
    throw new Error(
      `Invalid label: appears to be a key, not workbook text (${sheetName}.${fieldKey} at ${cellAddress}). Update Asset Dependency Visualization.xlsm with real question text and re-run scripts/extract_xlsm_ui_config.ts.`
    );
  }
  return trimmed;
}

/** Parse default value from answer cell: boolean, number, or null. */
function parseDefaultFromCell(
  sh: XLSX.WorkSheet,
  sheetName: string,
  cellAddress: string,
  fieldKey: string,
  type: 'boolean' | 'number' | 'text'
): unknown {
  try {
    const v = getCellValueRaw(sh, sheetName, cellAddress);
    if (type === 'boolean') {
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      if (s === 'true' || s === 'yes' || s === '1') return true;
      if (s === 'false' || s === 'no' || s === '0' || s === '') return false;
      return false;
    }
    if (type === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
      if (Number.isNaN(n)) return null;
      return n;
    }
    return String(v ?? '').trim() || null;
  } catch {
    throw new Error(
      `Empty or missing answer cell in sheet "${sheetName}" at ${cellAddress} for field "${fieldKey}".`
    );
  }
}

/** Map unit cell text to UIFieldConfig.unit. */
function parseUnitFromCell(sh: XLSX.WorkSheet, sheetName: string, cellAddress: string): 'Hours' | '%' | null {
  const { r, c } = decodeAddress(cellAddress);
  const raw = getCell(sh, r, c);
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes('hour') || s === 'hrs' || s === 'hr') return 'Hours';
  if (s.includes('%') || s === 'percent') return '%';
  return null;
}

/** Per-field help with optional source for traceability. */
interface FieldHelpResult {
  help: string | null;
  source?: { sheet: string; cell?: string };
}

/** Normalize label: trim, internal line breaks → single space. Preserve punctuation and capitalization. */
function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

interface LabelWithSource {
  label: string;
  cell: string;
}

/** Collect label rows from column B with cell ref; help from C or below with cell ref. */
function extractTextsFromSheet(
  sh: XLSX.WorkSheet,
  sheetName: string
): { labels: LabelWithSource[]; helpResults: FieldHelpResult[] } {
  const labels: LabelWithSource[] = [];
  const helpResults: FieldHelpResult[] = [];
  const ref = sh['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  for (let R = 0; R <= range.e.r; R++) {
    const b = getCell(sh, R, 1);
    const c = getCell(sh, R, 2);
    const below = getCell(sh, R + 1, 1);
    if (b && b.length > 0 && b.length < 120 && !b.startsWith('FOR OFFICAL')) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: 1 });
      labels.push({ label: normalizeLabel(b), cell: cellRef });
      let helpText: string | null = null;
      let helpCell: string | undefined;
      if (c && c.length > 15) {
        helpText = normalizeLabel(c);
        helpCell = XLSX.utils.encode_cell({ r: R, c: 2 });
      } else if (below && below.length > 20 && (below.toLowerCase().includes('note') || below.includes('.'))) {
        helpText = normalizeLabel(below);
        helpCell = XLSX.utils.encode_cell({ r: R + 1, c: 1 });
      }
      helpResults.push(
        helpText && helpCell
          ? { help: helpText, source: { sheet: sheetName, cell: helpCell } }
          : { help: null }
      );
    }
  }
  return { labels, helpResults };
}

function escapeStr(s: string): string {
  return JSON.stringify(s);
}

function formatDefault(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

/**
 * Build UI_CONFIG content from a workbook (for writing to file or comparing).
 * Exported for scripts/check_generated_integrity.ts.
 */
export function generateUiConfigFileContent(wb: XLSX.WorkBook): string {
  const categories = buildCategories(wb);
  const header = `/**
 * AUTO-GENERATED FILE. DO NOT EDIT. Run scripts/extract_xlsm_ui_config.ts
 * Source: Asset Dependency Visualization.xlsm
 */
import type { UICategoryConfig } from './ui_config';

export const UI_CONFIG: UICategoryConfig[] = [
`;
  return header + formatCategories(categories) + `];
`;
}

function buildCategories(
  wb: XLSX.WorkBook
): Array<{
  category: string;
  title: string;
  description: string | null;
  fields: Array<{
    key: string;
    label: string;
    label_source: { sheet: string; cell: string };
    help: string | null;
    help_source?: { sheet: string; cell: string } | null;
    examples?: string[];
    type: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: 'Hours' | '%' | null;
    defaultValue: string;
  }>;
}> {
  const categories: Array<{
    category: string;
    title: string;
    description: string | null;
    fields: Array<{
      key: string;
      label: string;
      label_source: { sheet: string; cell: string };
      help: string | null;
      help_source?: { sheet: string; cell: string } | null;
      examples?: string[];
      type: string;
      min?: number;
      max?: number;
      step?: number;
      unit?: 'Hours' | '%' | null;
      defaultValue: string;
    }>;
  }> = [];

  for (const [sheetName, { code, title }] of Object.entries(SHEET_TO_CATEGORY)) {
    const sh = wb.Sheets[sheetName];
    if (!sh) {
      throw new Error(`Sheet "${sheetName}" not found in workbook.`);
    }

    if (code === 'CRITICAL_PRODUCTS') {
      const tbl = XLSM_CRITICAL_PRODUCTS_TABLE;
      const tblSh = wb.Sheets[tbl.sheet];
      if (!tblSh) throw new Error(`Sheet "${tbl.sheet}" not found for CRITICAL_PRODUCTS.`);
      const columns = tbl.columns.map((col) => {
        const { r, c } = decodeAddress(col.headerCell);
        const raw = getCell(tblSh, r, c);
        if (raw === '' || !raw.trim()) {
          throw new Error(
            `Empty label cell at ${tbl.sheet} ${col.headerCell} for ${col.key}. Labels must come from the workbook — add header text and re-run.`
          );
        }
        const label = raw.trim();
        return {
          key: col.key,
          label,
          label_source: { sheet: tbl.sheet, cell: col.headerCell },
          type: col.type,
        };
      });
      categories.push({
        category: code,
        title,
        description: null,
        fields: [],
        table: { columns, maxRows: tbl.maxRows },
      });
      continue;
    }

    const cellMapEp = XLSM_CELL_MAP[code];
    if (cellMapEp) {
      const qKeys = Object.keys(cellMapEp.q);
      const fields = qKeys.map((key) => {
        const qCell = cellMapEp.q[key];
        if (!qCell) throw new Error(`XLSM_CELL_MAP["${code}"].q missing key "${key}".`);
        const aCell = cellMapEp.a[key];
        if (!aCell) throw new Error(`XLSM_CELL_MAP["${code}"].a missing key "${key}".`);
        const meta = CURVE_FIELD_META[key];
        if (!meta) throw new Error(`CURVE_FIELD_META missing "${key}".`);
        const label = getCellByAddress(wb.Sheets[qCell.sheet], qCell.sheet, qCell.cell, key);
        const defaultValue = parseDefaultFromCell(
          wb.Sheets[aCell.sheet],
          aCell.sheet,
          aCell.cell,
          key,
          meta.type
        );
        let unit: 'Hours' | '%' | null = null;
        if (cellMapEp.u && cellMapEp.u[key]) {
          const uCell = cellMapEp.u[key];
          unit = parseUnitFromCell(wb.Sheets[uCell.sheet], uCell.sheet, uCell.cell);
        }
        const displayAs = (key === 'loss_fraction_no_backup' || key === 'loss_fraction_with_backup') ? 'percent' as const : undefined;
        return {
          key,
          label: label.trim(),
          label_source: { sheet: qCell.sheet, cell: qCell.cell },
          help: null,
          help_source: null as { sheet: string; cell: string } | null,
          type: meta.type,
          min: meta.min,
          max: meta.max,
          step: meta.step,
          unit,
          displayAs,
          defaultValue: formatDefault(defaultValue),
        };
      });
      categories.push({
        category: code,
        title,
        description: null,
        fields,
      });
      continue;
    }

    const cellMap = QUESTION_CELL_MAP[code];
    if (!cellMap) {
      throw new Error(
        `Category "${code}" has no XLSM_CELL_MAP or QUESTION_CELL_MAP entry. Add it to scripts.`
      );
    }
    const fieldDefs = CATEGORY_FIELDS[code];
    const paddedLabels: LabelWithSource[] = [];
    for (const def of fieldDefs) {
      const cell = cellMap[def.key];
      if (!cell) {
        throw new Error(
          `QUESTION_CELL_MAP["${code}"] is missing cell for field "${def.key}". Update scripts/xlsm_question_map.ts.`
        );
      }
      const { r, c } = decodeAddress(cell);
      const raw = getCell(sh, r, c);
      if (raw === '' || !raw.trim()) {
        throw new Error(
          `Empty label cell in sheet "${sheetName}" at ${cell} for field "${def.key}". Labels must come from the workbook — add question text to the mapped cell and re-run.`
        );
      }
      const trimmed = raw.trim();
      if (isKeyLikeLabel(trimmed, def.key)) {
        throw new Error(
          `Invalid label: appears to be a key, not workbook text (${sheetName}.${def.key} at ${cell}). Update Asset Dependency Visualization.xlsm with real question text and re-run scripts/extract_xlsm_ui_config.ts.`
        );
      }
      paddedLabels.push({ label: trimmed, cell });
    }
    const { helpResults } = extractTextsFromSheet(sh, sheetName);
    const helpForIndex = (i: number): FieldHelpResult => helpResults[i] ?? { help: null };
    const baseFields = fieldDefs.map((def, i) => {
      const { label, cell: labelCell } = paddedLabels[i];
      const { help, source: helpSource } = helpForIndex(i);
      const displayAs = (def.key === 'loss_fraction_no_backup' || def.key === 'loss_fraction_with_backup') ? 'percent' as const : undefined;
      return {
        key: def.key,
        label,
        label_source: { sheet: sheetName, cell: labelCell },
        help,
        help_source: helpSource ? { sheet: helpSource.sheet, cell: helpSource.cell ?? '' } : null,
        type: def.type,
        min: def.min,
        max: def.max,
        step: def.step,
        unit: undefined as 'Hours' | '%' | null | undefined,
        displayAs,
        defaultValue: formatDefault(def.default),
      };
    });
    let fields: typeof baseFields = baseFields;
    // COMMUNICATIONS and INFORMATION_TECHNOLOGY: expose only curve_* keys (no flat duplicates).
    if (code === 'COMMUNICATIONS' || code === 'INFORMATION_TECHNOLOGY') {
      const curveFields = CURVE_FIELD_MAPPINGS.map((m) => {
        const flat = baseFields.find((f) => f.key === m.flat);
        if (!flat) throw new Error(`CURVE_FIELD_MAPPINGS: flat key "${m.flat}" not found in baseFields for ${code}.`);
        const displayAs = (m.curve === 'curve_loss_fraction_no_backup' || m.curve === 'curve_loss_fraction_with_backup') ? 'percent' as const : undefined;
        const numMeta = m.type === 'number' ? CURVE_NUMBER_META[m.curve] : undefined;
        const unit: 'Hours' | '%' | null | undefined =
          numMeta && (m.curve.includes('hours') || m.curve === 'curve_backup_duration_hours') ? 'Hours' : (displayAs ? '%' : undefined);
        return {
          key: m.curve,
          label: flat.label,
          label_source: flat.label_source,
          help: flat.help,
          help_source: flat.help_source ?? null,
          type: m.type,
          min: numMeta?.min,
          max: numMeta?.max,
          step: numMeta?.step,
          unit,
          displayAs,
          defaultValue: formatDefault(null),
        };
      });
      fields = curveFields;
    }
    categories.push({
      category: code,
      title,
      description: null,
      fields,
    });
  }
  return categories;
}

function main() {
  if (!fs.existsSync(XLSM_PATH)) {
    console.error('XLSM not found:', XLSM_PATH);
    process.exit(1);
  }
  const wb = XLSX.readFile(XLSM_PATH, { cellStyles: false });
  const out = generateUiConfigFileContent(wb);
  fs.writeFileSync(OUT_PATH, out, 'utf-8');
  console.log('Wrote', OUT_PATH);
}

function formatCategories(
  categories: Array<{
    category: string;
    title: string;
    description: string | null;
    fields: Array<{
      key: string;
      label: string;
      label_source: { sheet: string; cell: string };
      help: string | null;
      help_source?: { sheet: string; cell: string } | null;
      examples?: string[];
      type: string;
      min?: number;
      max?: number;
      step?: number;
      unit?: 'Hours' | '%' | null;
      displayAs?: 'percent' | 'fraction';
      defaultValue: string;
    }>;
    table?: {
      columns: Array<{ key: string; label: string; label_source: { sheet: string; cell: string }; type: string }>;
      maxRows: number;
    };
  }>
): string {
  const lines: string[] = [];
  for (const cat of categories) {
    lines.push(`  {`);
    lines.push(`    category: ${escapeStr(cat.category)},`);
    lines.push(`    title: ${escapeStr(cat.title)},`);
    lines.push(`    description: ${cat.description != null ? escapeStr(cat.description) : 'null'},`);
    lines.push(`    fields: [`);
    for (const f of cat.fields) {
      const parts = [
        `key: ${escapeStr(f.key)}`,
        `label: ${escapeStr(f.label)}`,
        `label_source: { sheet: ${escapeStr(f.label_source.sheet)}, cell: ${escapeStr(f.label_source.cell)} }`,
        `help: ${f.help != null ? escapeStr(f.help) : 'null'}`,
        `type: '${f.type}'`,
      ];
      if (f.help_source != null)
        parts.push(`help_source: { sheet: ${escapeStr(f.help_source.sheet)}, cell: ${escapeStr(f.help_source.cell)} }`);
      if (f.examples && f.examples.length > 0)
        parts.push(`examples: [${f.examples.slice(0, 3).map(escapeStr).join(', ')}]`);
      if (f.min !== undefined) parts.push(`min: ${f.min}`);
      if (f.max !== undefined) parts.push(`max: ${f.max}`);
      if (f.step !== undefined) parts.push(`step: ${f.step}`);
      if (f.unit !== undefined && f.unit != null) parts.push(`unit: '${f.unit}'`);
      if (f.displayAs != null) parts.push(`displayAs: '${f.displayAs}'`);
      parts.push(`defaultValue: ${f.defaultValue}`);
      lines.push(`      { ${parts.join(', ')} },`);
    }
    lines.push(`    ],`);
    if (cat.table) {
      lines.push(`    table: {`);
      lines.push(`      columns: [`);
      for (const col of cat.table.columns) {
        lines.push(`        { key: ${escapeStr(col.key)}, label: ${escapeStr(col.label)}, label_source: { sheet: ${escapeStr(col.label_source.sheet)}, cell: ${escapeStr(col.label_source.cell)} }, type: '${col.type}' },`);
      }
      lines.push(`      ],`);
      lines.push(`      maxRows: ${cat.table.maxRows},`);
      lines.push(`    },`);
    }
    lines.push(`  },`);
  }
  return lines.join('\n');
}

// Only run when this file is the entry point (not when imported by check_generated_integrity)
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
