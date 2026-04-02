/**
 * Generate module content (questions and OFCs) from exported chunks.
 *
 * The legacy Python-backed generator has been retired from the deployed app.
 * Keep the offline module-crawler tooling for local generation workflows.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { guardModuleQuery } from '@/app/lib/modules/table_access_guards';
import {
  selectChunksForGeneration,
  MIN_REQUIRED_CHUNKS,
} from '@/app/lib/modules/standard/retrieval/select_chunks_for_generation';
import { modelForStandardType, getPlanStandardModel } from '@/app/lib/ollama/model_router';
import type { GeneratedQuestion, GeneratedOFC } from './generate_module_content';

export { STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL } from '@/app/lib/modules/standard/retrieval/select_chunks_for_generation';

const SCRIPT_PATH = path.join(process.cwd(), 'tools', 'modules', 'run_module_parser_from_db.py');
const CHUNKS_DIR = path.join(process.cwd(), 'data', 'module_chunks');
const OUTPUT_DIR = path.join(process.cwd(), 'tools', 'outputs');
const DEFAULT_SPAWN_TIMEOUT_MS = 600_000; // 10 min
function getSpawnTimeoutMs(): number {
  const env = process.env.MODULE_CHUNK_PARSER_TIMEOUT_MS;
  if (env != null && env !== '') {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_SPAWN_TIMEOUT_MS;
}

type OllamaItem = {
  id?: string;
  question?: string;
  finding?: string;
  ofcs?: string[];
  evidence_excerpt?: string;
  source_chunk_id?: string;
  source_file?: string;
  page_range?: string;
};

type OllamaOutput = {
  module_code?: string;
  module_title?: string;
  module_kind?: string;
  items?: OllamaItem[];
  items_empty_reason?: string;
  dropped_total?: number;
  drop_reasons?: Record<string, number>;
  examples?: Array<{ reason: string; item_type?: string; text?: string; bad_handles?: string[] | null }>;
  total_retrieved?: number;
  missing_text_count?: number;
  missing_locator_count?: number;
  missing_source_label_count?: number;
  missing_text_chunk_ids?: string[];
  missing_locator_chunk_ids?: string[];
  missing_source_label_chunk_ids?: string[];
  debug_trace?: Record<string, unknown>;
  router?: GenerateFromChunksResult["router"];
  stage_debug?: GenerateFromChunksResult["stage_debug"];
};

export interface GenerateFromChunksResult {
  questions: GeneratedQuestion[];
  ofcs: GeneratedOFC[];
  source: 'ollama_chunks';
  itemCount: number;
  /** Set when itemCount is 0; explains why the parser returned no items. */
  itemsEmptyReason?: string;
  /** When items were dropped (e.g. citation mismatch), counts by reason. */
  droppedTotal?: number;
  dropReasons?: Record<string, number>;
  /** Sample dropped items for debugging (top 5). */
  dropExamples?: Array<{ reason: string; item_type?: string; text?: string; bad_handles?: string[] | null }>;
  /** PACKET_PIPELINE_NO_USABLE_CHUNKS: counts and sample chunk ids. */
  totalRetrieved?: number;
  missingTextCount?: number;
  missingLocatorCount?: number;
  missingSourceLabelCount?: number;
  missingTextChunkIds?: string[];
  missingLocatorChunkIds?: string[];
  missingSourceLabelChunkIds?: string[];
  /** For debug_trace: chunks sent to parser. */
  chunksTotal?: number;
  chunksUsable?: number;
  /** From Python when items empty (packet pipeline). */
  debugTraceFromPython?: Record<string, unknown>;
  /** Router stats (total, keep, maybe, ignore, examples) when packet pipeline used. */
  router?: {
    total?: number;
    keep?: number;
    maybe?: number;
    ignore?: number;
    selected_count?: number;
    forced_count?: number;
    used_maybe_fallback?: boolean;
    examples?: { ignore?: Array<{ handle: string; reason: string }>; maybe?: Array<{ handle: string; reason: string }>; keep?: Array<{ handle: string; reason: string }> };
  };
  /** Stage-level debug (retrieval, router, packets, parser, extracted, dropped, final) for 0-item or dryRun/debug. */
  stage_debug?: {
    retrieval?: { chunks_total?: number; chunks_usable?: number; windows?: number };
    router?: { keep?: number; maybe?: number; ignore?: number; selected?: number };
    packets?: { total?: number; avg_chunks_per_packet?: number };
    parser?: { raw_len?: number; parse_ok?: boolean; schema_ok?: boolean };
    extracted?: { questions?: number; vulns?: number; ofcs?: number };
    dropped?: { total?: number; by_reason?: Record<string, number>; examples?: Array<{ reason?: string; text?: string }> };
    final?: { kept?: number; empty_reason?: string };
  };
}

/**
 * Run the Python chunk parser and map its output to wizard format.
 * Chunk export must exist at data/module_chunks/<module_code>.json (run extract first).
 * When standardClass/moduleKind are set, uses packet pipeline (structure from standard class, topic from module).
 */
export async function generateModuleContentFromChunks(
  module_code: string,
  options?: { maxChunks?: number; standardClass?: string; moduleKind?: 'OBJECT' | 'PLAN'; debugDump?: boolean }
): Promise<GenerateFromChunksResult> {
  const chunksPath = path.join(CHUNKS_DIR, `${module_code}.json`);
  if (!fs.existsSync(chunksPath)) {
    throw new Error(
      `CHUNK_EXPORT_MISSING: No chunk export at data/module_chunks/${module_code}.json. ` +
        `Run the offline chunk extractor for ${module_code} before generating module content.`
    );
  }

  const rawData = fs.readFileSync(chunksPath, 'utf-8');
  let filePayload: { chunks?: Array<{ text?: string; chunk_text?: string; [k: string]: unknown }>; source_index?: Record<string, string> };
  try {
    filePayload = JSON.parse(rawData);
  } catch {
    throw new Error(`Chunk export is not valid JSON: ${chunksPath}`);
  }
  const allChunks = filePayload.chunks ?? [];
  const sourceIndex = filePayload.source_index ?? {};

  const moduleKind = options?.moduleKind ?? (options?.standardClass ? (options.standardClass.toUpperCase().trim() === 'PHYSICAL_SECURITY_PLAN' ? 'PLAN' : 'OBJECT') : undefined);
  const maxChunksEnv = Number(process.env.MODULE_CHUNK_PARSER_MAX_CHUNKS || '24');
  const maxCharsEnv = Number(process.env.MODULE_CHUNK_PARSER_MAX_CHARS || '120000');
  const totalWantedForSco = Math.max(maxChunksEnv, 80);

  let poolChunks: typeof allChunks = allChunks;
  if (moduleKind === 'OBJECT') {
    try {
      const selected = selectChunksForGeneration(
        allChunks as Array<{ text?: string; chunk_text?: string; source_registry_id?: string; doc_id?: string; [k: string]: unknown }>,
        totalWantedForSco,
        MIN_REQUIRED_CHUNKS
      );
      poolChunks = selected.chunks;
    } catch (e) {
      if (e instanceof Error && e.name === 'STANDARD_SCOPE_SOURCES_INSUFFICIENT_PHYSICAL') {
        const err = e as Error & { counts: { total: number; excluded_deep_network: number; remaining: number; by_source: Record<string, number> } };
        throw err;
      }
      throw e;
    }
  }

  const prunedChunks: typeof allChunks = [];
  let charCount = 0;
  for (const c of poolChunks) {
    if (prunedChunks.length >= maxChunksEnv) break;
    const t = (c.text ?? c.chunk_text ?? '') as string;
    if (!t) continue;
    if (charCount + t.length > maxCharsEnv) break;
    prunedChunks.push(c);
    charCount += t.length;
  }
  const chunksForParser = prunedChunks.length ? prunedChunks : poolChunks;
  const effectiveCharCount = prunedChunks.length ? charCount : chunksForParser.reduce((sum, c) => sum + ((c.text ?? c.chunk_text) as string || '').length, 0);
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL || process.env.RUNTIME_DB_URL || '';

  const withLocalNoProxy = (v?: string): string => {
    const parts = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const needed of ['127.0.0.1', 'localhost']) {
      if (!parts.includes(needed)) parts.push(needed);
    }
    return parts.join(',');
  };

  const env = { ...process.env } as NodeJS.ProcessEnv;
  env.PYTHONPATH = process.cwd();
  env.RUNTIME_DATABASE_URL = runtimeUrl;
  env.NO_PROXY = withLocalNoProxy(env.NO_PROXY);
  env.no_proxy = env.NO_PROXY;
  if (process.env.OLLAMA_HOST) env.OLLAMA_HOST = process.env.OLLAMA_HOST;
  const dumpDir = process.env.GENERATION_DUMP_DIR?.trim();
  if (options?.debugDump && dumpDir) {
    env.GENERATION_DEBUG_DUMP = '1';
    env.GENERATION_DUMP_DIR = dumpDir;
  }

  const args: string[] = [SCRIPT_PATH, '--module-code', module_code, '--stdin'];
  const standardClass = options?.standardClass;
  if (moduleKind) {
    args.push('--use-packet-pipeline', '--module-kind', moduleKind);
    const standardType = moduleKind === 'PLAN' ? 'plan' : 'object';
    const model = modelForStandardType(standardType);
    const modelPlan = getPlanStandardModel();
    args.push('--model', model, '--model-plan', modelPlan);
    if (standardClass && typeof standardClass === 'string' && standardClass.trim()) {
      args.push('--standard-key', standardClass.trim());
    }
  }

  throw new Error(
    `Legacy module generation is retired in the deployed app. Use the offline generator locally for ${module_code}.`
  );
}
