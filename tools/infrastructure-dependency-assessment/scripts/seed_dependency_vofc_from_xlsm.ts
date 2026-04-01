#!/usr/bin/env npx tsx
/**
 * Seed dependency_vofc_local.json from DEPENDENCY_VOFC_LOCAL sheet (single source of truth).
 * Reads from: Asset Dependency Visualization.xlsm (sheet DEPENDENCY_VOFC_LOCAL)
 *         OR: data/DEPENDENCY_VOFC_LOCAL.xlsx (local workbook file)
 *         OR: --from-json to use existing JSON as source (migration/fallback)
 *
 * Enforces: 1 row per condition_code (unique), required fields, forbidden verbs, blocked keywords.
 * Run from asset-dependency-tool: pnpm exec tsx scripts/seed_dependency_vofc_from_xlsm.ts
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import XLSX from 'xlsx';
import {
  hasForbiddenVerb,
  hasBlockedKeyword,
  validateDependencyRow,
  type DependencyVofcRowInput,
} from '../apps/web/app/lib/vofc/vofc_guards';
import { INFRA_ORDER } from '../apps/web/app/lib/dependencies/condition_codes';

const REPO_ROOT = path.resolve(__dirname, '..');
const XLSM_PATH = path.join(REPO_ROOT, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
const LOCAL_XLSX_PATH = path.join(REPO_ROOT, 'data', 'DEPENDENCY_VOFC_LOCAL.xlsx');
const JSON_PATH = path.join(REPO_ROOT, 'data', 'dependency_vofc_local.json');
const SHEET_NAME = 'DEPENDENCY_VOFC_LOCAL';

const EXPECTED_HEADERS = [
  'condition_code',
  'infrastructure',
  'vulnerability',
  'ofc_1',
  'ofc_2',
  'ofc_3',
  'ofc_4',
  'source_type',
  'source_reference',
  'approved',
  'version',
];

const VALID_INFRA = new Set(INFRA_ORDER);
const VALID_SOURCE = new Set(['VOFC_XLS', 'CISA_GUIDE', 'NIST', 'OTHER']);

interface ParsedRow {
  condition_code: string;
  infrastructure: string;
  vulnerability_text: string;
  ofc_1?: string;
  ofc_2?: string;
  ofc_3?: string;
  ofc_4?: string;
  source_type: string;
  source_reference: string;
  approved: boolean;
  version: string;
}

function parseSheetRow(row: Record<string, unknown>, rowIndex: number): { row: ParsedRow; errors: string[] } {
  const errors: string[] = [];
  const get = (k: string): string => {
    const v = row[k];
    if (v == null) return '';
    return String(v).trim();
  };

  const condition_code = get('condition_code');
  const infrastructure = get('infrastructure');
  const vulnerability = get('vulnerability');
  const source_type = get('source_type') || 'OTHER';
  const source_reference = get('source_reference') || '';
  const approvedRaw = get('approved').toLowerCase();
  const approved = approvedRaw === 'true' || approvedRaw === 'yes' || approvedRaw === '1';
  const version = get('version') || 'dep_v1';

  if (!condition_code) errors.push(`Row ${rowIndex + 2}: condition_code is required`);
  if (!vulnerability) errors.push(`Row ${rowIndex + 2}: vulnerability is required`);
  if (!infrastructure) errors.push(`Row ${rowIndex + 2}: infrastructure is required`);
  if (!source_reference) errors.push(`Row ${rowIndex + 2}: source_reference is required`);

  if (infrastructure && !VALID_INFRA.has(infrastructure)) {
    errors.push(`Row ${rowIndex + 2}: infrastructure must be one of ${[...VALID_INFRA].join(', ')}`);
  }
  if (source_type && !VALID_SOURCE.has(source_type)) {
    errors.push(`Row ${rowIndex + 2}: source_type must be one of ${[...VALID_SOURCE].join(', ')}`);
  }

  const ofc_1 = get('ofc_1');
  const ofc_2 = get('ofc_2');
  const ofc_3 = get('ofc_3');
  const ofc_4 = get('ofc_4');
  const ofcs = [ofc_1, ofc_2, ofc_3, ofc_4].filter((o) => o.length > 0);
  if (ofcs.length > 4) errors.push(`Row ${rowIndex + 2}: max 4 OFCs allowed`);

  const parsed: ParsedRow = {
    condition_code,
    infrastructure,
    vulnerability_text: vulnerability,
    ofc_1: ofc_1 || undefined,
    ofc_2: ofc_2 || undefined,
    ofc_3: ofc_3 || undefined,
    ofc_4: ofc_4 || undefined,
    source_type,
    source_reference,
    approved,
    version,
  };

  const validation = validateDependencyRow({
    condition_code,
    infrastructure,
    vulnerability_text: vulnerability,
    ofc_1, ofc_2, ofc_3, ofc_4,
  } as DependencyVofcRowInput);
  if (!validation.ok) errors.push(...validation.errors.map((e) => `Row ${rowIndex + 2}: ${e}`));

  if (vulnerability && hasBlockedKeyword(vulnerability)) {
    errors.push(`Row ${rowIndex + 2}: vulnerability contains blocked keyword`);
  }

  return { row: parsed, errors };
}

function sheetToRows(workbook: XLSX.WorkBook): ParsedRow[] {
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) return [];

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const rows: ParsedRow[] = [];
  const allErrors: string[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const condition_code = String(r['condition_code'] ?? '').trim();
    if (!condition_code) continue; // skip empty rows

    if (seenCodes.has(condition_code)) {
      allErrors.push(`Duplicate condition_code: ${condition_code} (row ${i + 2})`);
    }
    seenCodes.add(condition_code);

    const { row, errors } = parseSheetRow(r, i);
    allErrors.push(...errors);
    rows.push(row);
  }

  if (allErrors.length > 0) {
    throw new Error(`Validation failed:\n${allErrors.join('\n')}`);
  }

  return rows;
}

async function loadFromXlsm(): Promise<XLSX.WorkBook | null> {
  try {
    const buf = await fs.readFile(XLSM_PATH);
    return XLSX.read(buf, { type: 'buffer', bookVBA: true });
  } catch {
    return null;
  }
}

async function loadFromLocalXlsx(): Promise<XLSX.WorkBook | null> {
  try {
    const buf = await fs.readFile(LOCAL_XLSX_PATH);
    return XLSX.read(buf, { type: 'buffer' });
  } catch {
    return null;
  }
}

async function loadFromJson(): Promise<ParsedRow[]> {
  const buf = await fs.readFile(JSON_PATH, 'utf-8');
  const arr = JSON.parse(buf) as Array<Record<string, unknown>>;
  return arr.map((r) => ({
    condition_code: String(r.condition_code ?? ''),
    infrastructure: String(r.infrastructure ?? ''),
    vulnerability_text: String(r.vulnerability_text ?? ''),
    ofc_1: r.ofc_1 ? String(r.ofc_1) : undefined,
    ofc_2: r.ofc_2 ? String(r.ofc_2) : undefined,
    ofc_3: r.ofc_3 ? String(r.ofc_3) : undefined,
    ofc_4: r.ofc_4 ? String(r.ofc_4) : undefined,
    source_type: String(r.source_type ?? 'OTHER'),
    source_reference: String(r.source_reference ?? ''),
    approved: Boolean(r.approved),
    version: String(r.version ?? 'dep_v1'),
  }));
}

function toJsonRow(row: ParsedRow, index: number): Record<string, unknown> {
  return {
    id: `dep-${row.condition_code.toLowerCase().replace(/_/g, '-')}`,
    condition_code: row.condition_code,
    infrastructure: row.infrastructure,
    vulnerability_text: row.vulnerability_text,
    ofc_1: row.ofc_1,
    ofc_2: row.ofc_2,
    ofc_3: row.ofc_3,
    ofc_4: row.ofc_4,
    source_type: row.source_type,
    source_reference: row.source_reference,
    approved: row.approved,
    version: row.version,
  };
}

async function main() {
  const useJson = process.argv.includes('--from-json');

  let rows: ParsedRow[];

  if (useJson) {
    console.log('Using --from-json: reading from existing dependency_vofc_local.json');
    rows = await loadFromJson();
  } else {
    let wb = await loadFromXlsm();
    if (wb?.SheetNames?.includes(SHEET_NAME)) {
      console.log(`Reading sheet "${SHEET_NAME}" from Asset Dependency Visualization.xlsm`);
      rows = sheetToRows(wb);
    } else {
      wb = await loadFromLocalXlsx();
      if (wb?.SheetNames?.includes(SHEET_NAME)) {
        console.log(`Reading sheet "${SHEET_NAME}" from data/DEPENDENCY_VOFC_LOCAL.xlsx`);
        rows = sheetToRows(wb);
      } else {
        console.error(
          `Sheet "${SHEET_NAME}" not found.\n` +
          `  - Add it to assets/workbooks/Asset Dependency Visualization.xlsm, OR\n` +
          `  - Create data/DEPENDENCY_VOFC_LOCAL.xlsx with that sheet, OR\n` +
          `  - Run with --from-json to use existing dependency_vofc_local.json\n\n` +
          `To create the sheet: pnpm exec tsx scripts/export_dependency_vofc_to_sheet.ts`
        );
        process.exit(1);
      }
    }
  }

  const jsonRows = rows.map((r, i) => toJsonRow(r, i));
  await fs.mkdir(path.dirname(JSON_PATH), { recursive: true });
  await fs.writeFile(JSON_PATH, JSON.stringify(jsonRows, null, 2), 'utf-8');
  console.log(`Seeded ${jsonRows.length} rows to ${JSON_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
