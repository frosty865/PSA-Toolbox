/**
 * Seed dependency_vofc_local from XLSM sheet DEPENDENCY_VOFC_LOCAL.
 *
 * Primary (requires web dev server):
 *   pnpm --filter web dev  (in one terminal)
 *   node scripts/seed_dependency_vofc_from_xlsm.mjs  (in another)
 *
 * Fallback (direct seed mode): node scripts/seed_dependency_vofc_from_xlsm.mjs --direct
 *   Writes directly to data/dependency_vofc_local.json
 *
 * Optional: ADA_BASE_URL=http://localhost:3000 node scripts/seed_dependency_vofc_from_xlsm.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WORKBOOK_XLSM = path.join(REPO_ROOT, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
const WORKBOOK_XLSX = path.join(REPO_ROOT, 'data', 'DEPENDENCY_VOFC_LOCAL.xlsx');
const SHEET = 'DEPENDENCY_VOFC_LOCAL';
const BASE_URL = process.env.ADA_BASE_URL || 'http://localhost:3000';

const REQUIRED_HEADERS = [
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

const INFRA = new Set([
  'ENERGY',
  'COMMUNICATIONS',
  'INFORMATION_TRANSPORT',
  'WATER',
  'WASTEWATER',
]);
const SOURCE_TYPE = new Set(['VOFC_XLS', 'CISA_GUIDE', 'NIST', 'OTHER']);

const FORBIDDEN_VERBS = [
  'install',
  'issue',
  'implement',
  'deploy',
  'procure',
  'purchase',
  'must',
  'require',
  'mandate',
  'enforce',
];
const BLOCKLIST = [
  'badge',
  'badging',
  'photo id',
  'keycard',
  'access level',
  'access control',
  'cctv',
  'camera',
  'video surveillance',
  'intrusion detection',
  'ids',
  'cybersecurity plan',
  'us-cert',
  'ics-cert',
  'training',
  'forums',
  'nist 800',
];

function norm(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}
function lower(s) {
  return norm(s).toLowerCase();
}
function hasWholeWord(hay, word) {
  const re = new RegExp(
    `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'i'
  );
  return re.test(hay);
}
function containsForbiddenVerb(text) {
  const t = String(text ?? '');
  return FORBIDDEN_VERBS.find((v) => hasWholeWord(t, v)) || null;
}
function containsBlock(text) {
  const t = lower(text);
  return BLOCKLIST.find((k) => t.includes(k)) || null;
}
function parseBool(v) {
  const t = lower(v);
  if (t === 'true' || t === 'yes' || t === '1') return true;
  if (t === 'false' || t === 'no' || t === '0' || t === '') return false;
  return null;
}
function validateRow(row) {
  const errs = [];
  if (!row.condition_code) errs.push('missing condition_code');
  if (!INFRA.has(row.infrastructure)) errs.push(`invalid infrastructure: ${row.infrastructure}`);
  if (!row.vulnerability) errs.push('missing vulnerability');
  if (!SOURCE_TYPE.has(row.source_type)) errs.push(`invalid source_type: ${row.source_type}`);
  if (!row.source_reference) errs.push('missing source_reference');
  if (typeof row.approved !== 'boolean') errs.push('approved must be boolean');
  if (!row.version) errs.push('missing version');

  const b1 = containsBlock(row.vulnerability);
  if (b1) errs.push(`blocked keyword in vulnerability: ${b1}`);

  for (const k of ['ofc_1', 'ofc_2', 'ofc_3', 'ofc_4']) {
    const t = row[k];
    if (!t) continue;
    const b = containsBlock(t);
    if (b) errs.push(`blocked keyword in ${k}: ${b}`);
    const fv = containsForbiddenVerb(t);
    if (fv) errs.push(`forbidden verb in ${k}: ${fv}`);
  }

  return { ok: errs.length === 0, errors: errs };
}

async function postUpsert(row) {
  const res = await fetch(`${BASE_URL}/api/admin/dependency-vofc/upsert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ row }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`upsert failed ${res.status}: ${txt}`);
  }
}

function headerMapFromSheet(ws) {
  const ref = ws['!ref'];
  if (!ref) throw new Error('sheet has no !ref');
  const range = XLSX.utils.decode_range(ref);
  const headerRow = range.s.r;
  const map = new Map();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c });
    const val = norm(ws[addr]?.v);
    if (val) map.set(val, c);
  }
  return { map, range };
}

function getCell(ws, r, colIdx) {
  if (colIdx === undefined) return '';
  const addr = XLSX.utils.encode_cell({ r, c: colIdx });
  return norm(ws[addr]?.v);
}

function loadWorkbook() {
  if (fs.existsSync(WORKBOOK_XLSM)) {
    const wb = XLSX.readFile(WORKBOOK_XLSM, { cellDates: false });
    if (wb.SheetNames.includes(SHEET)) {
      return { wb, source: WORKBOOK_XLSM };
    }
  }
  if (fs.existsSync(WORKBOOK_XLSX)) {
    const wb = XLSX.readFile(WORKBOOK_XLSX, { cellDates: false });
    if (wb.SheetNames.includes(SHEET)) {
      return { wb, source: WORKBOOK_XLSX };
    }
  }
  throw new Error(
    `Sheet "${SHEET}" not found. Add it to assets/workbooks/Asset Dependency Visualization.xlsm, ` +
      `or create data/DEPENDENCY_VOFC_LOCAL.xlsx and run: pnpm run export:dep-vofc-sheet && pnpm run add:dep-vofc-sheet`
  );
}

async function main() {
  const { wb, source } = loadWorkbook();
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`sheet not found: ${SHEET}`);

  console.log(`Reading sheet "${SHEET}" from ${path.basename(source)}`);

  const { map, range } = headerMapFromSheet(ws);

  const missing = REQUIRED_HEADERS.filter((h) => !map.has(h));
  if (missing.length) {
    throw new Error(`missing headers: ${missing.join(', ')}`);
  }

  const seen = new Set();
  const rejects = [];
  let okCount = 0;

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const condition_code = getCell(ws, r, map.get('condition_code'));
    if (!condition_code) break;

    const approvedVal = parseBool(getCell(ws, r, map.get('approved')));
    const row = {
      condition_code,
      infrastructure: getCell(ws, r, map.get('infrastructure')),
      vulnerability: getCell(ws, r, map.get('vulnerability')),
      ofc_1: getCell(ws, r, map.get('ofc_1')) || undefined,
      ofc_2: getCell(ws, r, map.get('ofc_2')) || undefined,
      ofc_3: getCell(ws, r, map.get('ofc_3')) || undefined,
      ofc_4: getCell(ws, r, map.get('ofc_4')) || undefined,
      source_type: getCell(ws, r, map.get('source_type')),
      source_reference: getCell(ws, r, map.get('source_reference')),
      approved: approvedVal,
      version: getCell(ws, r, map.get('version')) || 'dep_v1',
    };

    if (seen.has(row.condition_code)) {
      rejects.push({
        condition_code: row.condition_code,
        rownum: r + 1,
        errors: ['duplicate condition_code in sheet'],
      });
      continue;
    }
    seen.add(row.condition_code);

    const v = validateRow(row);
    if (!v.ok) {
      rejects.push({ condition_code: row.condition_code, rownum: r + 1, errors: v.errors });
      continue;
    }

    okCount++;
  }

  if (rejects.length) {
    console.error(`REJECTED ${rejects.length} row(s). Fix the sheet; seeding aborted.`);
    for (const x of rejects.slice(0, 20)) {
      console.error(`- Row ${x.rownum} ${x.condition_code}: ${x.errors.join('; ')}`);
    }
    process.exit(1);
  }

  console.log(`Validated ${okCount} row(s). Seeding...`);

  const useDirect = process.argv.includes('--direct');
  const jsonPath = path.join(REPO_ROOT, 'data', 'dependency_vofc_local.json');

  const rowsToUpsert = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const condition_code = getCell(ws, r, map.get('condition_code'));
    if (!condition_code) break;

    const approvedVal = parseBool(getCell(ws, r, map.get('approved')));
    rowsToUpsert.push({
      condition_code,
      infrastructure: getCell(ws, r, map.get('infrastructure')),
      vulnerability: getCell(ws, r, map.get('vulnerability')),
      ofc_1: getCell(ws, r, map.get('ofc_1')) || undefined,
      ofc_2: getCell(ws, r, map.get('ofc_2')) || undefined,
      ofc_3: getCell(ws, r, map.get('ofc_3')) || undefined,
      ofc_4: getCell(ws, r, map.get('ofc_4')) || undefined,
      source_type: getCell(ws, r, map.get('source_type')),
      source_reference: getCell(ws, r, map.get('source_reference')),
      approved: approvedVal ?? false,
      version: getCell(ws, r, map.get('version')) || 'dep_v1',
    });
  }

  if (useDirect) {
    const records = rowsToUpsert.map((row) => ({
      id: `dep-${row.condition_code.toLowerCase().replace(/_/g, '-')}`,
      condition_code: row.condition_code,
      infrastructure: row.infrastructure,
      vulnerability_text: row.vulnerability,
      ofc_1: row.ofc_1 || undefined,
      ofc_2: row.ofc_2 || undefined,
      ofc_3: row.ofc_3 || undefined,
      ofc_4: row.ofc_4 || undefined,
      source_type: row.source_type,
      source_reference: row.source_reference,
      approved: row.approved,
      version: row.version,
    }));
    const dir = path.dirname(jsonPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`DONE. Wrote ${records.length} row(s) to ${jsonPath}`);
  } else {
    for (const row of rowsToUpsert) {
      await postUpsert(row);
    }
    console.log(`DONE. Upserted ${rowsToUpsert.length} row(s) into dependency_vofc_local.`);
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
