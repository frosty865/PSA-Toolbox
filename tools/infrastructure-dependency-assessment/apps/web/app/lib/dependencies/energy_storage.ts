/**
 * Persist energy dependency answers and derived findings to localStorage.
 * Persistent: data survives browser restarts and navigation between pages.
 */
import type { EnergyAnswers } from './infrastructure/energy_spec';
import type { EnergyDerivedFindings } from './derive_energy_findings';

const STORAGE_KEY = 'asset-dependency-energy';

const storage = typeof window !== 'undefined' ? localStorage : null;

export type EnergyStoragePayload = {
  answers: EnergyAnswers;
  derived: EnergyDerivedFindings;
  saved_at_iso: string;
};

export function loadEnergyFromLocal(): EnergyStoragePayload | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as EnergyStoragePayload).derived?.vulnerabilities) &&
      Array.isArray((parsed as EnergyStoragePayload).derived?.ofcs) &&
      Array.isArray((parsed as EnergyStoragePayload).derived?.reportBlocks)
    ) {
      return parsed as EnergyStoragePayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveEnergyToLocal(payload: Omit<EnergyStoragePayload, 'saved_at_iso'>): void {
  if (!storage) return;
  try {
    const toSave: EnergyStoragePayload = {
      ...payload,
      saved_at_iso: new Date().toISOString(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // ignore
  }
}
