/**
 * Persist assessment to localStorage so state survives across browser sessions.
 * Canonical key stores full ProgressFileV2 (assessment + sessions).
 */
import type { Assessment } from 'schema';
import { buildProgressFileV2 } from './progressFile';
import { parseProgressFile } from './progressFile';
import { collectAllSessionsFromLocalStorage } from './collectSessions';
import { clearAllSessionsFromLocalStorage } from './collectSessions';
import { writeSessionsToPerTabStorage } from './writeSessionsToStorage';
import { syncAssessmentCategoriesToPerTabStorage } from './syncAssessmentToSessions';
import { normalizeCurveStorage } from '@/app/lib/assessment/normalize_curve_storage';
import { sanitizeAssessmentBeforeSave } from '@/app/lib/assessment/sanitize_assessment';
import { migrateReportThemedFindingsFromCategories } from '@/app/lib/assessment/migrate_report_themed_findings';

const STORAGE_KEY = 'asset-dependency-assessment';

const storage = typeof window !== 'undefined' ? localStorage : null;

export function loadAssessmentFromLocal(): Assessment | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const result = parseProgressFile(raw);
    if (!result.ok) return null;
    // Assessment categories are source of truth on load. Per-tab sessions are storage artifacts
    // and must not override assessment answers.
    clearAllSessionsFromLocalStorage();
    if (Object.keys(result.sessions).length > 0) {
      writeSessionsToPerTabStorage(result.sessions);
    }
    syncAssessmentCategoriesToPerTabStorage(result.assessment);
    migrateReportThemedFindingsFromCategories(result.assessment);
    return normalizeCurveStorage(result.assessment);
  } catch {
    return null;
  }
}

/**
 * When canonical key is missing: collect sessions from per-tab storage and write
 * a unified ProgressFileV2 so the next save won't lose per-tab data.
 * Returns null so caller uses default assessment; per-tab data remains in per-tab keys.
 */
export function repairCanonicalFromPerTabIfMissing(assessment: Assessment): void {
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw != null && raw !== '') return;
    const sessions = collectAllSessionsFromLocalStorage();
    if (Object.keys(sessions).length === 0) return;
    const state = buildProgressFileV2(sanitizeAssessmentBeforeSave(assessment), sessions);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function saveAssessmentToLocal(assessment: Assessment): void {
  if (!storage) return;
  try {
    // Use sessions as source of truth for dependency form data (IT, Energy, etc.).
    // Do NOT sync assessment → sessions here: that would overwrite fresh form data
    // with stale assessment.categories when user edits on standalone dependency pages.
    const sessions = collectAllSessionsFromLocalStorage();
    const state = buildProgressFileV2(sanitizeAssessmentBeforeSave(assessment), sessions);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota or serialization errors
  }
}

/** Remove assessment from localStorage (wipe local data). Call onClear after to reset in-memory state. */
export function wipeLocalAssessment(): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

