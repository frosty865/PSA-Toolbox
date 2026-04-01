import type { Assessment } from 'schema';

/** Returns true only when cross-dependency output is explicitly enabled. */
export function isCrossDependencyEnabled(assessment: Assessment | null | undefined): boolean {
  return assessment?.settings?.cross_dependency_enabled === true;
}
