#!/usr/bin/env npx tsx
/**
 * Backfill publisher (and title when null) for module source_registry rows by parsing each PDF.
 * Queries CORPUS source_registry WHERE source_key LIKE 'module:%' AND publisher IS NULL/empty,
 * resolves file path (under MODULE_SOURCES_ROOT), runs extract_pdf_metadata, updates source_registry.
 *
 * Usage:
 *   npx tsx tools/corpus/backfill_module_source_publisher.ts
 *   npx tsx tools/corpus/backfill_module_source_publisher.ts --dry-run
 *
 * Requires: CORPUS_DATABASE_URL, MODULE_SOURCES_ROOT (or default storage/module_sources).
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getCorpusPoolForAdmin } from "../../app/lib/db/corpus_client";
import {
  resolvePathForSourceRegistryRow,
  extractAndApplyPublisherToSourceRegistry,
  type ModuleSourceRegistryRow,
} from "../../app/lib/corpus/extract_module_source_publisher";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const pool = getCorpusPoolForAdmin();
  const dryRun = DRY_RUN;
  if (dryRun) {
    console.log("Dry run: no DB updates.");
  }

  const rows = await pool.query<ModuleSourceRegistryRow>(
    `SELECT id, source_key, local_path, storage_relpath
     FROM public.source_registry
     WHERE source_key LIKE 'module:%'
       AND (publisher IS NULL OR trim(publisher) = '')`
  );

  if (rows.rows.length === 0) {
    console.log("No module source_registry rows with missing publisher.");
    return;
  }

  console.log(`Found ${rows.rows.length} module source(s) with missing publisher.`);

  let updated = 0;
  let skippedNoPath = 0;
  let skippedError = 0;

  for (const row of rows.rows) {
    const absPath = resolvePathForSourceRegistryRow(row);
    if (!absPath) {
      skippedNoPath++;
      console.warn(`  No file: ${row.source_key} (local_path=${row.local_path ?? ""})`);
      continue;
    }
    if (dryRun) {
      console.log(`  Would extract: ${row.source_key} -> ${absPath}`);
      updated++;
      continue;
    }
    const result = await extractAndApplyPublisherToSourceRegistry(pool, row.id, absPath);
    if (result.error) {
      skippedError++;
      console.warn(`  Error ${row.source_key}: ${result.error}`);
      continue;
    }
    if (result.updated) {
      updated++;
      console.log(`  Updated ${row.source_key}: publisher=${result.publisher ?? "(none)"}, title=${result.title ?? "(unchanged)"}`);
    }
  }

  console.log(`Done. Updated: ${updated}, no file: ${skippedNoPath}, error: ${skippedError}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
