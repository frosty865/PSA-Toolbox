/**
 * Global and per-host concurrency limiters for outbound verification requests.
 * Global: 10 concurrent. Per-host: 2 concurrent.
 */

const GLOBAL_MAX = 10;
const PER_HOST_MAX = 2;

let globalActive = 0;
const hostActive = new Map<string, number>();
const waitQueue: Array<() => void> = [];

function getHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function tryAcquire(): boolean {
  if (globalActive >= GLOBAL_MAX) return false;
  globalActive++;
  return true;
}

function tryAcquireHost(host: string): boolean {
  const n = hostActive.get(host) ?? 0;
  if (n >= PER_HOST_MAX) return false;
  hostActive.set(host, n + 1);
  return true;
}

function release(): void {
  globalActive = Math.max(0, globalActive - 1);
}

function releaseHost(host: string): void {
  const n = (hostActive.get(host) ?? 1) - 1;
  if (n <= 0) hostActive.delete(host);
  else hostActive.set(host, n);
}

/**
 * Run fn with global + per-host concurrency limits. Waits until a slot is free.
 */
export async function withLimiter<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = getHost(url);

  async function waitAndRun(): Promise<T> {
    while (!tryAcquire()) {
      await new Promise<void>((resolve) => waitQueue.push(resolve));
      if (globalActive < GLOBAL_MAX) {
        const next = waitQueue.shift();
        if (next) next();
      }
    }
    while (!tryAcquireHost(host)) {
      await new Promise<void>((r) => setTimeout(r, 100));
    }
    try {
      return await fn();
    } finally {
      releaseHost(host);
      release();
      const next = waitQueue.shift();
      if (next) next();
    }
  }

  return waitAndRun();
}
