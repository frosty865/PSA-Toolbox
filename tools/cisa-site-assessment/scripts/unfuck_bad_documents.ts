#!/usr/bin/env npx tsx
/**
 * Move bad documents to unfuck/ and remove every DB reference (CORPUS + RUNTIME).
 *
 * Bad = no publisher, no title, or zero chunks:
 * - source_registry.publisher null/empty/unacceptable OR source_registry.title null/empty/unacceptable
 * - OR corpus_documents.chunk_count = 0
 *
 * For each bad document: move actual file to <cwd>/unfuck/, then delete:
 * CORPUS: document_chunks, module_source_documents, corpus_reprocess_queue, corpus_documents.
 * Then delete any source_registry that has zero corpus_documents left, and all RUNTIME refs to those sources.
 *
 * Usage:
 *   npx tsx scripts/unfuck_bad_documents.ts [--dry-run]
 */

import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { getCorpusPoolForAdmin } from "../app/lib/db/corpus_client";
import { getRuntimePool } from "../app/lib/db/runtime_client";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { isUnacceptablePublisher } from "../app/lib/sourceRegistry/publisherNormalizer";
import { isUnacceptableTitle } from "../app/lib/sourceRegistry/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const psaRebuildRoot = path.resolve(__dirname, "..");

/** Corpus root without importing server-only config. Same logic as getCorpusSourcesRoot(). */
function getCorpusSourcesRoot(): string {
  const raw = process.env.CORPUS_SOURCES_ROOT ?? "storage/corpus_sources";
  return path.isAbsolute(raw) ? raw : path.resolve(psaRebuildRoot, raw);
}

function isBadPublisher(p: string | null | undefined): boolean {
  if (p == null) return true;
  const t = String(p).trim();
  if (t.length === 0) return true;
  return isUnacceptablePublisher(t);
}

function isBadTitle(t: string | null | undefined): boolean {
  if (t == null) return true;
  const s = String(t).trim();
  if (s.length === 0) return true;
  return isUnacceptableTitle(s);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadEnvLocal(psaRebuildRoot);

  const corpusPool = getCorpusPoolForAdmin();
  const runtimePool = getRuntimePool();

  const unfuckDir = path.join(psaRebuildRoot, "unfuck");
  if (!dryRun) {
    await fs.mkdir(unfuckDir, { recursive: true });
  }

  const client = await corpusPool.connect();
  try {
    // 1) Bad source_registry ids (no publisher or no title) — filter in TS to use shared unacceptable lists
    const allSources = await client.query(
      `SELECT id, source_key, publisher, title FROM public.source_registry`
    );
    const badSourceIds = new Set<string>(
      (allSources.rows as Array<{ id: string; publisher: string | null; title: string | null }>)
        .filter((r) => isBadPublisher(r.publisher) || isBadTitle(r.title))
        .map((r) => r.id)
    );

    // 2) Bad corpus_documents: under a bad source OR chunk_count = 0
    const badDocsResult = await client.query(
      `SELECT cd.id, cd.canonical_path, cd.file_hash, cd.original_filename, cd.source_registry_id, cd.chunk_count
       FROM public.corpus_documents cd
       LEFT JOIN public.source_registry sr ON sr.id = cd.source_registry_id
       WHERE cd.chunk_count = 0
          OR cd.source_registry_id = ANY($1::uuid[])`,
      [badSourceIds.size > 0 ? Array.from(badSourceIds) : []]
    );

    const badDocRows = badDocsResult.rows as Array<{
      id: string;
      canonical_path: string | null;
      file_hash: string;
      original_filename: string | null;
      source_registry_id: string | null;
      chunk_count: number;
    }>;
    const badDocIds = badDocRows.map((r) => r.id);

    if (badDocIds.length === 0) {
      console.log("No bad documents to unfuck.");
      return;
    }

    console.log(`Found ${badDocIds.length} bad document(s) to unfuck.`);
    if (dryRun) {
      for (const r of badDocRows) {
        console.log(
          `  [dry-run] would move doc ${r.id} (chunks=${r.chunk_count}) path=${r.canonical_path ?? "null"} -> unfuck/`
        );
      }
      console.log("[dry-run] Would delete document_chunks, module_source_documents, corpus_reprocess_queue, corpus_documents for these ids.");
      console.log("[dry-run] Would then delete any orphaned source_registry and RUNTIME refs.");
      return;
    }

    const corpusRoot = getCorpusSourcesRoot();

    // 3) Move files to unfuck/
    for (const r of badDocRows) {
      let absPath: string | null = null;
      if (r.canonical_path && r.canonical_path.trim()) {
        absPath = path.isAbsolute(r.canonical_path)
          ? r.canonical_path
          : path.join(corpusRoot, r.canonical_path);
      }
      if (!absPath) {
        console.warn(`[skip file] doc ${r.id} has no canonical_path`);
        continue;
      }
      try {
        await fs.access(absPath);
      } catch {
        console.warn(`[skip file] doc ${r.id} file not found: ${absPath}`);
        continue;
      }
      const ext = path.extname(r.original_filename || "") || path.extname(absPath) || ".pdf";
      const base = (r.file_hash || r.id).slice(0, 16) + "_" + (path.basename(absPath, ext) || r.id);
      const destPath = path.join(unfuckDir, base + ext);
      await fs.rename(absPath, destPath);
      console.log(`[moved] ${absPath} -> ${destPath}`);
    }

    await client.query("BEGIN");

    // 4) CORPUS: delete dependents of bad docs then docs
    const hasChunks = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_chunks'`
    );
    if (hasChunks.rows.length > 0) {
      const delChunks = await client.query(
        `DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
        [badDocIds]
      );
      console.log(`[CORPUS] document_chunks deleted: ${delChunks.rowCount ?? 0}`);
    }

    const hasMsd = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_source_documents'`
    );
    if (hasMsd.rows.length > 0) {
      const delMsd = await client.query(
        `DELETE FROM public.module_source_documents WHERE corpus_document_id = ANY($1::uuid[])`,
        [badDocIds]
      );
      console.log(`[CORPUS] module_source_documents deleted: ${delMsd.rowCount ?? 0}`);
    }

    const hasQueue = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corpus_reprocess_queue'`
    );
    if (hasQueue.rows.length > 0) {
      const delQueue = await client.query(
        `DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`,
        [badDocIds]
      );
      console.log(`[CORPUS] corpus_reprocess_queue deleted: ${delQueue.rowCount ?? 0}`);
    }

    const delDocs = await client.query(
      `DELETE FROM public.corpus_documents WHERE id = ANY($1::uuid[]) RETURNING id, source_registry_id`,
      [badDocIds]
    );
    console.log(`[CORPUS] corpus_documents deleted: ${delDocs.rowCount ?? 0}`);

    // 5) Orphaned sources: source_registry with zero corpus_documents left
    const orphaned = await client.query(
      `SELECT sr.id, sr.source_key
       FROM public.source_registry sr
       WHERE NOT EXISTS (SELECT 1 FROM public.corpus_documents cd WHERE cd.source_registry_id = sr.id)`
    );
    const orphanedIds = orphaned.rows.map((r: { id: string }) => r.id);
    const orphanedKeys = orphaned.rows.map((r: { source_key: string }) => r.source_key);

    if (orphanedIds.length > 0) {
      const runtimeClient = await runtimePool.connect();
      try {
        await runtimeClient.query("BEGIN");

        const hasMoc = await runtimeClient.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_ofc_citations'`
        );
        if (hasMoc.rows.length > 0) {
          const d = await runtimeClient.query(
            `DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
            [orphanedIds]
          );
          console.log(`[RUNTIME] module_ofc_citations deleted: ${d.rowCount ?? 0}`);
        }

        const hasMcl = await runtimeClient.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_corpus_links'`
        );
        if (hasMcl.rows.length > 0) {
          const d = await runtimeClient.query(
            `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
            [orphanedIds]
          );
          console.log(`[RUNTIME] module_corpus_links deleted: ${d.rowCount ?? 0}`);
        }

        const hasMcc = await runtimeClient.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_chunk_comprehension'`
        );
        if (hasMcc.rows.length > 0) {
          const d = await runtimeClient.query(
            `DELETE FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`,
            [orphanedIds]
          );
          console.log(`[RUNTIME] module_chunk_comprehension deleted: ${d.rowCount ?? 0}`);
        }

        const hasMq = await runtimeClient.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_questions' AND column_name = 'evidence_anchors'`
        );
        if (hasMq.rows.length > 0) {
          await runtimeClient.query(
            `UPDATE public.module_questions
             SET evidence_anchors = (
               SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
               FROM jsonb_array_elements(evidence_anchors) elem
               WHERE elem->>'source_registry_id' != ALL($1::text[])
             )
             WHERE evidence_anchors IS NOT NULL
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(evidence_anchors) elem
                 WHERE elem->>'source_registry_id' = ANY($1::text[])
               )`,
            [orphanedIds]
          );
          console.log("[RUNTIME] module_questions.evidence_anchors updated");
        }

        await runtimeClient.query("COMMIT");
      } catch (e) {
        await runtimeClient.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        runtimeClient.release();
      }

      // CORPUS: canonical_sources (by source_key), module_standards (by source_registry_id), source_registry
      const hasCs = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'canonical_sources'`
      );
      if (hasCs.rows.length > 0 && orphanedKeys.length > 0) {
        await client.query(
          `DELETE FROM public.canonical_sources WHERE source_key = ANY($1::text[])`,
          [orphanedKeys]
        );
      }

      const hasMs = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_standards' AND column_name = 'source_registry_id'`
      );
      if (hasMs.rows.length > 0) {
        await client.query(
          `DELETE FROM public.module_standards WHERE source_registry_id = ANY($1::uuid[])`,
          [orphanedIds]
        );
      }

      await client.query(
        `DELETE FROM public.source_registry WHERE id = ANY($1::uuid[])`,
        [orphanedIds]
      );
      console.log(`[CORPUS] orphaned source_registry deleted: ${orphanedIds.length}`);
    }

    await client.query("COMMIT");
    console.log("Done. Bad documents moved to unfuck/ and all DB references removed.");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
