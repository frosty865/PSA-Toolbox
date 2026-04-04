/**
 * Hosted continuity: 4-state (NO_CONTINUITY, LOCAL_MIRROR_OR_CACHE, ALTERNATE_PLATFORM_OR_PROVIDER, UNKNOWN).
 * Migrates legacy checklist/evidence and old 3-state (NONE, MANUAL_FALLBACK, LOCAL_MIRROR) to new enum.
 * Unanswered = survivability undefined (no default).
 */
import type { HostedContinuitySurvivability } from 'schema';

export type HostedContinuityEntry = {
  survivability?: HostedContinuitySurvivability;
  notes?: string;
};

/** Map legacy or partial entry to survivability + notes. Unanswered leaves survivability undefined. */
export function migrateHostedResilienceEntry(raw: unknown): HostedContinuityEntry {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const notes = typeof o.notes === 'string' ? o.notes : undefined;
  const s = o.survivability;
  if (s === 'NO_CONTINUITY' || s === 'LOCAL_MIRROR_OR_CACHE' || s === 'ALTERNATE_PLATFORM_OR_PROVIDER' || s === 'UNKNOWN') {
    return { survivability: s as HostedContinuitySurvivability, notes };
  }
  if (s === 'NONE') return { survivability: 'NO_CONTINUITY', notes };
  if (s === 'LOCAL_MIRROR') return { survivability: 'LOCAL_MIRROR_OR_CACHE', notes };
  if (s === 'MANUAL_FALLBACK') return { survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER', notes };
  const localMirror = o.local_mirror_or_offline_fallback === true || o.local_data_export === true;
  const alternate =
    o.continuity_mechanism_in_place === true ||
    o.offline_fallback === true ||
    o.origin_failover === true ||
    o.multi_pop === true ||
    o.secondary_dns === true;
  if (localMirror) return { survivability: 'LOCAL_MIRROR_OR_CACHE', notes };
  if (alternate) return { survivability: 'ALTERNATE_PLATFORM_OR_PROVIDER', notes };
  return { notes };
}

const CONTINUITY_LABELS: Record<HostedContinuitySurvivability, string> = {
  NO_CONTINUITY: 'No continuity',
  LOCAL_MIRROR_OR_CACHE: 'Local mirror/cache',
  ALTERNATE_PLATFORM_OR_PROVIDER: 'Alternate platform/provider',
  UNKNOWN: 'Unknown',
};

/** Format Continuity column for report. Undefined = "Not assessed". */
export function formatHostedResilienceForReport(entry: unknown): string {
  const { survivability } = migrateHostedResilienceEntry(entry);
  if (survivability === undefined) return 'Not assessed';
  return CONTINUITY_LABELS[survivability];
}
