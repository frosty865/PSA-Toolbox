import path from 'path';
import { existsSync } from 'fs';

/**
 * Path to the reporter executable. Used by export routes and runExport.
 * - ADA_REPORTER_EXE: deployment; if relative, resolved against repoRoot (e.g. resources/reporter.exe)
 * - Standalone ADT: resources/reporter.exe under app root
 * - Default (dev): apps/reporter/dist/reporter.exe
 */
export function getReporterPath(repoRoot: string): string {
  const envPath = process.env.ADA_REPORTER_EXE;
  if (envPath) {
    return path.isAbsolute(envPath) ? path.resolve(envPath) : path.join(repoRoot, envPath);
  }
  const standaloneExe = path.join(repoRoot, 'resources', 'reporter.exe');
  if (existsSync(standaloneExe)) return standaloneExe;
  return path.join(repoRoot, 'apps', 'reporter', 'dist', 'reporter.exe');
}
