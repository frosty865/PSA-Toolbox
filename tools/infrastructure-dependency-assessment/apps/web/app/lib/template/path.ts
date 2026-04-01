import path from 'path';
import os from 'os';

/**
 * Application root directory. Used for standalone ADT (Asset Dependency Tool) and dev/monorepo.
 * - ADT_APP_ROOT or ADT_ROOT: standalone deployment (e.g. C:\ADT or D:\Tools\ADT); no installs, path-agnostic.
 * - Otherwise: repo root when running from apps/web, monorepo root, or parent workspace (e.g. d:\ADA).
 */
export function getRepoRoot(): string {
  const appRoot = process.env.ADT_APP_ROOT ?? process.env.ADT_ROOT;
  if (appRoot) return path.resolve(appRoot);

  const cwd = process.cwd();
  const dirName = path.basename(cwd);
  if (dirName === 'asset-dependency-tool') return path.resolve(cwd);
  if (dirName === 'web') {
    const parent = path.dirname(cwd);
    if (path.basename(parent) === 'apps') return path.resolve(cwd, '..', '..');
  }
  return path.resolve(cwd);
}

/** Canonical anchor template: [[SNAPSHOT_*]], [[INFRA_*]] tokens. Single source for export. */
export const CANONICAL_TEMPLATE_RELATIVE = path.join('ADA', 'report template.docx');

/**
 * Path to the production DOCX template for a given repo root.
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
 * Path to the production DOCX template.
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
