#!/usr/bin/env node
/**
 * Dev: clear IDA Next cache, then run toolbox dev servers.
 * - IDA (web): port 3000
 * - Optional: CISA Site Assessment (tools/cisa-site-assessment): port 3001, proxied at /cisa-site-assessment/
 *   Only started if that folder exists; it is not a pnpm workspace member.
 * Set PSA_TOOLBOX_SKIP_SITE_ASSESSMENT=1 to run only IDA.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cisaSiteRoot = path.resolve(root, '..', 'cisa-site-assessment');
const cisaSitePresent = fs.existsSync(path.join(cisaSiteRoot, 'package.json'));
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

/** Relative to tools/dependency-analysis — no spaces, safe inside concurrently's double-quoted argv. */
const relCisa = path.relative(root, cisaSiteRoot).split(path.sep).join('/');

const cmd =
  skipPsa || !cisaSitePresent
    ? 'pnpm --filter web dev'
    : `pnpm exec concurrently -n ida,psa -c cyan,magenta "pnpm --filter web dev" "pnpm --dir ${relCisa} dev"`;

const result = spawnSync(cmd, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
