#!/usr/bin/env node
/**
 * Run next build with TMP/TEMP set to project-local dir.
 * On Windows, Next.js/webpack can hit EPERM when scanning os.tmpdir() if it
 * contains locked dirs (e.g. pytest-of-frost). Using a project-local TMP avoids that.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const webRoot = path.resolve(__dirname, '..');
const buildTmp = path.join(webRoot, '.build-tmp');
try {
  fs.mkdirSync(buildTmp, { recursive: true });
} catch (_) {
  /* ignore */
}
process.env.TMP = buildTmp;
process.env.TEMP = buildTmp;

const r = spawnSync('npx', ['next', 'build', '--webpack'], {
  cwd: webRoot,
  stdio: 'inherit',
  shell: true,
});
process.exit(r.status ?? 1);
