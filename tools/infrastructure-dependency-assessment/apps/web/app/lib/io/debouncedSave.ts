/**
 * Debounced save operations to prevent excessive localStorage writes.
 * Batches multiple rapid changes into single saves.
 */

interface DebounceConfig {
  delayMs?: number;
  maxWaitMs?: number;
}

export function createDebouncedsave<T extends any[]>(
  saveFn: (...args: T) => void | Promise<void>,
  config: DebounceConfig = {}
): [...args: T & any[], flush: () => void] {
  const { delayMs = 1500, maxWaitMs = 5000 } = config;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCallTime = 0;
  let pendingArgs: T | null = null;

  const wrappedSave = (...args: T) => {
    const now = Date.now();
    pendingArgs = args;

    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // If we've been waiting too long (maxWait), execute immediately
    if (now - lastCallTime >= maxWaitMs) {
      saveFn(...args);
      lastCallTime = now;
      timeoutId = null;
      pendingArgs = null;
      return;
    }

    // Schedule a save
    timeoutId = setTimeout(() => {
      if (pendingArgs) {
        saveFn(...pendingArgs);
        lastCallTime = Date.now();
      }
      timeoutId = null;
      pendingArgs = null;
    }, delayMs);
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingArgs) {
      saveFn(...pendingArgs);
      lastCallTime = Date.now();
      pendingArgs = null;
    }
  };

  return [wrappedSave as any, flush as any];
}

/**
 * Create a simple debounced function that delays execution.
 */
export function createDebouncedFn<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 1500
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}
