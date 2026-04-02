#!/usr/bin/env node
/**
 * Guard against increasing reliance on /api/* from client-facing code paths.
 * Field bundle target: no fetch to localhost API for core flows.
 *
 * Usage:
 *   node scripts/check-field-drift.mjs           # compare to baseline, exit 0 if OK
 *   node scripts/check-field-drift.mjs --write-baseline   # set baseline to current count (use intentionally)
 *
 * CI: set FIELD_DRIFT_STRICT=1 to fail when count exceeds baseline.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(REPO_ROOT, 'scripts', 'field-drift-baseline.json');

const SKIP_NAMES = new Set(['robots.ts', 'sitemap.ts']);
const SKIP_DIR_NAMES = new Set(['api', 'node_modules', '.next', 'dist']);

function walk(dir, outFiles = []) {
  if (!fs.existsSync(dir)) return outFiles;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name.name)) continue;
      walk(full, outFiles);
    } else if (name.isFile() && (name.name.endsWith('.ts') || name.name.endsWith('.tsx'))) {
      if (SKIP_NAMES.has(name.name)) continue;
      outFiles.push(full);
    }
  }
  return outFiles;
}

function countApiRefs(files) {
  let count = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('/api/')) count += 1;
    }
  }
  return count;
}

function main() {
  const webRoot = path.join(REPO_ROOT, 'apps', 'web');
  const dirs = [
    path.join(webRoot, 'lib'),
    path.join(webRoot, 'components'),
    path.join(webRoot, 'app'),
  ];
  const files = [];
  for (const d of dirs) {
    walk(d, files);
  }
  const total = countApiRefs(files);

  const writeBaseline = process.argv.includes('--write-baseline');
  if (writeBaseline) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ clientLinesReferencingApiPath: total, updated: new Date().toISOString() }, null, 2) + '\n', 'utf8');
    console.log(`[check-field-drift] Wrote baseline: ${total} (lines containing /api/ in scanned files)`);
    process.exit(0);
  }

  let baseline = 0;
  if (fs.existsSync(BASELINE_PATH)) {
    const j = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    baseline = j.clientLinesReferencingApiPath ?? 0;
  } else {
    console.warn('[check-field-drift] No baseline file; run with --write-baseline after review.');
    process.exit(0);
  }

  console.log(`[check-field-drift] client /api/ line refs: ${total} (baseline ${baseline})`);

  const strict = process.env.FIELD_DRIFT_STRICT === '1' || process.env.CI === 'true';
  if (strict && total > baseline) {
    console.error(
      `[check-field-drift] FAIL: ${total} > baseline ${baseline}. New client-side /api/ references require intentional baseline bump (and product review).`
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
