#!/usr/bin/env npx tsx
/**
 * Run PSA metadata extraction (psa-metadata:latest) on all sources in CORPUS DB.
 * For each source: get chunk excerpt, call Ollama, apply guarded write-back to source_registry and corpus_documents.
 *
 * Env: CORPUS_DATABASE_URL, RUNTIME_DATABASE_URL (for taxonomy). OLLAMA running with psa-metadata:latest.
 *
 * Usage:
 *   npx tsx scripts/run_metadata_on_db.ts
 *   npx tsx scripts/run_metadata_on_db.ts [--dry-run]
 */

import path from 'path';
import { loadEnvLocal } from '../app/lib/db/load_env_local';
import { getOllamaBaseUrl, ollamaHealthCheck } from '../app/lib/ollama/ollama_client';

loadEnvLocal(path.resolve(process.cwd()));

async function main() {
  console.log(`[ollama] baseUrl=${getOllamaBaseUrl()}`);
  console.log(`[env] OLLAMA_BASE_URL=${process.env.OLLAMA_BASE_URL ?? ''}`);
  console.log(`[env] OLLAMA_HOST=${process.env.OLLAMA_HOST ?? ''}`);

  const hc = await ollamaHealthCheck();
  if (!hc.ok) {
    console.error(`[ollama] UNREACHABLE baseUrl=${hc.baseUrl} error=${hc.error ?? ''} status=${hc.status ?? ''}`);
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('[DRY RUN] No DB updates. Ollama will still be called.');
  }

  const { getCorpusPoolForAdmin } = await import('../app/lib/db/corpus_client');
  const { getChunkExcerptForSource } = await import('../app/lib/sourceRegistry/analyzeScopeTags');
  const { getSectorTaxonomy } = await import('../app/lib/taxonomy/get_sector_taxonomy');
  const { extractDocumentMetadata } = await import('../app/lib/metadata/extract_document_metadata');
  const { applyExtractedMetadataToSourceRegistry, applyExtractedMetadataToCorpusDocument } = await import('../app/lib/metadata/apply_extracted_metadata');

  const pool = getCorpusPoolForAdmin();

  const sourcesResult = await pool.query<{ id: string; source_key: string }>(
    `SELECT id, source_key FROM public.source_registry ORDER BY source_key`
  );
  const sources = sourcesResult.rows ?? [];
  console.log(`Sources in DB: ${sources.length}`);

  const taxonomy = await getSectorTaxonomy();
  console.log(`Taxonomy: ${taxonomy.sectors.length} sectors, ${taxonomy.subsectors.length} subsectors`);

  let processed = 0;
  let srUpdated = 0;
  let cdUpdated = 0;
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const excerpt = await getChunkExcerptForSource(pool, source.id, { maxChunks: 15, maxChars: 12000 });
      const extracted = await extractDocumentMetadata({ excerpt: excerpt || undefined, taxonomy });

      if (!dryRun) {
        await applyExtractedMetadataToSourceRegistry(pool, source.id, extracted);
        srUpdated++;

        const docsResult = await pool.query<{ id: string }>(
          `SELECT id FROM public.corpus_documents WHERE source_registry_id = $1`,
          [source.id]
        );
        for (const doc of docsResult.rows ?? []) {
          await applyExtractedMetadataToCorpusDocument(pool, doc.id, extracted);
          cdUpdated++;
        }
      }
      processed++;
      if (processed % 5 === 0 || processed === sources.length) {
        console.log(`  Processed ${processed}/${sources.length} sources`);
      }
    } catch (e) {
      const msg = `${source.source_key}: ${e instanceof Error ? e.message : String(e)}`;
      errors.push(msg);
      console.warn(`  Error: ${msg}`);
    }
  }

  console.log(`\nDone. Processed: ${processed}, source_registry apply runs: ${dryRun ? '0 (dry-run)' : srUpdated}, corpus_documents apply runs: ${dryRun ? '0 (dry-run)' : cdUpdated}`);
  if (errors.length) {
    console.log(`Errors: ${errors.length}`);
    errors.slice(0, 20).forEach((e) => console.log(`  ${e}`));
    if (errors.length > 20) console.log(`  ... and ${errors.length - 20} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
