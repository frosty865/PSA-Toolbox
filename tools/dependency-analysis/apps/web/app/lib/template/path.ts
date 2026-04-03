import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Application root directory. Used for standalone IDT (Infrastructure Dependency Tool) and dev/monorepo.
 * - IDT_APP_ROOT / IDT_ROOT preferred; legacy ADT_APP_ROOT / ADT_ROOT still supported.
 * - Standalone deployment can live anywhere (e.g. C:\IDT or D:\Tools\IDT); no installs, path-agnostic.
 * - Otherwise: repo root when running from apps/web, monorepo root, or parent workspace (e.g. d:\ADA).
 */
export function getRepoRoot(): string {
  const appRoot =
    process.env.IDT_APP_ROOT ??
    process.env.IDT_ROOT ??
    process.env.ADT_APP_ROOT ??
    process.env.ADT_ROOT;
  if (appRoot) return path.resolve(appRoot);

  const cwd = process.cwd();
  const dirName = path.basename(cwd);
  if (fs.existsSync(path.join(cwd, 'tools-manifest.json'))) {
    const appRoot = path.join(cwd, 'tools', 'dependency-analysis');
    if (fs.existsSync(path.join(appRoot, 'ADA', 'report template.docx'))) return appRoot;
    return cwd;
  }
  if (dirName === 'asset-dependency-tool') return cwd;
  if (dirName === 'web') {
    const parent = path.dirname(cwd);
    if (path.basename(parent) === 'apps') return path.join(cwd, '..', '..');
  }
  const candidate = path.join(cwd, 'asset-dependency-tool');
  if (fs.existsSync(path.join(candidate, 'apps', 'reporter', 'main.py'))) return candidate;
  return path.join(cwd, '..', '..');
}

const MAIN_PY_RELATIVE = path.join('apps', 'reporter', 'main.py');

/**
 * Repo root used for export: first root where apps/reporter/main.py exists.
 * Use this so export and template check use the same root (and same template path).
 */
export function findRootWithReporter(): string {
  const root = getRepoRoot();
  if (fs.existsSync(path.join(root, MAIN_PY_RELATIVE))) return root;
  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.join(cwd, '..'),
    path.join(cwd, '..', '..'),
    path.join(cwd, 'asset-dependency-tool'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, MAIN_PY_RELATIVE))) return path.resolve(dir);
  }
  return root;
}

/** Canonical anchor template: [[SNAPSHOT_*]], [[INFRA_*]] tokens. Single source for export. */
export const CANONICAL_TEMPLATE_RELATIVE = path.join('ADA', 'report template.docx');

/**
 * Path to the production DOCX template for a given repo root.
 * Use this with findRootWithReporter() so export and template check use the same root.
 */
export function getCanonicalTemplatePath(repoRoot: string): string {
  return path.join(repoRoot, CANONICAL_TEMPLATE_RELATIVE);
}

/**
 * Asserts path is the canonical template (ADA/report template.docx). Use before export/check.
 */
export function assertCanonicalTemplatePath(templatePath: string): void {
  const normalized = templatePath.replace(/\\/g, '/');
  if (!normalized.endsWith('ADA/report template.docx')) {
    throw new Error(`Wrong template: export must use ADA/report template.docx. Got: ${templatePath}`);
  }
}

/**
 * Path to the production DOCX template. Uses getRepoRoot(); for export use getCanonicalTemplatePath(findRootWithReporter()) instead.
 */
export function getTemplatePath(): string {
  return getCanonicalTemplatePath(getRepoRoot());
}

/**
 * Base directory for export temp files. On Vercel uses os.tmpdir() (writable); otherwise repo data/temp.
 * Use this so we never mkdir under read-only /var/task on Vercel.
 */
export function getWritableTempBase(repoRoot: string): string {
  if (process.env.VERCEL === '1') {
    return path.join(os.tmpdir(), 'ada-export');
  }
  return path.join(path.resolve(repoRoot), 'data', 'temp');
}
