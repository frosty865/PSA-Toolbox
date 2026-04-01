#!/usr/bin/env npx tsx
/**
 * Add DEPENDENCY_VOFC_LOCAL sheet to Asset Dependency Visualization.xlsm.
 * Reads from data/DEPENDENCY_VOFC_LOCAL.xlsx and merges the sheet into the main workbook.
 * Writes to assets/workbooks/Asset Dependency Visualization.xlsm (backup created as *.backup.xlsm).
 *
 * Run: pnpm exec tsx scripts/add_dependency_vofc_sheet_to_workbook.ts
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import XLSX from 'xlsx';

const REPO_ROOT = path.resolve(__dirname, '..');
const XLSM_PATH = path.join(REPO_ROOT, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
const SHEET_SOURCE = path.join(REPO_ROOT, 'data', 'DEPENDENCY_VOFC_LOCAL.xlsx');
const SHEET_NAME = 'DEPENDENCY_VOFC_LOCAL';

async function main() {
  const xlsmBuf = await fs.readFile(XLSM_PATH);
  const wb = XLSX.read(xlsmBuf, { type: 'buffer', bookVBA: true });

  if (wb.SheetNames.includes(SHEET_NAME)) {
    console.log(`Sheet "${SHEET_NAME}" already exists in workbook. Removing and re-adding from source.`);
    delete wb.Sheets[SHEET_NAME];
    wb.SheetNames = wb.SheetNames.filter((n) => n !== SHEET_NAME);
  }

  const sourceBuf = await fs.readFile(SHEET_SOURCE);
  const sourceWb = XLSX.read(sourceBuf, { type: 'buffer' });
  const sheet = sourceWb.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found in ${SHEET_SOURCE}. Run export_dependency_vofc_to_sheet.ts first.`);
  }

  wb.SheetNames.push(SHEET_NAME);
  wb.Sheets[SHEET_NAME] = sheet;

  await fs.copyFile(XLSM_PATH, XLSM_PATH.replace('.xlsm', '.backup.xlsm'));
  XLSX.writeFile(wb, XLSM_PATH, { bookType: 'xlsm', bookVBA: true } as XLSX.WritingOptions);

  console.log(`Added sheet "${SHEET_NAME}" to Asset Dependency Visualization.xlsm`);
  console.log(`Backup saved as Asset Dependency Visualization.backup.xlsm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
