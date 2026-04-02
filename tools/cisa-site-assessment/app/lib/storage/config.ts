/**
 * Storage roots for CORPUS vs MODULE sources.
 * Strict separation: CORPUS writes only under corpus; MODULE only under module.
 *
 * Env (from .env.local or process.env):
 * - CORPUS_SOURCES_ROOT (default: storage/corpus_sources)
 * - MODULE_SOURCES_ROOT (default: storage/module_sources)
 * - TECHNOLOGY_SOURCES_ROOT (default: storage/technology_sources)
 *
 * NOTE: This module is server-only. Do not import from client components.
 */
import "server-only";

import * as fs from "fs/promises";
import * as path from "path";

const DEFAULT_CORPUS = "storage/corpus_sources" as const;
const DEFAULT_MODULE = "storage/module_sources" as const;
const DEFAULT_TECHNOLOGY = "storage/technology_sources" as const;

/** Corpus: ingestion lands in incoming/; PDFs go in raw/ only. No additional folders under raw. */
const CORPUS_SUBDIRS: ReadonlyArray<string> = Object.freeze(["incoming", "raw"]);

/** Module: ingestion lands in incoming/; PDFs go in raw/ only. No additional folders under raw. */
const MODULE_SUBDIRS: ReadonlyArray<string> = Object.freeze(["incoming", "raw"]);

/** Technology: ingestion lands in incoming/; PDFs go in raw/ only. No additional folders under raw. */
const TECHNOLOGY_SUBDIRS: ReadonlyArray<string> = Object.freeze(["incoming", "raw"]);

function resolveRoot(envKey: string, defaultVal: string): string {
  const raw = process.env[envKey] ?? defaultVal;

  // Avoid process.cwd() joins; they cause broad tracing patterns.
  // Prefer absolute env paths. If relative, resolve from current working directory at runtime.
  return path.isAbsolute(raw) ? raw : path.resolve(raw);
}

function isUnderRoot(rootAbs: string, candidateAbs: string): boolean {
  const root = path.resolve(rootAbs);
  const cand = path.resolve(candidateAbs);

  // Robust "under root" check for Windows/macOS/Linux:
  // - uses relative path rather than startsWith()
  const rel = path.relative(root, cand);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel) ? true : rel === "";
}

/**
 * If the resolved root is the generic "storage" directory (no library subfolder),
 * append the correct subfolder so we never write directly under storage.
 */
function ensureLibrarySubdir(resolved: string, subdir: string): string {
  const base = path.basename(resolved);
  if (base === "storage") {
    return path.join(resolved, subdir);
  }
  return resolved;
}

/**
 * Root for CORPUS evidence (source_registry, corpus_documents). All corpus
 * ingestion MUST write under this root.
 */
export function getCorpusSourcesRoot(): string {
  const root = resolveRoot("CORPUS_SOURCES_ROOT", DEFAULT_CORPUS);
  return ensureLibrarySubdir(root, "corpus_sources");
}

/**
 * Root for MODULE-scoped uploads. All module uploads MUST write under this root.
 */
export function getModuleSourcesRoot(): string {
  const root = resolveRoot("MODULE_SOURCES_ROOT", DEFAULT_MODULE);
  return ensureLibrarySubdir(root, "module_sources");
}

/**
 * Root for TECHNOLOGY library. All technology crawler downloads MUST write under this root.
 * Segregated from CORPUS so technology content does not contaminate baseline.
 */
export function getTechnologySourcesRoot(): string {
  const root = resolveRoot("TECHNOLOGY_SOURCES_ROOT", DEFAULT_TECHNOLOGY);
  return ensureLibrarySubdir(root, "technology_sources");
}

/**
 * Ensures corpus, module, and technology storage directories exist. Idempotent.
 * Runtime-only side effect (do not call at import time).
 */
export async function ensureStorageDirs(): Promise<void> {
  const corpus = getCorpusSourcesRoot();
  const moduleRoot = getModuleSourcesRoot();
  const techRoot = getTechnologySourcesRoot();

  for (const d of CORPUS_SUBDIRS) {
    await fs.mkdir(path.join(corpus, d), { recursive: true });
  }
  for (const d of MODULE_SUBDIRS) {
    await fs.mkdir(path.join(moduleRoot, d), { recursive: true });
  }
  for (const d of TECHNOLOGY_SUBDIRS) {
    await fs.mkdir(path.join(techRoot, d), { recursive: true });
  }
}

/**
 * Resolve a storage_relpath (relative to root) to an absolute path under the corpus root.
 * Fails if the resolved path is not under the corpus root (e.g. relpath with "..").
 */
export function resolveCorpusPath(storageRelpath: string): string {
  const root = getCorpusSourcesRoot();
  const resolved = path.resolve(root, storageRelpath);
  if (!isUnderRoot(root, resolved)) {
    throw new Error(
      `[Storage] Path escapes CORPUS root: ${storageRelpath} -> ${resolved}`
    );
  }
  return resolved;
}

/**
 * Resolve a storage_relpath (relative to root) to an absolute path under the module root.
 */
export function resolveModulePath(storageRelpath: string): string {
  const root = getModuleSourcesRoot();
  const resolved = path.resolve(root, storageRelpath);
  if (!isUnderRoot(root, resolved)) {
    throw new Error(
      `[Storage] Path escapes MODULE root: ${storageRelpath} -> ${resolved}`
    );
  }
  return resolved;
}

/**
 * Assert that an absolute file path is under CORPUS_SOURCES_ROOT. Use before any write.
 */
export function assertCorpusPath(absolutePath: string): void {
  const root = getCorpusSourcesRoot();
  if (!isUnderRoot(root, absolutePath)) {
    throw new Error(
      `[Storage] Corpus path must be under CORPUS_SOURCES_ROOT: ${absolutePath}`
    );
  }
}

/**
 * Assert that an absolute file path is under MODULE_SOURCES_ROOT. Use before any write.
 */
export function assertModulePath(absolutePath: string): void {
  const root = getModuleSourcesRoot();
  if (!isUnderRoot(root, absolutePath)) {
    throw new Error(
      `[Storage] Module path must be under MODULE_SOURCES_ROOT: ${absolutePath}`
    );
  }
}

/**
 * Build a storage_relpath for a new corpus raw file.
 * All corpus PDFs go under raw/ with no additional folders. Ingestion lands in incoming/ then moves to raw/.
 */
export function corpusRawRelpath(basename: string, _subdir?: string): string {
  const sanit = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `raw/${sanit}`;
}

/**
 * Canonical module document path: one file per SHA256 under raw/ with no additional folders.
 * Use for all new module uploads. Ingestion lands in incoming/ then files go to raw/<sha256>.pdf.
 */
export function moduleBlobRelpath(sha256: string): string {
  return `raw/${sha256}.pdf`;
}

/**
 * Module raw file path under raw/ with no per-module subdirs.
 * @deprecated Prefer moduleBlobRelpath for deduplication by SHA256.
 */
export function moduleRawRelpath(_moduleCode: string, basename: string): string {
  const sanit = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `raw/${sanit}`;
}

// --- Library Crawler paths (strict segregation) ---

export type LibraryTargetType = "CORPUS" | "MODULE" | "TECHNOLOGY";
export type LibraryTier = "TIER_1" | "TIER_2" | "TIER_3";

/**
 * Absolute directory for library crawler CORPUS incoming.
 * Pattern: {CORPUS_SOURCES_ROOT}/incoming/  (no subdirs)
 */
export function libraryCorpusIncomingDir(): string {
  const root = getCorpusSourcesRoot();
  const rel = "incoming";
  const resolved = path.resolve(root, rel);
  if (!isUnderRoot(root, resolved)) {
    throw new Error(`[Storage] Library path escapes CORPUS root: ${rel}`);
  }
  return resolved;
}

/**
 * Absolute directory for module incoming. All module PDFs land here (flat); no per-module subdirs.
 * Pattern: {MODULE_SOURCES_ROOT}/incoming/
 */
export function libraryModuleIncomingDir(_moduleCode?: string): string {
  const root = getModuleSourcesRoot();
  const rel = "incoming";
  const resolved = path.resolve(root, rel);
  if (!isUnderRoot(root, resolved)) {
    throw new Error(`[Storage] Library path escapes MODULE root: ${rel}`);
  }
  return resolved;
}

/**
 * Absolute directory for library crawler TECHNOLOGY incoming.
 * Pattern: {TECHNOLOGY_SOURCES_ROOT}/incoming/  (no subdirs)
 */
export function libraryTechnologyIncomingDir(): string {
  const root = getTechnologySourcesRoot();
  const rel = "incoming";
  const resolved = path.resolve(root, rel);
  if (!isUnderRoot(root, resolved)) {
    throw new Error(`[Storage] Library path escapes TECHNOLOGY root: ${rel}`);
  }
  return resolved;
}

/**
 * Normalize a title for a human-readable filename: keep spaces and ( ) { }.
 * Remove only characters that are unsafe in filenames: \ / : * ? " < > |
 * No underscores; collapse multiple spaces to one; trim; limit length.
 */
export function normalizeTitleForFilename(title: string): string {
  let s = (title || "").trim();
  s = s.replace(/[\\/:*?"<>|]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 80) || "doc";
}

/**
 * Human-readable filename: normalized title + ext. No hash.
 */
export function libraryCrawlerFilename(titleOrDomain: string, ext: string): string {
  const slug = normalizeTitleForFilename(titleOrDomain || "unknown");
  const safeExt = ext.startsWith(".") ? ext.slice(0, 6) : `.${ext.slice(0, 5)}`;
  return `${slug}${safeExt}`;
}

/**
 * Assert that an absolute file path is under TECHNOLOGY_SOURCES_ROOT.
 */
export function assertTechnologyPath(absolutePath: string): void {
  const root = getTechnologySourcesRoot();
  if (!isUnderRoot(root, absolutePath)) {
    throw new Error(
      `[Storage] Path must be under TECHNOLOGY_SOURCES_ROOT: ${absolutePath}`
    );
  }
}
