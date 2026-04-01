/**
 * Persist IT dependency answers and derived findings to localStorage.
 */
import type { DependencySessionSnapshot } from './sessionTypes';

const STORAGE_KEY = 'it:storage';

const storage = typeof window !== 'undefined' ? localStorage : null;

export function loadItSession(): DependencySessionSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && parsed !== null && 'answers' in parsed && 'saved_at_iso' in parsed) {
      const p = parsed as Record<string, unknown>;
      if (typeof p.answers === 'object' && p.answers !== null && typeof p.saved_at_iso === 'string') {
        return parsed as DependencySessionSnapshot;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveItSession(snapshot: DependencySessionSnapshot): void {
  if (!storage) return;
  try {
    const toSave = {
      ...snapshot,
      saved_at_iso: snapshot.saved_at_iso ?? new Date().toISOString(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}

export function clearItSession(): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
