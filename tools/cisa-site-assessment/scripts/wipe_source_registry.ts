#!/usr/bin/env npx tsx
/**
 * Wipe the entire source_registry and all dependent rows (CORPUS + RUNTIME).
 * After running, the Source Registry UI (including "Corpus" category) will show no entries.
 *
 * Env: CORPUS_DATABASE_URL (required), RUNTIME_DATABASE_URL or RUNTIME_DB_URL (required for RUNTIME cleanup).
 *
 * Usage:
 *   npx tsx scripts/wipe_source_registry.ts [--dry-run]
 *
 *   --dry-run   Log what would be deleted; do not execute.
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

loadEnvLocal(psaRebuildRoot);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN] No rows will be deleted.\n");

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  if (!corpusUrl) {
    console.error("CORPUS_DATABASE_URL is required.");
    process.exit(1);
  }

  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.RUNTIME_DB_URL;
  if (!runtimeUrl) {
    console.error("RUNTIME_DATABASE_URL or RUNTIME_DB_URL is required for RUNTIME cleanup.");
    process.exit(1);
  }

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

  try {
    const idResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.source_registry`
    );
    const allIds = idResult.rows.map((r) => r.id);
    if (allIds.length === 0) {
      console.log("source_registry is already empty.");
      return;
    }

    console.log(`source_registry: ${allIds.length} row(s) to delete (full cascade).`);

    if (dryRun) {
      const keyResult = await corpusPool.query<{ source_key: string }>(
        `SELECT source_key FROM public.source_registry LIMIT 10`
      );
      console.log("[DRY RUN] Sample source_keys:", keyResult.rows.map((r) => r.source_key).join(", "));
      if (allIds.length > 10) console.log(`  ... and ${allIds.length - 10} more.`);
      return;
    }

    const keyResult = await corpusPool.query<{ source_key: string }>(
      `SELECT source_key FROM public.source_registry`
    );
    const deletedSourceKeys = keyResult.rows.map((r) => r.source_key).filter(Boolean);

    const docResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[])`,
      [allIds]
    );
    const corpusDocumentIds = docResult.rows.map((r) => r.id);
    const chunkResult = await corpusPool.query<{ chunk_id: string }>(
      `SELECT chunk_id FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
      [corpusDocumentIds]
    );
    const chunkIds = chunkResult.rows.map((r) => r.chunk_id);

    const client = await corpusPool.connect();
    try {
      await client.query("BEGIN");
      if (chunkIds.length > 0) {
        await client.query(`DELETE FROM public.rag_chunks WHERE chunk_id = ANY($1::text[])`, [chunkIds]);
        console.log(`  rag_chunks: ${chunkIds.length}`);
      }
      await client.query(
        `DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
        [corpusDocumentIds]
      );
      console.log(`  document_chunks: ${corpusDocumentIds.length} docs`);
      await client.query(
        `DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`,
        [corpusDocumentIds]
      );
      await client.query(
        `UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id = ANY($1::uuid[])`,
        [allIds]
      );
      await client.query(
        `DELETE FROM public.module_standard_citations WHERE source_registry_id = ANY($1::uuid[])`,
        [allIds]
      );
      const hasModuleStandardsSrId = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_standards' AND column_name = 'source_registry_id'`
      );
      if (hasModuleStandardsSrId.rows.length > 0) {
        await client.query(
          `DELETE FROM public.module_standards WHERE source_registry_id = ANY($1::uuid[])`,
          [allIds]
        );
      }
      await client.query(
        `DELETE FROM public.module_source_documents WHERE corpus_document_id = ANY($1::uuid[])`,
        [corpusDocumentIds]
      );
      await client.query(`DELETE FROM public.corpus_documents WHERE id = ANY($1::uuid[])`, [corpusDocumentIds]);
      await client.query(`DELETE FROM public.source_registry WHERE id = ANY($1::uuid[])`, [allIds]);
      await client.query("COMMIT");
      console.log(`  corpus_documents: ${corpusDocumentIds.length}`);
      console.log(`  source_registry: ${allIds.length}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const delMs = await runtimePool.query(
      `DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`,
      [allIds]
    );
    await runtimePool.query(
      `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
      [allIds]
    );
    await runtimePool.query(
      `DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
      [allIds]
    );
    await runtimePool.query(
      `DELETE FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`,
      [allIds]
    );
    if (deletedSourceKeys.length > 0) {
      await runtimePool.query(
        `UPDATE public.ofc_library_citations SET source_key = NULL WHERE source_key = ANY($1::text[])`,
        [deletedSourceKeys]
      );
    }
    console.log(`  [RUNTIME] module_sources: ${delMs.rowCount ?? 0}, module_corpus_links, module_ofc_citations, module_chunk_comprehension, ofc_library_citations (nulled).`);
    console.log("Done. Source registry is empty; Corpus category will show no entries.");
  } finally {
    await corpusPool.end();
    await runtimePool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
