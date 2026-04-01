/**
 * Shared typed helpers for Node test scripts. No DOM types.
 */
import { mkdir, rm } from 'node:fs/promises';

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export async function safeRm(p: string): Promise<void> {
  try {
    await rm(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
