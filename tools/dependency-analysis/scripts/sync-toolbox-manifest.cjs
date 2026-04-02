#!/usr/bin/env node
/**
 * Copy repo-root tools-manifest.json into apps/web/data for Next import (Vercel + local build).
 */
const fs = require('fs');
const path = require('path');

const toolRoot = path.resolve(__dirname, '..');
const src = path.join(toolRoot, '..', '..', 'tools-manifest.json');
const destDir = path.join(toolRoot, 'apps', 'web', 'data');
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
