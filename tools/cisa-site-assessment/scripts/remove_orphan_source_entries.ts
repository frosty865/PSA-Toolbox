#!/usr/bin/env npx tsx
/**
 * Remove DB entries that do not have associated files on the server.
 * Organize corpus storage folder (ensure dirs exist, report layout).
 *
 * - RUNTIME: Deletes module_sources (MODULE_UPLOAD) rows whose storage_relpath
 *   file is missing. Optionally cleans document_blobs and module_documents references.
 * - CORPUS: Deletes source_registry rows (and cascade) whose storage_relpath/local_path
 *   file is missing; then cleans RUNTIME references (module_sources, module_corpus_links, etc.).
 * - Organize: Ensures corpus and module storage subdirs exist; reports structure.
 *
 * Env: RUNTIME_DATABASE_URL (or RUNTIME_DB_URL); CORPUS_DATABASE_URL for corpus cleanup.
 *
 * Usage:
 *   npx tsx scripts/remove_orphan_source_entries.ts [--dry-run] [--skip-corpus] [--skip-organize]
 *
 *   --dry-run      Log what would be deleted; do not execute.
 *   --skip-corpus  Only run runtime cleanup and organize.
 *   --skip-organize Skip ensure-dirs and storage report.
 */

import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

loadEnvLocal(psaRebuildRoot);

function getModuleSourcesRoot(): string {
  const raw = process.env.MODULE_SOURCES_ROOT ?? "storage/module_sources";
  return path.isAbsolute(raw) ? raw : path.resolve(psaRebuildRoot, raw);
}

function getCorpusSourcesRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? "storage/corpus_sources";
  return path.isAbsolute(raw) ? raw : path.resolve(psaRebuildRoot, raw);
}

function resolveModulePath(storageRelpath: string): string {
  return path.resolve(getModuleSourcesRoot(), storageRelpath);
}

function resolveCorpusPath(storageRelpath: string): string {
  return path.resolve(getCorpusSourcesRoot(), storageRelpath);
}

async function ensureStorageDirs(): Promise<void> {
  const corpus = getCorpusSourcesRoot();
  const moduleRoot = getModuleSourcesRoot();
  const corpusSubdirs = ["raw", "normalized", "extracted", "manifests"];
  const moduleSubdirs = ["raw", "normalized", "manifests", "incoming"];
  for (const d of corpusSubdirs) {
    await fs.mkdir(path.join(corpus, d), { recursive: true });
  }
  for (const d of moduleSubdirs) {
    await fs.mkdir(path.join(moduleRoot, d), { recursive: true });
  }
  console.log("[Organize] Ensured corpus and module storage subdirs.");
}

async function reportStorageLayout(): Promise<void> {
  const corpus = getCorpusSourcesRoot();
  const moduleRoot = getModuleSourcesRoot();
  const countFiles = async (dir: string): Promise<number> => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let n = 0;
      for (const e of entries) {
        if (e.isFile()) n++;
        else if (e.isDirectory() && !e.name.startsWith("."))
          n += await countFiles(path.join(dir, e.name));
      }
      return n;
    } catch {
      return 0;
    }
  };
  const corpusRaw = path.join(corpus, "raw");
  const moduleRaw = path.join(moduleRoot, "raw");
  console.log("[Organize] Corpus storage:", corpus);
  console.log("  raw (file count):", await countFiles(corpusRaw));
  console.log("[Organize] Module storage:", moduleRoot);
  console.log("  raw (file count):", await countFiles(moduleRaw));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipCorpus = process.argv.includes("--skip-corpus");
  const skipOrganize = process.argv.includes("--skip-organize");

  if (dryRun) console.log("[DRY RUN] No rows or files will be changed.\n");

  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.RUNTIME_DB_URL;
  if (!runtimeUrl) {
    console.error("RUNTIME_DATABASE_URL or RUNTIME_DB_URL is required.");
    process.exit(1);
  }

  const runtimePool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    // ---------- RUNTIME: module_sources (MODULE_UPLOAD) with missing file ----------
    const msRows = await runtimePool.query<{
      id: string;
      module_code: string;
      source_label: string | null;
      storage_relpath: string | null;
    }>(
      `SELECT id, module_code, source_label, storage_relpath
       FROM public.module_sources
       WHERE source_type = 'MODULE_UPLOAD' AND storage_relpath IS NOT NULL AND storage_relpath <> ''`
    );

    const missingMsIds: string[] = [];
    for (const row of msRows.rows) {
      const rel = (row.storage_relpath ?? "").replace(/\\/g, "/");
      try {
        const abs = resolveModulePath(rel);
        if (!existsSync(abs)) missingMsIds.push(row.id);
      } catch {
        missingMsIds.push(row.id);
      }
    }

    if (missingMsIds.length > 0) {
      console.log(`[RUNTIME] module_sources: ${missingMsIds.length} rows with missing file (will delete).`);
      if (!dryRun) {
        const del = await runtimePool.query(
          `DELETE FROM public.module_sources WHERE id = ANY($1::uuid[])`,
          [missingMsIds]
        );
        console.log(`  Deleted module_sources: ${del.rowCount ?? 0}`);
      }
    } else {
      console.log("[RUNTIME] module_sources: all MODULE_UPLOAD files present.");
    }

    // ---------- RUNTIME: document_blobs with missing file ----------
    const blobRows = await runtimePool.query<{ id: string; storage_relpath: string }>(
      `SELECT id, storage_relpath FROM public.document_blobs`
    );
    const missingBlobIds: string[] = [];
    for (const row of blobRows.rows) {
      const rel = (row.storage_relpath ?? "").replace(/\\/g, "/");
      try {
        const abs = resolveModulePath(rel);
        if (!existsSync(abs)) missingBlobIds.push(row.id);
      } catch {
        missingBlobIds.push(row.id);
      }
    }
    if (missingBlobIds.length > 0) {
      console.log(`[RUNTIME] document_blobs: ${missingBlobIds.length} rows with missing file (will unlink and delete).`);
      if (!dryRun) {
        await runtimePool.query(
          `UPDATE public.module_documents SET document_blob_id = NULL WHERE document_blob_id = ANY($1::uuid[])`,
          [missingBlobIds]
        );
        const del = await runtimePool.query(
          `DELETE FROM public.document_blobs WHERE id = ANY($1::uuid[])`,
          [missingBlobIds]
        );
        console.log(`  Deleted document_blobs: ${del.rowCount ?? 0}`);
      }
    } else {
      console.log("[RUNTIME] document_blobs: all files present.");
    }

    // ---------- CORPUS: source_registry with missing file ----------
    if (!skipCorpus) {
      const corpusUrl = process.env.CORPUS_DATABASE_URL;
      if (!corpusUrl) {
        console.log("[CORPUS] CORPUS_DATABASE_URL not set; skipping corpus orphan cleanup.");
      } else {
        const corpusPool = new Pool(
          applyNodeTls({
            connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
            ssl: { rejectUnauthorized: false },
          })
        );
        try {
          const srcRows = await corpusPool.query<{
            id: string;
            storage_relpath: string | null;
            local_path: string | null;
          }>(
            `SELECT id, storage_relpath, local_path FROM public.source_registry
             WHERE storage_relpath IS NOT NULL AND storage_relpath <> ''
                OR (local_path IS NOT NULL AND local_path <> '' AND local_path NOT LIKE '/%' AND local_path NOT LIKE '%:%')`
          );

          const missingSrcIds: string[] = [];
          for (const row of srcRows.rows) {
            const rel = (row.storage_relpath ?? row.local_path ?? "").replace(/\\/g, "/").trim();
            if (!rel) continue;
            try {
              const abs = resolveCorpusPath(rel);
              if (!existsSync(abs)) missingSrcIds.push(row.id);
            } catch {
              missingSrcIds.push(row.id);
            }
          }

          if (missingSrcIds.length > 0) {
            console.log(`[CORPUS] source_registry: ${missingSrcIds.length} rows with missing file (will cascade delete).`);
            if (!dryRun) {
              const client = await corpusPool.connect();
              let deletedSourceKeys: string[] = [];
              try {
                const keyResult = await client.query<{ source_key: string }>(
                  `SELECT source_key FROM public.source_registry WHERE id = ANY($1::uuid[])`,
                  [missingSrcIds]
                );
                deletedSourceKeys = keyResult.rows.map((r) => r.source_key).filter(Boolean);

                const docResult = await client.query<{ id: string }>(
                  `SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[])`,
                  [missingSrcIds]
                );
                const corpusDocumentIds = docResult.rows.map((r) => r.id);
                const chunkResult = await client.query<{ chunk_id: string }>(
                  `SELECT chunk_id FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
                  [corpusDocumentIds]
                );
                const chunkIds = chunkResult.rows.map((r) => r.chunk_id);

                await client.query("BEGIN");
                if (chunkIds.length > 0) {
                  await client.query(`DELETE FROM public.rag_chunks WHERE chunk_id = ANY($1::text[])`, [chunkIds]);
                }
                await client.query(
                  `DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
                  [corpusDocumentIds]
                );
                await client.query(
                  `DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`,
                  [corpusDocumentIds]
                );
                await client.query(
                  `UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id = ANY($1::uuid[])`,
                  [missingSrcIds]
                );
                await client.query(
                  `DELETE FROM public.module_standard_citations WHERE source_registry_id = ANY($1::uuid[])`,
                  [missingSrcIds]
                );
                const hasModuleStandardsSrId = await client.query(
                  `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_standards' AND column_name = 'source_registry_id'`
                );
                if (hasModuleStandardsSrId.rows.length > 0) {
                  await client.query(
                    `DELETE FROM public.module_standards WHERE source_registry_id = ANY($1::uuid[])`,
                    [missingSrcIds]
                  );
                }
                await client.query(
                  `DELETE FROM public.module_source_documents WHERE corpus_document_id = ANY($1::uuid[])`,
                  [corpusDocumentIds]
                );
                await client.query(`DELETE FROM public.corpus_documents WHERE id = ANY($1::uuid[])`, [corpusDocumentIds]);
                await client.query(`DELETE FROM public.source_registry WHERE id = ANY($1::uuid[])`, [missingSrcIds]);
                await client.query("COMMIT");
                console.log(`  Deleted corpus chain and source_registry: ${missingSrcIds.length} sources.`);
              } catch (e) {
                await client.query("ROLLBACK");
                throw e;
              } finally {
                client.release();
              }

              const delMs = await runtimePool.query(
                `DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`,
                [missingSrcIds]
              );
              await runtimePool.query(
                `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
                [missingSrcIds]
              );
              await runtimePool.query(
                `DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
                [missingSrcIds]
              );
              await runtimePool.query(
                `DELETE FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`,
                [missingSrcIds]
              );
              if (deletedSourceKeys.length > 0) {
                await runtimePool.query(
                  `UPDATE public.ofc_library_citations SET source_key = NULL WHERE source_key = ANY($1::text[])`,
                  [deletedSourceKeys]
                );
              }
              console.log(`  [RUNTIME] Removed refs: module_sources ${delMs.rowCount ?? 0}, etc.`);
            }
          } else {
            console.log("[CORPUS] source_registry: all stored files present.");
          }
        } finally {
          await corpusPool.end();
        }
      }
    }

    // ---------- Organize: ensure dirs and report ----------
    if (!skipOrganize) {
      await ensureStorageDirs();
      await reportStorageLayout();
    }
  } finally {
    await runtimePool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
