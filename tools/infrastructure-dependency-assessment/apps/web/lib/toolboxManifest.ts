import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

export type ToolboxManifestTool = {
  id: string;
  displayName: string;
  relativePath: string;
  description: string;
  readmeRelativePath?: string;
  /** Same-origin path for this dev server (respect next.config trailingSlash). */
  entryPath?: string;
  /** Optional absolute URL when the tool is served elsewhere. */
  externalUrl?: string;
  start?: {
    kind: string;
    scriptRelativePath: string;
    arguments?: string[];
  };
};

export type ToolboxManifest = {
  version: number;
  tools: ToolboxManifestTool[];
};

const MANIFEST_NAME = 'tools-manifest.json';

/**
 * Walks up from cwd (and honors PSA_TOOLBOX_ROOT) to find the repo-root manifest.
 */
export function findToolboxManifestPath(): string | null {
  const envRoot = process.env.PSA_TOOLBOX_ROOT?.trim();
  if (envRoot) {
    const p = path.join(envRoot, MANIFEST_NAME);
    if (fs.existsSync(p)) return p;
  }

  let dir = process.cwd();
  for (let i = 0; i < 16; i++) {
    const candidate = path.join(dir, MANIFEST_NAME);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export async function loadToolboxManifest(): Promise<ToolboxManifest | null> {
  const manifestPath = findToolboxManifestPath();
  if (!manifestPath) return null;
  try {
    const raw = await fsPromises.readFile(manifestPath, 'utf8');
    const data = JSON.parse(raw) as ToolboxManifest;
    if (!data || typeof data.version !== 'number' || !Array.isArray(data.tools)) return null;
    return data;
  } catch {
    return null;
  }
}
