#!/usr/bin/env node
/**
 * Single dev command: clear Next.js cache, then run dev server.
 * Ensures updates always show (no stale .next).
 * Cross-platform (Node.js; no PowerShell).
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const nextDir = path.join(root, 'apps', 'web', '.next');

if (fs.existsSync(nextDir)) {
  try {
    fs.rmSync(nextDir, { recursive: true, maxRetries: 2 });
    console.log('Cleared .next cache');
  } catch (err) {
    if (err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'ENOTEMPTY') {
      console.warn('Could not clear .next (stop any running dev server first). Continuing...');
    } else {
      throw err;
    }
  }
}

const result = spawnSync('pnpm', ['--filter', 'web', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
