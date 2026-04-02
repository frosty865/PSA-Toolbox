#!/usr/bin/env npx tsx
/**
 * Remove "School Security Field Assessment Workbook" from CORPUS and RUNTIME:
 * source_registry, corpus_documents, document_chunks, rag_chunks, and all RUNTIME
 * references. Optionally deletes the file from storage (storage_relpath).
 *
 * Env: CORPUS_DATABASE_URL (required), RUNTIME_DATABASE_URL (for RUNTIME cleanup).
 *
 * Usage:
 *   npx tsx scripts/remove_school_security_workbook.ts [--dry-run] [--delete-file]
 *
 *   --dry-run     Log what would be deleted; do not execute.
 *   --delete-file Remove file from CORPUS_SOURCES_ROOT if storage_relpath is set (no-op in --dry-run).
 */

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

const TITLE_PATTERN = "School Security Field Assessment Workbook";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const deleteFile = process.argv.includes("--delete-file");
  if (dryRun) {
    console.log("[DRY RUN] No rows or files will be deleted.");
  }

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const corpusPool = new Pool(
    applyNodeTls({
      connectionString: ensureNodePgTls(corpusUrl) ?? corpusUrl,
      ssl: { rejectUnauthorized: false },
    })
  );

  try {
    // 1) Source registry row(s) matching title
    const srcResult = await corpusPool.query<{ id: string; storage_relpath: string | null }>(
      `SELECT id, storage_relpath FROM public.source_registry
       WHERE title ILIKE $1`,
      [`%${TITLE_PATTERN}%`]
    );
    const sourceRegistryIds = srcResult.rows.map((r) => r.id);
    const storageRelpaths = srcResult.rows
      .map((r) => r.storage_relpath)
      .filter((r): r is string => r != null && r.trim() !== "");

    console.log(`[CORPUS] source_registry rows matching title '${TITLE_PATTERN}': ${sourceRegistryIds.length}`);
    if (sourceRegistryIds.length === 0) {
      console.log("No matching source found. Exiting.");
      return;
    }

    // 2) Corpus document IDs linked to those sources
    const docResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[])`,
      [sourceRegistryIds]
    );
    const corpusDocumentIds = docResult.rows.map((r) => r.id);
    console.log(`[CORPUS] corpus_documents to remove: ${corpusDocumentIds.length}`);

    // 3) Chunk IDs (for rag_chunks + document_chunks); rag_chunks.chunk_id is TEXT
    const chunkResult = await corpusPool.query<{ chunk_id: string }>(
      `SELECT chunk_id::text AS chunk_id FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
      [corpusDocumentIds]
    );
    const chunkIds = chunkResult.rows.map((r) => r.chunk_id);
    console.log(`[CORPUS] document_chunks (and rag_chunks) to remove: ${chunkIds.length}`);

    // RUNTIME first (references CORPUS source_registry id; no FK so we delete by id)
    const runtimeUrl = process.env.RUNTIME_DATABASE_URL || process.env.RUNTIME_DB_URL;
    if (runtimeUrl) {
      const runtimePool = new Pool(
        applyNodeTls({
          connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
          ssl: { rejectUnauthorized: false },
        })
      );
      try {
        if (dryRun) {
          const [ms, mcl, moc, mdsl, mcc] = await Promise.all([
            runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_doc_source_link WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
          ]);
          console.log("[DRY RUN] RUNTIME would delete:");
          console.log(`  - module_sources: ${ms.rows[0]?.n ?? 0}`);
          console.log(`  - module_corpus_links: ${mcl.rows[0]?.n ?? 0}`);
          console.log(`  - module_ofc_citations: ${moc.rows[0]?.n ?? 0}`);
          console.log(`  - module_doc_source_link: ${mdsl.rows[0]?.n ?? 0}`);
          console.log(`  - module_chunk_comprehension: ${mcc.rows[0]?.n ?? 0}`);
        } else {
          const [delMs, delMcl, delMoc, delMdsl, delMcc] = await Promise.all([
            runtimePool.query(`DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`DELETE FROM public.module_doc_source_link WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
            runtimePool.query(`DELETE FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
          ]);
          console.log("[RUNTIME] Removed references:");
          console.log(`  - module_sources: ${delMs.rowCount ?? 0}`);
          console.log(`  - module_corpus_links: ${delMcl.rowCount ?? 0}`);
          console.log(`  - module_ofc_citations: ${delMoc.rowCount ?? 0}`);
          console.log(`  - module_doc_source_link: ${delMdsl.rowCount ?? 0}`);
          console.log(`  - module_chunk_comprehension: ${delMcc.rowCount ?? 0}`);
        }
      } finally {
        await runtimePool.end();
      }
    } else {
      console.log("RUNTIME_DATABASE_URL not set; skipping RUNTIME cleanup.");
    }

    // CORPUS deletes
    if (dryRun) {
      console.log("[DRY RUN] CORPUS would delete:");
      console.log(`  - rag_chunks: ${chunkIds.length}`);
      console.log(`  - document_chunks: ${chunkIds.length}`);
      console.log(`  - corpus_reprocess_queue: by corpus_document_id (${corpusDocumentIds.length} docs)`);
      console.log(`  - corpus_documents: ${corpusDocumentIds.length}`);
      console.log(`  - module_standard_citations: by source_registry_id`);
      console.log(`  - module_standard_references: set source_registry_id NULL`);
      console.log(`  - source_registry: ${sourceRegistryIds.length}`);
    } else {
      const client = await corpusPool.connect();
      try {
        await client.query("BEGIN");
        if (chunkIds.length > 0) {
          await client.query(`DELETE FROM public.rag_chunks WHERE chunk_id = ANY($1::text[])`, [chunkIds]);
          console.log(`  Deleted rag_chunks: ${chunkIds.length}`);
        }
        await client.query(`DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`, [corpusDocumentIds]);
        console.log(`  Deleted document_chunks for ${corpusDocumentIds.length} documents`);
        await client.query(`DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`, [corpusDocumentIds]);
        await client.query(`DELETE FROM public.corpus_documents WHERE id = ANY($1::uuid[])`, [corpusDocumentIds]);
        console.log(`  Deleted corpus_documents: ${corpusDocumentIds.length}`);
        await client.query(`DELETE FROM public.module_standard_citations WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]);
        await client.query(`UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]);
        await client.query(`DELETE FROM public.source_registry WHERE id = ANY($1::uuid[])`, [sourceRegistryIds]);
        console.log(`  Deleted source_registry: ${sourceRegistryIds.length}`);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    // Optional: delete file(s) from storage
    if (deleteFile && storageRelpaths.length > 0 && !dryRun) {
      const corpusRoot =
        process.env.CORPUS_SOURCES_ROOT ?? path.join(psaRebuildRoot, "storage", "corpus_sources");
      const rootAbs = path.isAbsolute(corpusRoot) ? corpusRoot : path.resolve(psaRebuildRoot, corpusRoot);
      for (const rel of storageRelpaths) {
        const absPath = path.join(rootAbs, rel.replace(/\\/g, path.sep));
        try {
          await fs.unlink(absPath);
          console.log(`  Deleted file: ${absPath}`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("ENOENT")) {
            console.log(`  File not found (already removed?): ${absPath}`);
          } else {
            console.warn(`  Failed to delete ${absPath}:`, msg);
          }
        }
      }
    } else if (deleteFile && dryRun && storageRelpaths.length > 0) {
      const corpusRoot =
        process.env.CORPUS_SOURCES_ROOT ?? path.join(psaRebuildRoot, "storage", "corpus_sources");
      const rootAbs = path.isAbsolute(corpusRoot) ? corpusRoot : path.resolve(psaRebuildRoot, corpusRoot);
      console.log("[DRY RUN] Would delete files under CORPUS_SOURCES_ROOT:");
      storageRelpaths.forEach((rel) => console.log(`  - ${path.join(rootAbs, rel)}`));
    }
  } finally {
    await corpusPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
