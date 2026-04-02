#!/usr/bin/env node
/**
 * Dev: clear IDA Next cache, then run toolbox dev servers.
 * - IDA (web): port 3000
 * - CISA Site Assessment (psa-rebuild in tools/cisa-site-assessment): port 3001, proxied at /cisa-site-assessment/
 * Set PSA_TOOLBOX_SKIP_SITE_ASSESSMENT=1 to run only IDA (no PSA dependency / DB).
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

const skipPsa = process.env.PSA_TOOLBOX_SKIP_SITE_ASSESSMENT === '1';

const cmd = skipPsa
  ? 'pnpm --filter web dev'
  : 'pnpm exec concurrently -n ida,psa -c cyan,magenta "pnpm --filter web dev" "pnpm --filter psa-rebuild dev"';

const result = spawnSync(cmd, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
