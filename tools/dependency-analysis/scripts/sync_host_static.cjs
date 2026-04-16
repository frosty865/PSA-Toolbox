#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const sourceDir = path.join(repoRoot, 'tools', 'hotel-analysis');
const targetDir = path.join(repoRoot, 'tools', 'dependency-analysis', 'apps', 'web', 'public', 'hotel-analysis');

const entries = ['HOST V3.html', 'index.html', 'Assets', 'LocalData', 'src'];

function copyEntry(name) {
  const src = path.join(sourceDir, name);
  const dest = path.join(targetDir, name);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing HOST source entry: ${src}`);
  }
  fs.cpSync(src, dest, { recursive: true, force: true });
}

try {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of entries) {
    copyEntry(entry);
  }
  console.log('[sync-host-static] HOST static files synced into dependency-analysis public/hotel-analysis');
} catch (error) {
  console.error('[sync-host-static] Failed:', error.message);
  process.exit(1);
}
