/**
 * Build-time script: read VOFC_Library.xlsx and write apps/web/public/vofc-library.json.
 * Used for static/offline web build so the client can load the library without Node/fs.
 * Run from repo root: pnpm exec tsx scripts/build-vofc-json.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadVofcLibraryEntries, getVofcLibraryPath } from '../packages/engine/src/vofc/library';

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'apps', 'web', 'public', 'vofc-library.json');

async function main() {
  const libraryPath = getVofcLibraryPath();
  const entries = await loadVofcLibraryEntries(libraryPath);
  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries), 'utf8');
  console.log(`Wrote ${entries.length} VOFC library entries to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
