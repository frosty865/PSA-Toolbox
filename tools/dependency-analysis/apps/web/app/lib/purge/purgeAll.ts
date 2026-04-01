/**
 * Hard "no retention" purge: data/temp only + OS temp entries with prefix PSA-IDA-.
 * Call on server start, after every export, and on import failure.
 */
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { getRepoRoot } from '@/app/lib/template/path';

const PREFIX_OS_TEMP = 'PSA-IDA-';

export { getRepoRoot };

/**
 * Delete all contents under data/temp. Safe: only allows path under repo/data/temp.
 */
async function purgeDataTemp(repoRoot: string): Promise<void> {
  const resolved = path.resolve(repoRoot);
  const dataTemp = path.join(resolved, 'data', 'temp');
  // Only allow deletion under repo/data/temp
  const rel = path.relative(resolved, dataTemp);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;
  try {
    const entries = await fs.readdir(dataTemp, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      await fs.rm(path.join(dataTemp, e.name), { recursive: true }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Delete any file or directory under OS temp whose name starts with PSA-IDA-.
 */
async function purgeOsTempPrefix(): Promise<void> {
  const tmpDir = os.tmpdir();
  try {
    const entries = await fs.readdir(tmpDir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.name.startsWith(PREFIX_OS_TEMP)) {
        await fs.rm(path.join(tmpDir, e.name), { recursive: true }).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Run full purge: data/temp + OS temp PSA-IDA-*.
 * Pass repoRoot when available; otherwise uses getRepoRoot().
 * On Vercel, skip repo data/temp (read-only filesystem).
 */
export async function purgeAll(repoRoot?: string): Promise<void> {
  if (process.env.VERCEL !== '1') {
    const root = path.resolve(repoRoot ?? getRepoRoot());
    await purgeDataTemp(root);
  }
  await purgeOsTempPrefix();
}
