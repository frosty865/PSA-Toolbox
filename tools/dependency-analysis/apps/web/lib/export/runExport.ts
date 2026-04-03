/**
 * Internal export: build summary, generate VOFCs, assert ready, run reporter.
 * Used by API routes and by export smoke test.
 */
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import type { Assessment, VOFCCollection } from 'schema';
import {
  buildSummary,
  assertExportReady,
  REQUIRED_ANCHORS,
} from 'engine';
import { validateTemplateAnchorsOnce } from '@/app/lib/template/validateAnchors';
import { buildReportVM } from '@/app/lib/report/view_model';
import { composeReportBlocks } from '@/app/lib/report/compose_blocks';
import { assertCoverageComplete } from '@/app/lib/report/coverage_manifest';
import { buildVofcCollectionFromAssessment } from '@/app/lib/vofc/build_vofc_collection';

const TOOL_VERSION = process.env.TOOL_VERSION ?? '0.1.0';
const DEV_TEMPLATE_FILENAME = '_dev_with_anchors.docx';

export interface RunExportOptions {
  repoRoot: string;
  workDir: string;
  /** Deprecated: legacy VOFC library path. Ignored; VOFCs are derived from assessment conditions. */
  libraryPath?: string;
  templatePath: string;
  /** Deprecated: legacy injected rule override path. Ignored by assessment-derived VOFC generation. */
  rulesOverride?: unknown[];
  /** When true, return value includes engine_ms and reporter_ms. Used by perf harness. */
  recordTimings?: boolean;
}

export interface RunExportTimings {
  buffer: Buffer;
  engine_ms: number;
  reporter_ms: number;
}

/** When ADA_ALLOW_DEV_TEMPLATE=1, use the injected dev template (never overwrites real template). */
function resolveTemplatePath(templatePath: string): string {
  if (process.env.ADA_ALLOW_DEV_TEMPLATE !== '1') return templatePath;
  const dir = path.dirname(templatePath);
  return path.join(dir, DEV_TEMPLATE_FILENAME);
}

/**
 * Run export pipeline and return DOCX buffer. Does not create draft zip.
 * When options.recordTimings is true, returns { buffer, engine_ms, reporter_ms }.
 */
export async function runExportToDocx(
  assessment: Assessment,
  options: RunExportOptions
): Promise<Buffer | RunExportTimings> {
  const { repoRoot, workDir, templatePath, recordTimings } = options;
  const effectiveTemplatePath = resolveTemplatePath(templatePath);

  const t0 = recordTimings ? Date.now() : 0;
  const vofcCollection: VOFCCollection = buildVofcCollectionFromAssessment(assessment);
  const summary = buildSummary(assessment);
  assertExportReady({
    assessment,
    summary,
    vofcs: vofcCollection,
    requiredAnchors: [...REQUIRED_ANCHORS],
  });
  if (process.env.REPORT_COVERAGE_DEBUG !== 'true') {
    assertCoverageComplete(assessment);
  }
  await validateTemplateAnchorsOnce(effectiveTemplatePath);
  const engine_ms = recordTimings ? Date.now() - t0 : 0;

  // Build ReportVM and blocks for narrative export
  const reportVM = buildReportVM(assessment);
  const reportBlocks = composeReportBlocks(reportVM);

  const command = 'python';
  const args = [path.join(repoRoot, 'apps', 'reporter', 'main.py')];
  const t1 = recordTimings ? Date.now() : 0;
  const buffer = await runReporter(command, args, workDir, effectiveTemplatePath, repoRoot, {
    assessment,
    vofc_collection: vofcCollection,
    report_vm: reportVM,
    report_blocks: reportBlocks,
  });
  const reporter_ms = recordTimings ? Date.now() - t1 : 0;

  if (recordTimings) {
    return { buffer, engine_ms, reporter_ms };
  }
  return buffer;
}

function runReporter(
  command: string,
  args: string[],
  workDir: string,
  templatePath: string,
  cwd: string,
  payload: { assessment: object; vofc_collection?: object; report_vm?: object; report_blocks?: object }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      env: { ...process.env, WORK_DIR: workDir, TEMPLATE_PATH: templatePath, TOOL_VERSION },
      cwd,
    });
    proc.stdin.write(JSON.stringify(payload), () => proc.stdin.end());
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => stdoutChunks.push(c));
    proc.stderr.on('data', (d: Buffer) => stderrChunks.push(d));
    proc.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      if (code !== 0) {
        console.error('REPORTER FAILED');
        console.error('STDOUT:');
        console.error(stdout || '(none)');
        console.error('STDERR:');
        console.error(stderr || '(none)');
        const detail = stderr || stdout || `Reporter exited ${code}`;
        reject(new Error(`Reporter exited ${code}. ${detail}`));
        return;
      }
      fs.readFile(path.join(workDir, 'output.docx'))
        .then(resolve)
        .catch(reject);
    });
    proc.on('error', (err) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
      console.error('REPORTER FAILED (spawn error)');
      console.error('STDOUT:');
      console.error(stdout || '(none)');
      console.error('STDERR:');
      console.error(stderr || '(none)');
      reject(err);
    });
  });
}
