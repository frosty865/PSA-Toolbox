#!/usr/bin/env node
/**
 * Fail if tools-manifest.json or pnpm-workspace.yaml references missing paths.
 * Run from repo root: node scripts/verify-tool-paths.cjs
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
let errors = 0;

function fail(msg) {
  console.error(msg);
  errors += 1;
}

const manifestPath = path.join(repoRoot, 'tools-manifest.json');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  console.error('[verify-tool-paths] Cannot read tools-manifest.json:', e.message);
  process.exit(1);
}

for (const tool of manifest.tools || []) {
  const rel = tool.relativePath;
  if (!rel) {
    fail(`[verify-tool-paths] Tool "${tool.id}" has no relativePath`);
    continue;
  }
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    fail(`[verify-tool-paths] Tool "${tool.id}" relativePath missing on disk: ${rel}`);
  }
}

const daRoot = path.join(repoRoot, 'tools', 'dependency-analysis');
const wsFile = path.join(daRoot, 'pnpm-workspace.yaml');
if (!fs.existsSync(wsFile)) {
  fail(`[verify-tool-paths] Missing ${path.relative(repoRoot, wsFile)}`);
} else {
  const text = fs.readFileSync(wsFile, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*"([^"]+)"\s*$/);
    if (!m) continue;
    const entry = m[1];
    if (entry.includes('*')) continue;
    const resolved = path.resolve(daRoot, entry);
    if (!fs.existsSync(resolved)) {
      fail(
        `[verify-tool-paths] pnpm-workspace package path missing: "${entry}" → ${path.relative(repoRoot, resolved)}`,
      );
    }
  }
}

if (errors > 0) {
  console.error(
    `\n[verify-tool-paths] ${errors} error(s). Update tools-manifest.json, or fix pnpm-workspace.yaml paths under tools/dependency-analysis.`,
  );
  process.exit(1);
}
console.log('[verify-tool-paths] OK — manifest tool paths and workspace entries exist.');
