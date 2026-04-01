import type { Assessment } from 'schema';

/** Returns true only when the PRA/SLA module toggle is explicitly enabled. */
export function isPraSlaEnabled(assessment: Assessment): boolean {
  return assessment.settings?.pra_sla_enabled === true;
}
