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
    return path.join(cwd, 'tools', 'dependency-analysis');
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

/**
 * Template locations seen in this workspace family.
 * Prefer the checked-in reporter template under public/hotel-analysis, but keep
 * the legacy ADA path as a fallback so older layouts still work.
 */
export const TEMPLATE_RELATIVE_CANDIDATES = [
  path.join('apps', 'web', 'public', 'hotel-analysis', 'Assets', 'report template.docx'),
  path.join('ADA', 'report template.docx'),
] as const;

/**
 * Path to the production DOCX template for a given repo root.
 * Returns the first template candidate that exists, falling back to the primary
 * candidate when none are present.
 */
export function getCanonicalTemplatePath(repoRoot: string): string {
  for (const relative of TEMPLATE_RELATIVE_CANDIDATES) {
    const candidate = path.join(repoRoot, relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(repoRoot, TEMPLATE_RELATIVE_CANDIDATES[0]);
}

/**
 * Asserts path is one of the known template locations. Use before export/check.
 */
export function assertCanonicalTemplatePath(templatePath: string): void {
  const normalized = templatePath.replace(/\\/g, '/');
  const allowed = TEMPLATE_RELATIVE_CANDIDATES.map((relative) => relative.replace(/\\/g, '/'));
  if (!allowed.some((relative) => normalized.endsWith(relative))) {
    throw new Error(`Wrong template: export must use a known report template. Got: ${templatePath}`);
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
