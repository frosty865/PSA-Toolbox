/**
 * Select chunks for SCO generation: exclude deep network/technical cyber, allow convergence.
 * Enforces per-source cap and fails fast if insufficient PSA-scope content remains.
 */

import { containsDeepNetworkCyber } from "@/app/lib/scope/psa_scope_filter";

export const MIN_REQUIRED_CHUNKS = 30;

export class STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL extends Error {
  constructor(
    message: string,
    public readonly counts: {
      total: number;
      excluded_deep_network: number;
      remaining: number;
      by_source: Record<string, number>;
    }
  ) {
    super(message);
    this.name = "STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL";
  }
}

export interface ChunkForSelection {
  text?: string;
  chunk_text?: string;
  source_registry_id?: string;
  doc_id?: string;
  [k: string]: unknown;
}

export interface SelectChunksResult {
  chunks: ChunkForSelection[];
  excluded_deep_network: number;
  remaining: number;
  by_source: Record<string, number>;
}

/**
 * Filter chunks for SCO generation: exclude deep network cyber, apply per-source cap.
 * @param chunks - Raw chunks (must have text or chunk_text)
 * @param totalWanted - Max chunks to return (e.g. from env or 80)
 * @param minRequired - Minimum chunks required after filtering (default MIN_REQUIRED_CHUNKS)
 * @throws STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL if remaining < minRequired
 */
export function selectChunksForGeneration(
  chunks: ChunkForSelection[],
  totalWanted: number,
  minRequired: number = MIN_REQUIRED_CHUNKS
): SelectChunksResult {
  const bySource = new Map<string, ChunkForSelection[]>();
  let excluded_deep_network = 0;

  for (const c of chunks) {
    const t = (c.text ?? c.chunk_text ?? "") as string;
    if (!t.trim()) continue;
    if (containsDeepNetworkCyber(t)) {
      excluded_deep_network++;
      continue;
    }
    const sourceKey = (c.source_registry_id ?? c.doc_id ?? "unknown") as string;
    if (!bySource.has(sourceKey)) bySource.set(sourceKey, []);
    bySource.get(sourceKey)!.push(c);
  }

  const maxChunksPerSource = Math.min(60, Math.floor(totalWanted * 0.6));
  const selected: ChunkForSelection[] = [];
  const by_source: Record<string, number> = {};

  for (const [src, list] of bySource) {
    const capped = list.slice(0, maxChunksPerSource);
    by_source[src] = capped.length;
    for (const c of capped) {
      if (selected.length >= totalWanted) break;
      selected.push(c);
    }
    if (selected.length >= totalWanted) break;
  }

  const remaining = selected.length;

  if (remaining < minRequired) {
    const total = chunks.filter((c) => ((c.text ?? c.chunk_text) as string)?.trim()).length;
    throw new STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL(
      `Insufficient PSA-scope content after excluding deep network/technical cyber. Need at least ${minRequired} chunks; got ${remaining}. Excluded ${excluded_deep_network} deep-network-cyber chunk(s).`,
      {
        total,
        excluded_deep_network,
        remaining,
        by_source,
      }
    );
  }

  return {
    chunks: selected,
    excluded_deep_network,
    remaining,
    by_source,
  };
}
