/**
 * Merge Library OFC injections into dependency VOFC rows.
 * Reads data/library_ofc_injections.json when present and augments rows with Library OFCs.
 */
import path from 'path';
import fs from 'fs/promises';
import { getRepoRoot } from '@/app/lib/template/path';
import type { DependencyVofcRow } from './dependency_vofc_repo';

const MAX_OFCS = 3;

interface LibraryInjection {
  condition_code?: string;
  id?: string;
  infrastructure: string;
  source_type: string;
  source_reference: string;
  library_ofcs: string[];
  library_citations?: string[];
}

interface LibraryPayload {
  injections?: LibraryInjection[];
  library_rows?: Array<{
    condition_code: string;
    infrastructure: string;
    ofc_1?: string;
    ofc_2?: string;
    ofc_3?: string;
    ofc_4?: string;
    source_type: string;
    source_reference: string;
  }>;
}

function getLibraryInjectionsPath(): string {
  return path.join(getRepoRoot(), 'data', 'library_ofc_injections.json');
}

/**
 * Load library injections from JSON. Returns null if file missing or invalid.
 */
export async function loadLibraryInjections(): Promise<LibraryPayload | null> {
  const p = getLibraryInjectionsPath();
  try {
    const buf = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(buf) as LibraryPayload;
    return data;
  } catch {
    return null;
  }
}

/**
 * Merge Library OFCs into dependency rows.
 * For each row, if an injection exists for that condition_code, append library OFCs
 * to fill ofc_2..ofc_4 slots (max 4 total). Preserves existing OFCs.
 */
export function mergeLibraryOfcsIntoRows(
  rows: DependencyVofcRow[],
  payload: LibraryPayload | null
): DependencyVofcRow[] {
  if (!payload) return rows;

  const byCode = new Map<string, LibraryInjection>();
  for (const inj of payload.injections ?? []) {
    const key = (inj.condition_code ?? inj.id ?? '').trim();
    if (key) {
      byCode.set(key, inj);
    }
  }

  if (byCode.size === 0) return rows;

  return rows.map((row) => {
    const inj = byCode.get(row.condition_code);
    if (!inj?.library_ofcs?.length) return row;

    const existing = [row.ofc_1, row.ofc_2, row.ofc_3, row.ofc_4]
      .filter((o): o is string => !!o?.trim());
    const toAdd = inj.library_ofcs
      .filter((o) => o?.trim())
      .filter((o) => !existing.some((e) => e.toLowerCase() === o.toLowerCase().trim()));
    const combined = [...existing];
    for (const o of toAdd) {
      if (combined.length >= MAX_OFCS) break;
      combined.push(o.trim());
    }

    return {
      ...row,
      ofc_1: combined[0],
      ofc_2: combined[1],
      ofc_3: combined[2],
      ofc_4: combined[3],
    };
  });
}
