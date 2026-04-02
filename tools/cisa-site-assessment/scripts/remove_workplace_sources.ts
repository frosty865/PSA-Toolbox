#!/usr/bin/env npx tsx
/**
 * Remove all sources (and associated rows) whose path contains "workplace".
 * Runs against CORPUS and RUNTIME. Use when cleaning out workplace-related files from
 * source_registry, corpus_documents, document_chunks, rag_chunks, and RUNTIME references.
 *
 * Env: CORPUS_DATABASE_URL (required), RUNTIME_DATABASE_URL (required for RUNTIME cleanup).
 *
 * Usage:
 *   npx tsx scripts/remove_workplace_sources.ts [--dry-run]
 *
 *   --dry-run   Log what would be deleted; do not execute deletes.
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

const PATH_PATTERN = "%workplace%";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[DRY RUN] No rows will be deleted.");
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
    // 1) Source registry IDs whose path contains "workplace"
    const srcResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.source_registry
       WHERE (local_path IS NOT NULL AND local_path ILIKE $1)
          OR (storage_relpath IS NOT NULL AND storage_relpath ILIKE $1)`,
      [PATH_PATTERN]
    );
    const sourceRegistryIds = srcResult.rows.map((r) => r.id);
    console.log(`[CORPUS] source_registry rows matching path '%workplace%': ${sourceRegistryIds.length}`);
    if (sourceRegistryIds.length === 0) {
      console.log("No workplace sources found. Exiting.");
      return;
    }

    // 2) Corpus document IDs: linked to those sources OR canonical_path contains "workplace"
    const docResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.corpus_documents
       WHERE source_registry_id = ANY($1::uuid[])
          OR (canonical_path IS NOT NULL AND canonical_path ILIKE $2)`,
      [sourceRegistryIds, PATH_PATTERN]
    );
    const corpusDocumentIds = [...new Set(docResult.rows.map((r) => r.id))];
    console.log(`[CORPUS] corpus_documents to remove: ${corpusDocumentIds.length}`);

    // 3) Chunk IDs from those documents (for rag_chunks + document_chunks)
    const chunkResult = await corpusPool.query<{ chunk_id: string }>(
      `SELECT chunk_id FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
      [corpusDocumentIds]
    );
    const chunkIds = chunkResult.rows.map((r) => r.chunk_id);
    console.log(`[CORPUS] document_chunks (and rag_chunks) to remove: ${chunkIds.length}`);

    if (dryRun) {
      console.log("[DRY RUN] Would delete/update:");
      console.log(`  - rag_chunks: ${chunkIds.length} rows`);
      console.log(`  - document_chunks: ${chunkIds.length} rows`);
      console.log(`  - corpus_reprocess_queue: by corpus_document_id (${corpusDocumentIds.length} docs)`);
      console.log(`  - corpus_documents: ${corpusDocumentIds.length} rows`);
      console.log(`  - module_standard_references: set source_registry_id NULL for workplace sources`);
      console.log(`  - source_registry: ${sourceRegistryIds.length} rows`);
    } else {
      const client = await corpusPool.connect();
      try {
        await client.query("BEGIN");
        if (chunkIds.length > 0) {
          await client.query(
            `DELETE FROM public.rag_chunks WHERE chunk_id = ANY($1::text[])`,
            [chunkIds]
          );
          console.log(`  Deleted rag_chunks: ${chunkIds.length}`);
        }
        await client.query(
          `DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
          [corpusDocumentIds]
        );
        console.log(`  Deleted document_chunks for ${corpusDocumentIds.length} documents`);
        await client.query(
          `DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`,
          [corpusDocumentIds]
        );
        await client.query(
          `DELETE FROM public.corpus_documents WHERE id = ANY($1::uuid[])`,
          [corpusDocumentIds]
        );
        console.log(`  Deleted corpus_documents: ${corpusDocumentIds.length}`);
        await client.query(
          `UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
        await client.query(
          `DELETE FROM public.source_registry WHERE id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
        console.log(`  Deleted source_registry: ${sourceRegistryIds.length}`);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    // RUNTIME: remove references to deleted source_registry IDs
    const runtimeUrl = process.env.RUNTIME_DATABASE_URL || process.env.RUNTIME_DB_URL;
    if (!runtimeUrl) {
      console.log("RUNTIME_DATABASE_URL not set; skipping RUNTIME cleanup.");
      return;
    }

    const runtimePool = new Pool(
      applyNodeTls({
        connectionString: ensureNodePgTls(runtimeUrl) ?? runtimeUrl,
        ssl: { rejectUnauthorized: false },
      })
    );

    try {
      if (dryRun) {
        const ms = await runtimePool.query(
          `SELECT COUNT(*) AS n FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
        const mcl = await runtimePool.query(
          `SELECT COUNT(*) AS n FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
        const moc = await runtimePool.query(
          `SELECT COUNT(*) AS n FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
        console.log("[DRY RUN] RUNTIME would delete:");
        console.log(`  - module_sources: ${ms.rows[0]?.n ?? 0} rows`);
        console.log(`  - module_corpus_links: ${mcl.rows[0]?.n ?? 0} rows`);
        console.log(`  - module_ofc_citations: ${moc.rows[0]?.n ?? 0} rows`);
        return;
      }

      const delMs = await runtimePool.query(
        `DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`,
        [sourceRegistryIds]
      );
      const delMcl = await runtimePool.query(
        `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
        [sourceRegistryIds]
      );
      const delMoc = await runtimePool.query(
        `DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
        [sourceRegistryIds]
      );
      console.log("[RUNTIME] Removed references:");
      console.log(`  - module_sources: ${delMs.rowCount ?? 0}`);
      console.log(`  - module_corpus_links: ${delMcl.rowCount ?? 0}`);
      console.log(`  - module_ofc_citations: ${delMoc.rowCount ?? 0}`);
    } finally {
      await runtimePool.end();
    }
  } finally {
    await corpusPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
