/**
 * Resolve file path for module source_registry rows and extract/apply publisher (and title) from PDF.
 * Used at ingestion (after replication) and by backfill script.
 * CORPUS only: updates public.source_registry.
 * Path resolution is inlined here so CLI scripts can run without importing server-only config.
 */

import type { Pool } from "pg";
import * as path from "path";
import { existsSync } from "fs";
import { extractPdfMetadataFromPath } from "@/app/lib/pdfExtractTitle";
import { normalizePublisherName, isUnacceptablePublisher } from "@/app/lib/sourceRegistry/publisherNormalizer";

const DEFAULT_CORPUS = "storage/corpus_sources";
const DEFAULT_MODULE = "storage/module_sources";

function resolveStorageRoot(envKey: string, defaultRel: string, librarySubdir: string): string {
  const raw = (process.env[envKey] ?? defaultRel).trim().replace(/^["']|["']$/g, "");
  const resolved = raw ? (path.isAbsolute(raw) ? raw : path.resolve(raw)) : path.resolve(defaultRel);
  const base = path.basename(resolved);
  return base === "storage" ? path.join(resolved, librarySubdir) : resolved;
}

function getModuleSourcesRoot(): string {
  return resolveStorageRoot("MODULE_SOURCES_ROOT", DEFAULT_MODULE, "module_sources");
}

function getCorpusSourcesRoot(): string {
  return resolveStorageRoot("CORPUS_SOURCES_ROOT", DEFAULT_CORPUS, "corpus_sources");
}

function isUnderRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);
  const rel = path.relative(root, cand);
  return (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)) || rel === "";
}

export type ModuleSourceRegistryRow = {
  id: string;
  source_key: string;
  local_path: string | null;
  storage_relpath: string | null;
};

/**
 * Resolve absolute file path for a source_registry row.
 * - Rows with source_key starting with "module:" use MODULE_SOURCES_ROOT.
 * - Others use CORPUS_SOURCES_ROOT.
 * Returns null if path cannot be resolved or file does not exist.
 */
export function resolvePathForSourceRegistryRow(row: ModuleSourceRegistryRow): string | null {
  const isModule = row.source_key.startsWith("module:");
  const root = isModule ? getModuleSourcesRoot() : getCorpusSourcesRoot();
  const raw = (row.storage_relpath ?? row.local_path ?? "").trim().replace(/\\/g, "/");
  if (!raw) return null;

  let absPath: string;
  if (path.isAbsolute(raw)) {
    if (!isUnderRoot(root, raw)) return null;
    absPath = raw;
  } else {
    absPath = path.resolve(root, raw);
    if (!isUnderRoot(root, absPath)) return null;
  }
  return existsSync(absPath) ? absPath : null;
}

export type ExtractApplyResult = {
  updated: boolean;
  publisher: string | null;
  title: string | null;
  error?: string;
};

/**
 * Extract title/publisher from PDF at absolutePath and update source_registry (only null fields).
 * Normalizes publisher; skips if unacceptable. Returns what was applied.
 */
export async function extractAndApplyPublisherToSourceRegistry(
  pool: Pool,
  sourceRegistryId: string,
  absolutePath: string
): Promise<ExtractApplyResult> {
  try {
    const meta = await extractPdfMetadataFromPath(absolutePath);
    const rawPublisher = (meta.publisher ?? "").trim();
    const publisher =
      rawPublisher && !isUnacceptablePublisher(rawPublisher)
        ? (normalizePublisherName(rawPublisher) ?? rawPublisher)
        : null;
    const title = (meta.title ?? "").trim() || null;
    if (!publisher && !title) {
      return { updated: false, publisher: null, title: null };
    }

    const row = await pool.query<{ title: string | null; publisher: string | null }>(
      `SELECT title, publisher FROM public.source_registry WHERE id = $1`,
      [sourceRegistryId]
    );
    if (row.rows.length === 0) {
      return { updated: false, publisher: null, title: null, error: "Source not found" };
    }
    const current = row.rows[0];
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (title && (!current.title || !current.title.trim())) {
      updates.push(`title = $${idx}`);
      params.push(title);
      idx++;
    }
    if (publisher && (!current.publisher || !current.publisher.trim())) {
      updates.push(`publisher = $${idx}`);
      params.push(publisher);
      idx++;
    }
    if (updates.length === 0) {
      return { updated: false, publisher: current.publisher, title: current.title };
    }
    params.push(sourceRegistryId);
    await pool.query(
      `UPDATE public.source_registry SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
      params
    );
    return {
      updated: true,
      publisher: publisher ?? current.publisher,
      title: title ?? current.title,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { updated: false, publisher: null, title: null, error: message };
  }
}
