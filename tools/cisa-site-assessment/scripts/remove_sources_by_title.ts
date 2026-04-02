#!/usr/bin/env npx tsx
/**
 * Remove specific sources (and all associated data) by title or source_key patterns.
 * Matches source_registry.title, source_key, and linked corpus_documents (inferred_title, file_stem, original_filename).
 *
 * Env: CORPUS_DATABASE_URL (required), RUNTIME_DATABASE_URL (for RUNTIME cleanup).
 *
 * Usage:
 *   npx tsx scripts/remove_sources_by_title.ts [--dry-run]
 *   npx tsx scripts/remove_sources_by_title.ts --list   # print all titles/source_keys to find correct patterns
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Substrings to match source_registry.title, source_key, or corpus_documents (case-insensitive). Any match = remove. */
const TITLE_PATTERNS = [
  "TIER1_PLANNING_TEMPLATES_",
  "TIER1_FACILITY_HARDENING_",
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const listOnly = process.argv.includes("--list");
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
    if (listOnly) {
      const listResult = await corpusPool.query<{ id: string; source_key: string; title: string | null }>(
        `SELECT sr.id, sr.source_key, sr.title FROM public.source_registry sr ORDER BY sr.title, sr.source_key`
      );
      console.log("source_registry rows (id | source_key | title):");
      listResult.rows.forEach((r) => console.log(`  ${r.id} | ${r.source_key} | ${r.title ?? "(null)"}`));
      const docResult = await corpusPool.query<{ source_registry_id: string; inferred_title: string | null; file_stem: string | null; original_filename: string | null }>(
        `SELECT cd.source_registry_id, cd.inferred_title, cd.file_stem, cd.original_filename FROM public.corpus_documents cd WHERE cd.source_registry_id IS NOT NULL ORDER BY cd.source_registry_id, cd.inferred_title`
      );
      console.log("\ncorpus_documents (source_registry_id | inferred_title | file_stem | original_filename):");
      docResult.rows.forEach((r) => console.log(`  ${r.source_registry_id} | ${r.inferred_title ?? "(null)"} | ${r.file_stem ?? "(null)"} | ${r.original_filename ?? "(null)"}`));
      return;
    }

    console.log("Matching sources by title/source_key/document patterns:", TITLE_PATTERNS.length);

    // 1) Source registry IDs where: sr.title/source_key matches OR any linked corpus_document inferred_title/file_stem/original_filename matches
    const params = TITLE_PATTERNS.map((p) => `%${p}%`);
    const srConditions = TITLE_PATTERNS.map((_, i) => `(sr.title ILIKE $${i + 1} OR sr.source_key ILIKE $${i + 1})`).join(" OR ");
    const cdConditions = TITLE_PATTERNS.map((_, i) => `(cd.inferred_title ILIKE $${i + 1} OR cd.file_stem ILIKE $${i + 1} OR cd.original_filename ILIKE $${i + 1})`).join(" OR ");
    const srcResult = await corpusPool.query<{ id: string; source_key: string; title: string | null }>(
      `SELECT DISTINCT sr.id, sr.source_key, sr.title
       FROM public.source_registry sr
       LEFT JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
       WHERE (${srConditions}) OR (cd.id IS NOT NULL AND (${cdConditions}))`,
      params
    );
    const sourceRegistryIds = srcResult.rows.map((r) => r.id);
    console.log(`[CORPUS] source_registry rows matching patterns: ${sourceRegistryIds.length}`);
    if (sourceRegistryIds.length > 0) {
      srcResult.rows.forEach((r) => console.log(`  - ${r.source_key} | ${(r.title ?? "").slice(0, 60)}`));
    }
    if (sourceRegistryIds.length === 0) {
      console.log("No matching sources found. Run with --list to see stored title/source_key and document inferred_title/file_stem.");
      return;
    }

    // 2) Corpus document IDs linked to those sources
    const docResult = await corpusPool.query<{ id: string }>(
      `SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[])`,
      [sourceRegistryIds]
    );
    const corpusDocumentIds = docResult.rows.map((r) => r.id);
    console.log(`[CORPUS] corpus_documents to remove: ${corpusDocumentIds.length}`);

    // 3) Chunk IDs for rag_chunks + document_chunks
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
      console.log(`  - module_standard_references: set source_registry_id NULL`);
      console.log(`  - source_registry: ${sourceRegistryIds.length} rows`);
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
        await client.query(
          `UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id = ANY($1::uuid[])`,
          [sourceRegistryIds]
        );
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

    // RUNTIME cleanup
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
        const [ms, mcl, moc] = await Promise.all([
          runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`, [sourceRegistryIds]),
          runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
          runtimePool.query(`SELECT COUNT(*) AS n FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]),
        ]);
        console.log("[DRY RUN] RUNTIME would delete:");
        console.log(`  - module_sources: ${ms.rows[0]?.n ?? 0} rows`);
        console.log(`  - module_corpus_links: ${mcl.rows[0]?.n ?? 0} rows`);
        console.log(`  - module_ofc_citations: ${moc.rows[0]?.n ?? 0} rows`);
      } else {
        const delMs = await runtimePool.query(`DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`, [sourceRegistryIds]);
        const delMcl = await runtimePool.query(`DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]);
        const delMoc = await runtimePool.query(`DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`, [sourceRegistryIds]);
        console.log("[RUNTIME] Removed references:");
        console.log(`  - module_sources: ${delMs.rowCount ?? 0}`);
        console.log(`  - module_corpus_links: ${delMcl.rowCount ?? 0}`);
        console.log(`  - module_ofc_citations: ${delMoc.rowCount ?? 0}`);
      }
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
