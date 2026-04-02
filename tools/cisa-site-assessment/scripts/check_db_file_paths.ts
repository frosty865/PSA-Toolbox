#!/usr/bin/env npx tsx
/**
 * Check that all file paths stored in the DB resolve to existing files on disk.
 *
 * CORPUS: source_registry (storage_relpath, local_path), corpus_documents (canonical_path)
 * RUNTIME: document_blobs (storage_relpath), module_sources (storage_relpath for MODULE_UPLOAD)
 *
 * Uses same resolution as the app (corpus root + relpath; module root + relpath; blob fallback to raw/_blobs/<sha256>.pdf).
 *
 * Env: CORPUS_DATABASE_URL, RUNTIME_DATABASE_URL (or DATABASE_URL),
 *      CORPUS_SOURCES_ROOT, MODULE_SOURCES_ROOT (optional).
 *
 * Usage:
 *   npx tsx scripts/check_db_file_paths.ts [--verbose]
 */

import path from "path";
import { existsSync } from "fs";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

function getCorpusRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? "";
  const cwd = process.cwd();
  const resolved = raw.trim()
    ? (path.isAbsolute(raw) ? raw : path.resolve(cwd, raw))
    : path.resolve(cwd, "storage", "corpus_sources");
  const base = path.basename(resolved);
  if (base === "storage") return path.join(resolved, "corpus_sources");
  return resolved;
}

function getModuleRoot(): string {
  const raw = process.env.MODULE_SOURCES_ROOT ?? "";
  const cwd = process.cwd();
  const resolved = raw.trim()
    ? (path.isAbsolute(raw) ? raw : path.resolve(cwd, raw))
    : path.resolve(cwd, "storage", "module_sources");
  const base = path.basename(resolved);
  if (base === "storage") return path.join(resolved, "module_sources");
  return resolved;
}

function resolveCorpusPath(root: string, relpath: string): string {
  const normalized = relpath.replace(/\\/g, "/").trim();
  return path.resolve(root, normalized);
}

function resolveModulePath(root: string, relpath: string): string {
  const normalized = relpath.replace(/\\/g, "/").trim();
  return path.resolve(root, normalized);
}

/** Check blob path; if primary missing, try raw/_blobs/<sha256>.pdf (same as file route). */
function resolveBlobPath(moduleRoot: string, storageRelpath: string, sha256: string | null): string | null {
  const primary = resolveModulePath(moduleRoot, storageRelpath);
  if (existsSync(primary)) return primary;
  const normalized = storageRelpath.replace(/\\/g, "/").trim();
  if (normalized.startsWith("raw/") && !normalized.includes("_blobs/") && sha256) {
    const blobPath = path.join(moduleRoot, "raw", "_blobs", `${sha256}.pdf`);
    if (existsSync(blobPath)) return blobPath;
  }
  return null;
}

async function main() {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!corpusUrl || !runtimeUrl) {
    console.error("CORPUS_DATABASE_URL and RUNTIME_DATABASE_URL (or DATABASE_URL) required.");
    process.exit(1);
  }

  const corpusRoot = getCorpusRoot();
  const moduleRoot = getModuleRoot();
  console.log("Corpus root:", corpusRoot);
  console.log("Module root:", moduleRoot);
  console.log("");

  const corpusPool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );
  const runtimePool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  let hasErrors = false;

  try {
    // --- CORPUS: source_registry ---
    const srRows = await corpusPool.query<{
      id: string;
      source_key: string;
      storage_relpath: string | null;
      local_path: string | null;
    }>(
      `SELECT id, source_key, storage_relpath, local_path FROM public.source_registry
       WHERE (storage_relpath IS NOT NULL AND trim(storage_relpath) <> '')
          OR (local_path IS NOT NULL AND trim(local_path) <> '')`
    );
    let srOk = 0;
    let srMissing = 0;
    for (const row of srRows.rows) {
      const candidates: string[] = [];
      if (row.storage_relpath?.trim()) {
        const r = row.storage_relpath.trim().replace(/\\/g, "/");
        candidates.push(path.isAbsolute(r) ? r : resolveCorpusPath(corpusRoot, r));
      }
      if (row.local_path?.trim()) {
        const r = row.local_path.trim().replace(/\\/g, "/");
        candidates.push(path.isAbsolute(r) ? r : resolveCorpusPath(corpusRoot, r));
      }
      const found = candidates.find((p) => existsSync(p));
      if (found) {
        srOk++;
        if (verbose) console.log(`  [OK] source_registry ${row.source_key} -> ${path.relative(corpusRoot, found) || found}`);
      } else {
        srMissing++;
        hasErrors = true;
        console.log(`  [MISSING] source_registry ${row.source_key} -> ${row.storage_relpath ?? row.local_path ?? ""}`);
      }
    }
    console.log(`corpus source_registry: ${srOk} OK, ${srMissing} missing`);

    // --- CORPUS: corpus_documents canonical_path ---
    const cdRows = await corpusPool.query<{ id: string; canonical_path: string | null }>(
      `SELECT id, canonical_path FROM public.corpus_documents
       WHERE canonical_path IS NOT NULL AND trim(canonical_path) <> ''`
    );
    let cdOk = 0;
    let cdMissing = 0;
    for (const row of cdRows.rows) {
      const rel = (row.canonical_path ?? "").trim().replace(/\\/g, "/");
      const abs = path.isAbsolute(rel) ? rel : resolveCorpusPath(corpusRoot, rel);
      if (existsSync(abs)) {
        cdOk++;
        if (verbose) console.log(`  [OK] corpus_documents ${row.id.slice(0, 8)}… -> ${rel}`);
      } else {
        cdMissing++;
        hasErrors = true;
        console.log(`  [MISSING] corpus_documents ${row.id.slice(0, 8)}… -> ${rel}`);
      }
    }
    console.log(`corpus corpus_documents: ${cdOk} OK, ${cdMissing} missing`);
    console.log("");

    // --- RUNTIME: document_blobs ---
    const blobRows = await runtimePool.query<{ id: string; sha256: string | null; storage_relpath: string }>(
      `SELECT id, sha256, storage_relpath FROM public.document_blobs
       WHERE storage_relpath IS NOT NULL AND trim(storage_relpath) <> ''`
    );
    let blobOk = 0;
    let blobMissing = 0;
    for (const row of blobRows.rows) {
      const found = resolveBlobPath(moduleRoot, row.storage_relpath, row.sha256);
      if (found) {
        blobOk++;
        if (verbose) console.log(`  [OK] document_blobs ${row.id.slice(0, 8)}… -> ${row.storage_relpath}`);
      } else {
        blobMissing++;
        hasErrors = true;
        console.log(`  [MISSING] document_blobs ${row.id.slice(0, 8)}… sha256=${row.sha256?.slice(0, 12) ?? "null"}… -> ${row.storage_relpath}`);
      }
    }
    console.log(`runtime document_blobs: ${blobOk} OK, ${blobMissing} missing`);

    // --- RUNTIME: module_sources (MODULE_UPLOAD with storage_relpath) ---
    const msRows = await runtimePool.query<{
      id: string;
      module_code: string;
      storage_relpath: string | null;
    }>(
      `SELECT id, module_code, storage_relpath FROM public.module_sources
       WHERE source_type = 'MODULE_UPLOAD' AND storage_relpath IS NOT NULL AND trim(storage_relpath) <> ''`
    );
    let msOk = 0;
    let msMissing = 0;
    for (const row of msRows.rows) {
      const rel = (row.storage_relpath ?? "").trim().replace(/\\/g, "/");
      const abs = resolveModulePath(moduleRoot, rel);
      if (existsSync(abs)) {
        msOk++;
        if (verbose) console.log(`  [OK] module_sources ${row.module_code} ${row.id.slice(0, 8)}… -> ${rel}`);
      } else {
        msMissing++;
        hasErrors = true;
        console.log(`  [MISSING] module_sources ${row.module_code} ${row.id.slice(0, 8)}… -> ${rel}`);
      }
    }
    console.log(`runtime module_sources: ${msOk} OK, ${msMissing} missing`);
  } finally {
    await corpusPool.end();
    await runtimePool.end();
  }

  console.log("");
  if (hasErrors) {
    console.log("Some paths do not resolve to existing files. Run copy_blobs_to_sha256_names.ts or copy_corpus_to_flat_raw.ts as needed.");
    process.exit(1);
  }
  console.log("All checked paths resolve to existing files.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
