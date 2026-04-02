#!/usr/bin/env node
/**
 * Copy repo-root tools-manifest.json into the Next app (Vercel + local build).
 * Run from PSA Toolbox repo root only.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const src = path.join(repoRoot, 'tools-manifest.json');
const destDir = path.join(repoRoot, 'tools', 'dependency-analysis', 'apps', 'web', 'data');
const dest = path.join(destDir, 'tools-manifest.json');

try {
  fs.mkdirSync(destDir, { recursive: true });
  const raw = fs.readFileSync(src, 'utf8');
  const data = JSON.parse(raw);
  delete data.$schema;
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n', 'utf8');
} catch (e) {
  console.error('[sync-toolbox-manifest] Failed:', e.message);
  process.exit(1);
}
