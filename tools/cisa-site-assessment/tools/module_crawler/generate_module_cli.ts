#!/usr/bin/env npx tsx
/**
 * End-to-end module generation CLI: run 2-pass Python pipeline, resolve subtypes, validate, write export JSON.
 * Requires: data/module_chunks/<module_code>.json (run extract_module_pdfs_to_chunks.py first).
 * Outputs: tools/outputs/<module_code>_export.json, tools/outputs/module_generation_report.json (from Python).
 *
 * Usage:
 *   npx tsx tools/module_crawler/generate_module_cli.ts --module MODULE_EV_PARKING
 *   npx tsx tools/module_crawler/generate_module_cli.ts --module MODULE_EV_PARKING --source data/module_chunks/MODULE_EV_PARKING.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

// Load .env.local so RUNTIME_DATABASE_URL is available for subtype resolution
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  }
}

function getPython(): string {
  const fromEnv = process.env.PYTHON_PATH || process.env.PYTHON;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  if (process.platform === 'win32') {
    const r = spawnSync('py', ['-3', '-c', 'import sys; print(sys.executable)'], { encoding: 'utf-8', timeout: 5000 });
    if (!r.error && r.status === 0 && r.stdout?.trim()) return r.stdout.trim();
  }
  const r = spawnSync('python3', ['-c', 'pass'], { encoding: 'utf-8', timeout: 5000 });
  if (!r.error) return 'python3';
  return 'python';
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  let moduleCode = '';
  let sourcePath = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--module' && args[i + 1]) {
      moduleCode = args[i + 1].trim();
      i++;
    } else if (args[i] === '--source' && args[i + 1]) {
      sourcePath = path.isAbsolute(args[i + 1]) ? args[i + 1] : path.join(projectRoot, args[i + 1]);
      i++;
    }
  }
  if (!moduleCode) {
    console.error('Usage: npx tsx tools/module_crawler/generate_module_cli.ts --module MODULE_EV_PARKING [--source path/to/chunks.json]');
    return 1;
  }
  const chunksDefault = path.join(projectRoot, 'data', 'module_chunks', `${moduleCode}.json`);
  const chunksPath = sourcePath || chunksDefault;
  if (!fs.existsSync(chunksPath)) {
    console.error(`Chunks not found: ${chunksPath}. Run: python tools/modules/extract_module_pdfs_to_chunks.py ${moduleCode}`);
    return 1;
  }

  const python = getPython();
  const runTwoPass = path.join(projectRoot, 'tools', 'modules', 'run_module_two_pass.py');
  const outDir = path.join(projectRoot, 'tools', 'outputs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Running 2-pass generation for ${moduleCode}...`);
  const result = spawnSync(python, [runTwoPass, '--module-code', moduleCode, '--report-dir', outDir], {
    cwd: projectRoot,
    encoding: 'utf-8',
    timeout: 600_000,
    env: { ...process.env, PYTHONPATH: projectRoot },
  });
  if (result.error) {
    console.error('Python 2-pass failed:', result.error.message);
    return 1;
  }
  if (result.status !== 0) {
    console.error('Python 2-pass exited with code', result.status);
    if (result.stderr) console.error(result.stderr);
    return 1;
  }

  const twoPassPath = path.join(outDir, `module_two_pass_${moduleCode}.json`);
  if (!fs.existsSync(twoPassPath)) {
    console.error('2-pass output not found:', twoPassPath);
    return 1;
  }
  const twoPassRaw = fs.readFileSync(twoPassPath, 'utf-8');
  let twoPass: {
    module_code: string;
    module_title: string;
    risk_drivers: Array<{ title?: string; description?: string; evidence?: unknown[] }>;
    questions: Array<{
      question_code?: string;
      question_text?: string;
      applicability?: string;
      discipline_code?: string;
      discipline_subtype_hint?: string;
      why_it_matters?: string;
      evidence?: unknown[];
    }>;
    question_ofcs: Record<string, Array<{ ofc_code?: string; ofc_text?: string; rationale?: string; evidence?: unknown[] }>>;
    export_status: string;
    report?: unknown;
  };
  try {
    twoPass = JSON.parse(twoPassRaw);
  } catch {
    console.error('Invalid JSON in 2-pass output');
    return 1;
  }
  if (twoPass.export_status !== 'OK') {
    console.error('Export status:', twoPass.export_status, twoPass.report);
    return 1;
  }

  // Resolve discipline_id and discipline_subtype_id for each question (requires DB)
  const { getRuntimePool } = await import('../../app/lib/db/runtime_client');
  const { resolveDisciplineSubtypeId } = await import('../../app/lib/modules/resolve_discipline_subtype');
  const { validateModuleExport } = await import('../../app/lib/admin/module_export_validator');

  const runtimePool = getRuntimePool();
  const modRow = await runtimePool.query(
    'SELECT module_code, module_name FROM public.assessment_modules WHERE module_code = $1',
    [moduleCode]
  );
  const moduleName = (modRow.rows[0] as { module_name?: string } | undefined)?.module_name || twoPass.module_title;

  const module_questions: Array<{
    id: string;
    text: string;
    order: number;
    discipline_id: string;
    discipline_subtype_id: string | null;
    asset_or_location: string;
    event_trigger: string;
  }> = [];
  const reportWarnings: string[] = [];
  const prefix = moduleCode.replace('MODULE_', '').replace(/_/g, '').slice(0, 8).toUpperCase() || 'Q';

  for (let i = 0; i < (twoPass.questions || []).length; i++) {
    const q = twoPass.questions[i];
    if (!q || !(q.question_text || '').trim()) continue;
    const discipline_code = (q.discipline_code || 'PER').trim().toUpperCase();
    const discipline_subtype_hint = (q.discipline_subtype_hint || '').trim() || 'General';
    try {
      const resolved = await resolveDisciplineSubtypeId(discipline_code, discipline_subtype_hint);
      if (resolved.warning) reportWarnings.push(`Q ${q.question_code}: ${resolved.warning}`);
      const qId = `MODULEQ_${prefix}_${String(i + 1).padStart(3, '0')}`;
      module_questions.push({
        id: qId,
        text: (q.question_text || '').trim(),
        order: i + 1,
        discipline_id: resolved.discipline_id,
        discipline_subtype_id: resolved.discipline_subtype_id,
        asset_or_location: 'Module Asset',
        event_trigger: 'TAMPERING',
      });
    } catch (e) {
      console.error(`Resolve subtype failed for question ${q.question_code}:`, (e as Error).message);
      return 1;
    }
  }

  const module_ofcs: Array<{
    ofc_id: string;
    ofc_text: string;
    order_index: number;
    question_code?: string;
    sources?: Array<{ url: string; label?: string | null }>;
  }> = [];
  let ofcOrder = 0;
  const questionOfcsMap: Record<string, Array<{ ofc_code?: string; ofc_text?: string }>> = {};
  for (const q of twoPass.questions || []) {
    const qcode = (q.question_code || '').trim();
    if (!qcode) continue;
    const ofcs = twoPass.question_ofcs?.[qcode] || [];
    questionOfcsMap[qcode] = ofcs;
    for (const o of ofcs) {
      const text = (o.ofc_text || '').trim();
      if (!text) continue;
      module_ofcs.push({
        ofc_id: (o.ofc_code || '').trim() || `MOD_OFC_${moduleCode}_${ofcOrder + 1}`,
        ofc_text: text,
        order_index: ofcOrder++,
        question_code: qcode,
        sources: [],
      });
    }
  }

  const exportPayload = {
    module_code,
    title: moduleName,
    description: undefined as string | undefined,
    import_source: `export_${moduleCode}_${new Date().toISOString().split('T')[0]}.json`,
    mode: 'REPLACE' as const,
    module_questions,
    module_ofcs: module_ofcs.map(({ question_code, ...rest }) => rest),
    risk_drivers: (twoPass.risk_drivers || []).map((d) => ({
      driver_type: 'FRAUD_DRIVER' as const,
      driver_text: (d.description || d.title || '').trim() || '(Risk driver)',
    })),
  };

  const validation = validateModuleExport({
    questions: twoPass.questions || [],
    question_ofcs: questionOfcsMap,
    SOURCE_EMPTY: false,
  });
  if (!validation.valid) {
    console.error('Export validation failed:');
    validation.issues.forEach((i) => console.error(' -', i.code, i.message));
    return 1;
  }

  const exportPath = path.join(outDir, `${moduleCode}_export.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportPayload, null, 2), 'utf-8');
  console.log('Wrote', exportPath);

  const reportPath = path.join(outDir, 'module_generation_report.json');
  const existingReport = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf-8')) : {};
  const mergedReport = {
    ...existingReport,
    module_code,
    report: {
      ...(existingReport.report || {}),
      subtype_resolution_warnings: reportWarnings,
      question_count: module_questions.length,
      ofc_count: module_ofcs.length,
    },
  };
  fs.writeFileSync(reportPath, JSON.stringify(mergedReport, null, 2), 'utf-8');
  console.log('Wrote', reportPath);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
