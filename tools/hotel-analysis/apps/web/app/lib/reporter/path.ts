import path from 'path';
import { existsSync } from 'fs';

/**
 * Legacy reporter-executable path helper.
 * The production DOCX service is now hosted separately in PSA-report-service.
 * Keep only for archival/local tooling that still expects a packaged exe.
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
