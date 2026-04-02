/**
 * Produces `out/` with output: 'export'. Route handlers under app/api cannot be
 * statically prerendered; this script temporarily moves app/api aside for the build.
 * IT-hosted builds use plain `next build` without this script.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const webDir = path.resolve(__dirname, '..');
const idtRoot = path.resolve(webDir, '..', '..');
const apiDir = path.join(webDir, 'app', 'api');
const apiBackup = path.join(webDir, 'app', '_api_field_build_backup');

execSync('pnpm exec tsx scripts/write-template-anchor-manifest.ts', {
  cwd: idtRoot,
  stdio: 'inherit',
  env: { ...process.env },
});

if (!fs.existsSync(apiDir)) {
  console.error('[build-field-static] Missing app/api — nothing to move.');
  process.exit(1);
}

fs.renameSync(apiDir, apiBackup);
try {
  execSync('pnpm exec next build', {
    cwd: webDir,
    stdio: 'inherit',
    env: { ...process.env, FIELD_STATIC_EXPORT: '1' },
  });
  execSync('node scripts/rewrite-field-static-for-file.mjs', {
    cwd: idtRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });
} finally {
  if (fs.existsSync(apiBackup)) {
    fs.renameSync(apiBackup, apiDir);
  }
}
