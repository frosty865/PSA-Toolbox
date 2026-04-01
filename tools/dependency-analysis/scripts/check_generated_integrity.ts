/**
 * Re-run extractor in memory and compare to repo file.
 * Fails if the repo file differs (hand-edited or forgot to re-run).
 * Usage: tsx scripts/check_generated_integrity.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import XLSX from 'xlsx';

const ROOT = path.resolve(__dirname, '..');
const XLSM_PATH = path.join(ROOT, 'assets', 'workbooks', 'Asset Dependency Visualization.xlsm');
const OUT_PATH = path.join(ROOT, 'packages', 'schema', 'src', 'ui_config.generated.ts');

/** Normalize for comparison: LF, trim trailing whitespace per line, single trailing newline. */
function normalize(s: string): string {
  const t = s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trimEnd();
  return t + (t ? '\n' : '');
}

/** Exit codes: 0 = match, 1 = file out of date, 2 = XLSM missing or extraction error. */
async function main(): Promise<void> {
  const { generateUiConfigFileContent } = await import('./extract_xlsm_ui_config');
  if (!fs.existsSync(XLSM_PATH)) {
    console.error('XLSM not found:', XLSM_PATH);
    process.exit(2);
  }
  let expected: string;
  try {
    const wb = XLSX.readFile(XLSM_PATH, { cellStyles: false });
    expected = generateUiConfigFileContent(wb);
  } catch (e) {
    console.error('Extraction failed:', e instanceof Error ? e.message : e);
    process.exit(2);
  }
  const actual = fs.readFileSync(OUT_PATH, 'utf-8');
  if (normalize(expected) !== normalize(actual)) {
    console.error('Generated file is out of date or was edited by hand.');
    console.error('Run: pnpm run extract-xlsm');
    console.error('Then commit the updated packages/schema/src/ui_config.generated.ts');
    process.exit(1);
  }
  console.log('Generated file matches extractor output.');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
