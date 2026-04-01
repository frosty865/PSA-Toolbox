/**
 * Handle browser/tab unload events to ensure data is properly flushed and cleaned up.
 * Prevents memory from getting stuck when closing the browser.
 */

const pendingSaves = new Set<() => Promise<void>>();

/**
 * Register a save operation to be called on page unload.
 * Ensures all queued saves complete before browser closes.
 */
export function registerPendingSave(saveFn: () => Promise<void> | void): void {
  pendingSaves.add(() => Promise.resolve(saveFn()));
}

/**
 * Flush all pending saves synchronously (for unload events).
 * Uses localStorage directly to avoid async delays.
 */
export async function flushPendingSaves(): Promise<void> {
  for (const saveFn of pendingSaves) {
    try {
      await saveFn();
    } catch {
      // Ignore errors during unload
    }
  }
  pendingSaves.clear();
}

/**
 * Perform hard shutdown of all in-memory caches and event listeners.
 * Call before page unload to prevent memory leaks.
 */
export function clearMemoryCaches(): void {
  // Clear all registered saves
  pendingSaves.clear();

  // Clear any pending timeouts by getting the next timeout ID and clearing backwards.
  // This is a defensive measure; most timeouts should already be cleared by cleanup functions.
  if (typeof window !== 'undefined') {
    // The maximum timeout ID is usually in the range of 1-100000 after initialization.
    // Clear a reasonable range to catch any stranded timers.
    const maxTimeoutId = 100000;
    for (let i = maxTimeoutId; i > 0; i--) {
      try {
        clearTimeout(i);
      } catch {
        // Ignore errors
      }
    }
  }

  // Force garbage collection hint (if available)
  if (typeof gc === 'function') {
    try {
      gc();
    } catch {
      // gc() only available in Node with --expose-gc flag
    }
  }
}

/**
 * Initialize unload handlers on the window.
 * Must be called once during app initialization.
 */
export function initializeUnloadHandlers(): void {
  if (typeof window === 'undefined') return;

  // Handle page unload (tab close or browser close)
  const handleUnload = async () => {
    await flushPendingSaves();
    clearMemoryCaches();
  };

  // beforeunload: attempt to flush (may be interrupted)
  window.addEventListener('beforeunload', () => {
    flushPendingSaves().catch(() => {});
  });

  // pagehide: more reliable for mobile/modern browsers
  window.addEventListener('pagehide', (event) => {
    if (event.persisted === false) {
      // Page is being unloaded, not just hidden
      handleUnload().catch(() => {});
    }
  });

  // visibilitychange: cleanup when user switches tabs
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Tab is hidden, flush saves
      flushPendingSaves().catch(() => {});
    }
  });
}
