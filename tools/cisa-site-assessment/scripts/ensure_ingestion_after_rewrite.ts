#!/usr/bin/env npx tsx
/**
 * After rewriting corpus_documents paths (old workspace → current), run this to:
 * 1) Sync chunk_count from document_chunks (fix drift)
 * 2) Queue all zero-chunk docs with source_registry_id into corpus_reprocess_queue
 *
 * Then run the reprocess worker to re-ingest PDFs and populate document_chunks.
 * If rag_chunks is still empty after ingestion, run the RAG backfill.
 *
 * Database: CORPUS only.
 *
 * Usage:
 *   npx tsx scripts/ensure_ingestion_after_rewrite.ts [--queue-limit N]
 *
 * Prerequisite: Paths already rewritten (e.g. OLD_PATH_PREFIX + rewrite_corpus_document_paths.ts --source-registry).
 */

import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { getCorpusPool } from "../app/lib/db/corpus_client";
import {
  syncChunkCounts,
  queueZeroChunk,
  countZeroChunkWithSource,
} from "../app/lib/corpus/sync_and_queue_zero_chunk";

loadEnvLocal(process.cwd());

async function main() {
  const queueLimit = process.argv.includes("--queue-limit")
    ? parseInt(process.argv[process.argv.indexOf("--queue-limit") + 1], 10) || 500
    : 500;

  const pool = getCorpusPool();

  console.log("1) Syncing chunk_count from document_chunks...");
  const { updated: syncUpdated } = await syncChunkCounts(pool);
  console.log(`   Updated ${syncUpdated} row(s) where document_chunks had rows but chunk_count was 0.`);

  const remaining = await countZeroChunkWithSource(pool);
  console.log(`2) Zero-chunk docs (with source_registry_id): ${remaining}`);

  const { queued, skipped_missing_source_registry_id } = await queueZeroChunk(pool, queueLimit);
  console.log(`   Queued ${queued} doc(s) for reprocess. Skipped (no source_registry_id): ${skipped_missing_source_registry_id}.`);

  await pool.end();

  console.log("");
  console.log("Next steps:");
  console.log("  • Run the reprocess worker to re-ingest PDFs and populate document_chunks:");
  console.log("    npm run corpus:reprocess-worker");
  console.log("    (Use REPROCESS_RECURSIVE_CHUNK=1 to re-queue zero-chunk until done.)");
  console.log("");
  console.log("  • If rag_chunks is still empty after ingestion, backfill from document_chunks:");
  console.log("    python tools/rag/backfill_rag_chunks_from_document_chunks.py");
  console.log("    (Requires CORPUS_DATABASE_URL, OLLAMA_HOST, RAG_EMBED_MODEL.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
