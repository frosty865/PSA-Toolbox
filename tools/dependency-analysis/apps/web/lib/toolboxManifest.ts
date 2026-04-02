import fs from 'fs';
import path from 'path';

/** Synced from repo root by `scripts/sync-toolbox-manifest.cjs` before build; bundled at compile time. */
import bundledToolboxManifest from '@/data/tools-manifest.json';

export type ToolboxManifestTool = {
  id: string;
  displayName: string;
  relativePath: string;
  description: string;
  readmeRelativePath?: string;
  entryPath?: string;
  externalUrl?: string;
  start?: { kind: string; scriptRelativePath?: string; arguments?: string[] };
};

export type ToolboxManifest = {
  version: number;
  tools: ToolboxManifestTool[];
};

function getRepoRoot(): string {
  const env = process.env.PSA_TOOLBOX_ROOT?.trim();
  if (env) return path.resolve(env);

  const walk = (start: string, maxUp: number): string | null => {
    let cur = path.resolve(start);
    for (let i = 0; i <= maxUp; i++) {
      const manifest = path.join(cur, 'tools-manifest.json');
      try {
        if (fs.existsSync(manifest)) return cur;
      } catch {
        /* ignore */
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return null;
  }

  const fromCwd = walk(process.cwd(), 8);
  if (fromCwd) return fromCwd;

  // apps/web → four levels up to repo root when dev cwd is apps/web
  return path.resolve(process.cwd(), '..', '..', '..', '..');
}

export async function loadToolboxManifest(): Promise<ToolboxManifest | null> {
  const env = process.env.PSA_TOOLBOX_ROOT?.trim();
  if (env) {
    try {
      const p = path.join(path.resolve(env), 'tools-manifest.json');
      const raw = await fs.promises.readFile(p, 'utf8');
      return JSON.parse(raw) as ToolboxManifest;
    } catch {
      return null;
    }
  }
  try {
    const root = getRepoRoot();
    const p = path.join(root, 'tools-manifest.json');
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw) as ToolboxManifest;
  } catch {
    return bundledToolboxManifest as ToolboxManifest;
  }
}

export async function getToolById(id: string): Promise<ToolboxManifestTool | null> {
  const manifest = await loadToolboxManifest();
  if (!manifest) return null;
  return manifest.tools.find((t) => t.id === id) ?? null;
}
