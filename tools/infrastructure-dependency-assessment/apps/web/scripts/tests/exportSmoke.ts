/**
 * Export smoke test: run internal export for fixture assessments and verify outputs.
 * Fixture (fullAssessmentForExport) populates all categories with non-trivial values, including
 * CRITICAL_PRODUCTS as table-driven (critical_products array).
 * Verification: no anchors remain, chart anchors replaced, summary table present,
 * Narrative analytical considerations present, critical products represented in summary (verify_output.py).
 * Run from repo root: pnpm --filter web run exportSmoke
 * Or from apps/web: npx tsx scripts/tests/exportSmoke.ts
 */
import path from 'node:path';
import { writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fullAssessmentForExport } from 'engine';
import { runExportToDocx, type RunExportTimings } from '../../lib/export/runExport';
import { ensureDir, safeRm, toErrorMessage } from './_helpers';

const WEB_ROOT = process.cwd();
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
const DATA_TEMP = path.join(REPO_ROOT, 'data', 'temp');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'ADA', 'report template.docx');
const REPORTER_VERIFY = path.join(REPO_ROOT, 'apps', 'reporter', 'verify_output.py');
const SMOKE_KEEP_DIR = path.join(REPO_ROOT, 'data', 'exports', '_smoke');
const SMOKE_KEEP_PATH = path.join(SMOKE_KEEP_DIR, 'SmokeReport.docx');

function isRunExportTimings(
  value: Buffer | RunExportTimings
): value is RunExportTimings {
  return typeof value === 'object' && value !== null && 'buffer' in value;
}

async function main(): Promise<number> {
  const workDir = path.join(DATA_TEMP, randomUUID());
  await ensureDir(workDir);
  try {
    process.env.ADA_USE_PYTHON_REPORTER = '1';
    const result = await runExportToDocx(fullAssessmentForExport, {
      repoRoot: REPO_ROOT,
      workDir,
      templatePath: TEMPLATE_PATH,
    });

    const rawBytes = isRunExportTimings(result) ? result.buffer : result;
    const docxBytes = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes as ArrayBuffer);

    if (!docxBytes || docxBytes.length === 0) {
      console.error('Export produced empty DOCX');
      return 1;
    }

    await writeFile(path.join(workDir, 'output.docx'), docxBytes);

    const verifyExit = await new Promise<number>((resolve) => {
      const proc = spawn('python', [REPORTER_VERIFY, path.join(workDir, 'output.docx')], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
      });
      proc.on('close', (code) => resolve(code ?? 1));
      proc.on('error', () => resolve(1));
    });
    if (verifyExit !== 0) {
      console.error('verify_output.py failed');
      return 1;
    }

    const keep = process.env.EXPORT_SMOKE_KEEP === '1';
    if (keep) {
      try {
        await ensureDir(SMOKE_KEEP_DIR);
        await copyFile(path.join(workDir, 'output.docx'), SMOKE_KEEP_PATH);
        console.log('SMOKE ARTIFACT KEPT: data/exports/_smoke/SmokeReport.docx');
      } catch {
        // Do not fail the smoke test if copy fails
      }
    }

    console.log('Export smoke: OK');
    return 0;
  } catch (err: unknown) {
    const msg = toErrorMessage(err);
    if (msg.includes('Template anchor validation failed') || msg.includes('Missing required anchor')) {
      console.error('TEMPLATE MISSING ANCHORS — This is not a code failure.');
      console.error('  Run: pnpm template:check');
      console.error('  Add anchors to: ADA/report template.docx');
    }
    console.error('Export smoke failed:', msg);
    return 1;
  } finally {
    await safeRm(workDir);
  }
}

main().then((code) => process.exit(code));
