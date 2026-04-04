/**
 * Scenario export harness: take a JSON fixture assessment, run export, and keep the DOCX.
 * Uses the same pipeline as exportSmoke/perfExport but targets the dev template with anchors.
 *
 * Usage examples (from apps/web):
 *   npx tsx scripts/tests/scenarioExport.ts --profile typical
 *   npx tsx scripts/tests/scenarioExport.ts --profile small
 */
import path from 'node:path';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { runExportToDocx, type RunExportTimings } from '../../lib/export/runExport';
import type { Assessment } from 'schema';
import { ensureDir, nowIso, toErrorMessage } from './_helpers';

const WEB_ROOT = process.cwd();
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
const DATA_TEMP = path.join(REPO_ROOT, 'data', 'temp');
// Use the dev template that is expected to contain all required anchors
const TEMPLATE_PATH = path.join(REPO_ROOT, 'assets', 'templates', '_dev_with_anchors.docx');
const REPORTER_VERIFY = path.join(REPO_ROOT, 'apps', 'reporter', 'verify_output.py');
const FIXTURES_DIR = path.join(WEB_ROOT, 'scripts', 'tests', 'fixtures');
const SCENARIO_OUT_DIR = path.join(REPO_ROOT, 'data', 'exports', '_scenario');

type PerfProfile = 'small' | 'typical' | 'stress';

type ScenarioArgs = {
  profile: PerfProfile;
};

function parseArgs(argv: string[]): ScenarioArgs {
  let profile: PerfProfile = 'typical';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      const p = argv[i + 1].toLowerCase();
      if (p === 'small' || p === 'typical' || p === 'stress') profile = p;
      i++;
    }
  }
  return { profile };
}

function getFixturePath(profile: PerfProfile): string {
  return path.join(FIXTURES_DIR, `${profile}.json`);
}

async function loadAssessment(profile: PerfProfile): Promise<Assessment> {
  const fixturePath = getFixturePath(profile);
  const raw = await readFile(fixturePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Fixture is not a valid JSON object');
  }
  return parsed as Assessment;
}

function runVerifier(docxPath: string): Promise<{ exitCode: number; ms: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const proc = spawn('python', [REPORTER_VERIFY, docxPath], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    proc.on('close', (code) => {
      resolve({ exitCode: code ?? 1, ms: Date.now() - start });
    });
    proc.on('error', () => resolve({ exitCode: 1, ms: Date.now() - start }));
  });
}

function isRunExportTimings(
  value: Buffer | RunExportTimings
): value is RunExportTimings {
  return typeof value === 'object' && value !== null && 'buffer' in value;
}

async function main(): Promise<number> {
  let args: ScenarioArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err: unknown) {
    console.error(toErrorMessage(err));
    return 1;
  }

  const { profile } = args;
  process.env.ADA_USE_PYTHON_REPORTER = '1';

  const assessment = await loadAssessment(profile);
  const timestamp = nowIso().replace(/[:.]/g, '-').slice(0, 19);
  const workDir = path.join(DATA_TEMP, `scenario-${randomUUID()}`);
  await ensureDir(workDir);
  await ensureDir(SCENARIO_OUT_DIR);

  try {
    const result = await runExportToDocx(assessment, {
      repoRoot: REPO_ROOT,
      workDir,
      templatePath: TEMPLATE_PATH,
      recordTimings: true,
    });

    const rawBytes = isRunExportTimings(result) ? result.buffer : result;
    const docxBytes = Buffer.isBuffer(rawBytes)
      ? rawBytes
      : Buffer.from(rawBytes as ArrayBuffer);

    if (!docxBytes || docxBytes.length === 0) {
      console.error('Scenario export produced empty DOCX');
      return 1;
    }

    const workOutputPath = path.join(workDir, 'output.docx');
    await writeFile(workOutputPath, docxBytes);

    const prettyName = `${profile}-${timestamp}.docx`;
    const scenarioOutputPath = path.join(SCENARIO_OUT_DIR, prettyName);
    await copyFile(workOutputPath, scenarioOutputPath);

    console.log(`Scenario DOCX written to: ${scenarioOutputPath}`);

    const { exitCode, ms } = await runVerifier(workOutputPath);
    if (exitCode !== 0) {
      console.error(`verify_output.py failed for scenario (exit=${exitCode}, ${ms}ms)`);
      return 1;
    }

    console.log(`Scenario export OK for profile="${profile}" in ${ms}ms`);
    return 0;
  } catch (err: unknown) {
    console.error('Scenario export failed:', toErrorMessage(err));
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(toErrorMessage(err));
    process.exit(1);
  });
