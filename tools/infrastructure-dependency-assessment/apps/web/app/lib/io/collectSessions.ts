/**
 * Collect all per-tab sessions from localStorage into a DependencySessionsMap.
 * Used when saving the canonical assessment key.
 */
import type { DependencySessionsMap, DependencySessionSnapshot } from './sessionTypes';
import { loadEnergyFromLocal } from '@/app/lib/dependencies/energy_storage';
import { loadWaterSession } from './water_storage';
import { loadWastewaterSession } from './wastewater_storage';
import { loadItSession } from './it_storage';

function loadCommsFromLocal(): { answers: Record<string, unknown>; derived?: unknown; saved_at_iso?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('comms:storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && parsed !== null && 'answers' in parsed) {
      const p = parsed as Record<string, unknown>;
      if (typeof p.answers === 'object' && p.answers !== null) {
        return {
          answers: p.answers as Record<string, unknown>,
          derived: p.derived,
          saved_at_iso: typeof p.saved_at_iso === 'string' ? p.saved_at_iso : new Date().toISOString(),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function collectAllSessionsFromLocalStorage(): DependencySessionsMap {
  const sessions: DependencySessionsMap = {};

  const energy = loadEnergyFromLocal();
  if (energy?.answers && energy.saved_at_iso) {
    sessions.ELECTRIC_POWER = {
      answers: energy.answers as Record<string, unknown>,
      derived: energy.derived as DependencySessionSnapshot['derived'],
      saved_at_iso: energy.saved_at_iso,
    };
  }

  const comms = loadCommsFromLocal();
  if (comms?.answers) {
    sessions.COMMUNICATIONS = {
      answers: comms.answers,
      derived: comms.derived as DependencySessionSnapshot['derived'],
      saved_at_iso: comms.saved_at_iso ?? new Date().toISOString(),
    };
  }

  const water = loadWaterSession();
  if (water) {
    sessions.WATER = water;
  }

  const wastewater = loadWastewaterSession();
  if (wastewater) {
    sessions.WASTEWATER = wastewater;
  }

  const it = loadItSession();
  if (it) {
    sessions.INFORMATION_TECHNOLOGY = it;
  }

  return sessions;
}

/**
 * Clear per-tab dependency session storage keys.
 * Used when resetting local state so stale tab payloads cannot bleed into a new assessment.
 */
export function clearAllSessionsFromLocalStorage(): void {
  if (typeof window === 'undefined') return;
  const keys = [
    'asset-dependency-energy',
    'comms:storage',
    'water:storage',
    'wastewater:storage',
    'it:storage',
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore localStorage failures
    }
  }
}
