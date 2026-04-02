import "server-only";

import * as fs from "fs/promises";

type CacheEntry<T> = {
  version: string;
  expiresAtMs: number;
  payload: T;
};

type DiskEntry<T> = {
  version: string;
  createdAtMs: number;
  payload: T;
};

const mem = new Map<string, CacheEntry<unknown>>();

function cacheVersion(): string {
  return (process.env.REFERENCE_IMPL_CACHE_VERSION?.trim() || "v1");
}

function ttlMs(): number {
  const s = Number(process.env.REFERENCE_IMPL_CACHE_TTL_SECONDS ?? "86400");
  if (!Number.isFinite(s) || s <= 0) return 24 * 60 * 60 * 1000;
  return s * 1000;
}

function cacheDir(): string {
  const dir = process.env.REFERENCE_IMPL_CACHE_DIR?.trim() || "storage/cache/reference_impl";
  // Return as-is (relative or absolute); fs.mkdir/readFile/writeFile accept both.
  // Avoid path.resolve() here — it triggers Turbopack broad file tracing.
  return dir;
}

function diskPath(key: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- avoid top-level path for Turbopack
  const path = require("path") as typeof import("path");
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(cacheDir(), `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(cacheDir(), { recursive: true });
}

export type CacheResult<T> =
  | { payload: T; cache: "MEM" | "DISK" | "MISS" }
  | { error: string; cache: "MEM" | "DISK" | "MISS" };

export async function getOrCompute<T>(
  key: string,
  compute: () => Promise<T>
): Promise<CacheResult<T>> {
  const now = Date.now();
  const v = cacheVersion();

  // MEM
  const m = mem.get(key);
  if (m && m.version === v && m.expiresAtMs > now) {
    return { payload: m.payload as T, cache: "MEM" };
  }

  // DISK
  try {
    const p = diskPath(key);
    const raw = await fs.readFile(p, "utf-8").catch(() => null);
    if (raw) {
      const parsed = JSON.parse(raw) as DiskEntry<T>;
      const age = now - Number(parsed.createdAtMs || 0);
      if (parsed.version === v && age >= 0 && age < ttlMs()) {
        mem.set(key, { version: v, expiresAtMs: now + ttlMs(), payload: parsed.payload });
        return { payload: parsed.payload, cache: "DISK" };
      }
    }
  } catch {
    // ignore disk read/parse errors; treat as MISS
  }

  // MISS => compute
  try {
    const payload = await compute();

    // best-effort persist
    try {
      await ensureDir();
      const entry: DiskEntry<T> = { version: v, createdAtMs: now, payload };
      await fs.writeFile(diskPath(key), JSON.stringify(entry), "utf-8");
    } catch {
      // ignore disk failures
    }

    mem.set(key, { version: v, expiresAtMs: now + ttlMs(), payload });
    return { payload, cache: "MISS" };
  } catch (e: unknown) {
    return { error: String((e as Error)?.message ?? e), cache: "MISS" };
  }
}
