#!/usr/bin/env node
/**
 * Run web build with TMP/TEMP set to project-local dir.
 * On Windows, Next.js/webpack can hit EPERM when scanning os.tmpdir() if it
 * contains locked dirs (e.g. pytest-of-frost). Using a project-local TMP avoids that.
 * Create the dir so pnpm/temp-dir can resolve it (required on Vercel/CI).
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
require(path.join(__dirname, '../../../scripts/sync-toolbox-manifest.cjs'));
const buildTmp = path.join(root, '.build-tmp');
try {
  fs.mkdirSync(buildTmp, { recursive: true });
} catch (_) {
  // ignore if exists or mkdir fails
}
process.env.TMP = buildTmp;
process.env.TEMP = buildTmp;

const result = spawnSync('pnpm', ['--filter', 'web', 'run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
