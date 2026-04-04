/**
 * Performance measurement harness for the export pipeline.
 * Uses the same pipeline as exportSmoke; does not delete outputs.
 * Writes metrics to data/exports/_perf/<timestamp>/metrics.json.
 *
 * Usage: npx tsx scripts/tests/perfExport.ts --profile small|typical|stress --runs N
 * Example: npx tsx scripts/tests/perfExport.ts --profile typical --runs 3
 */
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { runExportToDocx, type RunExportTimings } from '../../lib/export/runExport';
import type { Assessment } from 'schema';
import { ensureDir, nowIso, toErrorMessage } from './_helpers';

const WEB_ROOT = process.cwd();
const REPO_ROOT = path.resolve(WEB_ROOT, '..', '..');
const DATA_TEMP = path.join(REPO_ROOT, 'data', 'temp');
const PERF_ROOT = path.join(REPO_ROOT, 'data', 'exports', '_perf');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'ADA', 'report template.docx');
const REPORTER_VERIFY = path.join(REPO_ROOT, 'apps', 'reporter', 'verify_output.py');
const FIXTURES_DIR = path.join(WEB_ROOT, 'scripts', 'tests', 'fixtures');

type PerfProfile = 'small' | 'typical' | 'stress';

type PerfArgs = {
  profile: PerfProfile;
  runs: number;
};

function parseArgs(argv: string[]): PerfArgs {
  let profile: PerfProfile = 'typical';
  let runs = 3;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--profile' && argv[i + 1]) {
      const p = argv[i + 1].toLowerCase();
      if (p === 'small' || p === 'typical' || p === 'stress') profile = p;
      i++;
    } else if (argv[i] === '--runs' && argv[i + 1]) {
      const n = parseInt(argv[i + 1], 10);
      if (Number.isNaN(n) || n < 1) {
        throw new Error(`Invalid --runs value: ${argv[i + 1]}`);
      }
      runs = n;
      i++;
    }
  }
  return { profile, runs };
}

type PerfRunMetrics = {
  run_index: number;
  profile: PerfProfile;
  total_ms: number;
  engine_ms: number;
  reporter_ms: number;
  verifier_ms: number;
  output_docx_bytes: number;
  output_docx_path: string;
};

type PerfSuiteMetrics = {
  tool: 'infrastructure-dependency-tool';
  generated_at_iso: string;
  profile: PerfProfile;
  runs: number;
  results: PerfRunMetrics[];
};

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
      stdio: 'pipe',
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
  let args: PerfArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err: unknown) {
    console.error(toErrorMessage(err));
    return 1;
  }

  const { profile, runs } = args;
  process.env.ADA_USE_PYTHON_REPORTER = '1';

  const assessment = await loadAssessment(profile);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(PERF_ROOT, timestamp);
  await ensureDir(outDir);

  const results: PerfRunMetrics[] = [];
  let lastWorkDir: string | null = null;

  for (let i = 0; i < runs; i++) {
    const workDir = path.join(DATA_TEMP, `perf-${randomUUID()}`);
    await ensureDir(workDir);
    lastWorkDir = workDir;

    const totalStart = Date.now();
    const result = await runExportToDocx(assessment, {
      repoRoot: REPO_ROOT,
      workDir,
      templatePath: TEMPLATE_PATH,
      recordTimings: true,
    });

    if (!isRunExportTimings(result)) {
      console.error('Perf run: expected RunExportTimings');
      return 1;
    }

    const { buffer, engine_ms, reporter_ms } = result;
    const outputPath = path.join(workDir, 'output.docx');
    await writeFile(outputPath, buffer);

    const { ms: verifier_ms, exitCode } = await runVerifier(outputPath);
    if (exitCode !== 0) {
      console.error(`Perf run ${i + 1}: verifier failed`);
      return 1;
    }

    const total_ms = Date.now() - totalStart;
    results.push({
      run_index: i + 1,
      profile,
      total_ms,
      engine_ms,
      reporter_ms,
      verifier_ms,
      output_docx_bytes: buffer.length,
      output_docx_path: outputPath,
    });
  }

  const suite: PerfSuiteMetrics = {
    tool: 'infrastructure-dependency-tool',
    generated_at_iso: nowIso(),
    profile,
    runs,
    results,
  };

  const metricsPath = path.join(outDir, 'metrics.json');
  await writeFile(metricsPath, JSON.stringify(suite, null, 2));

  console.log(`Wrote ${metricsPath}`);
  if (lastWorkDir) {
    console.log(`Outputs retained under: ${lastWorkDir}`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(toErrorMessage(err));
    process.exit(1);
  });
