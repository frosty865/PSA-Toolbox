#!/usr/bin/env npx tsx
/**
 * Export dependency_vofc_local.json to DEPENDENCY_VOFC_LOCAL sheet.
 * Creates data/DEPENDENCY_VOFC_LOCAL.xlsx (local workbook file) for import into
 * Asset Dependency Visualization.xlsm or use as seed source.
 *
 * Sheet format (Row 1 headers): condition_code | infrastructure | vulnerability | ofc_1 | ofc_2 | ofc_3 | ofc_4 | source_type | source_reference | approved | version
 *
 * Run: pnpm exec tsx scripts/export_dependency_vofc_to_sheet.ts
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import XLSX from 'xlsx';

const REPO_ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(REPO_ROOT, 'data', 'dependency_vofc_local.json');
const OUT_PATH = path.join(REPO_ROOT, 'data', 'DEPENDENCY_VOFC_LOCAL.xlsx');
const SHEET_NAME = 'DEPENDENCY_VOFC_LOCAL';

const HEADERS = [
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

async function main() {
  const buf = await fs.readFile(JSON_PATH, 'utf-8');
  const rows = JSON.parse(buf) as Array<Record<string, unknown>>;

  const sheetRows = rows.map((r) => ({
    condition_code: r.condition_code ?? '',
    infrastructure: r.infrastructure ?? '',
    vulnerability: r.vulnerability_text ?? '',
    ofc_1: r.ofc_1 ?? '',
    ofc_2: r.ofc_2 ?? '',
    ofc_3: r.ofc_3 ?? '',
    ofc_4: r.ofc_4 ?? '',
    source_type: r.source_type ?? 'OTHER',
    source_reference: r.source_reference ?? '',
    approved: r.approved === true ? 'TRUE' : 'FALSE',
    version: r.version ?? 'dep_v1',
  }));

  const sheet = XLSX.utils.json_to_sheet(sheetRows, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, SHEET_NAME);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  XLSX.writeFile(wb, OUT_PATH);

  console.log(`Exported ${sheetRows.length} rows to ${OUT_PATH}`);
  console.log(
    'To add this sheet to Asset Dependency Visualization.xlsm:\n' +
    '  1. Open the workbook and this file in Excel\n' +
    '  2. Copy the DEPENDENCY_VOFC_LOCAL sheet into the main workbook\n' +
    '  3. Save the main workbook\n' +
    '  OR keep data/DEPENDENCY_VOFC_LOCAL.xlsx as a separate file; seed script reads from it.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
