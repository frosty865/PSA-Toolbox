/**
 * Client-side purge of all persisted state.
 * Used for static export builds (no server) and as the primary purge path.
 * Clears localStorage keys and IndexedDB (best-effort).
 */
export type PurgeResult = { ok: true } | { ok: false; error: string };

const LOCAL_STORAGE_KEYS = [
  'asset-dependency-assessment',
  'asset-dependency-energy',
  'comms:storage',
  'water:storage',
  'wastewater:storage',
  'it:storage',
] as const;

export async function purgeAllLocalState(): Promise<PurgeResult> {
  if (typeof window === 'undefined') {
    return { ok: true };
  }
  try {
    for (const key of LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }

    // Best-effort IndexedDB cleanup (if any DBs exist in future)
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      } catch {
        // Ignore; IndexedDB may be blocked or unavailable
      }
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
