#!/usr/bin/env npx tsx
/**
 * Normalize all storage paths in DBs to the new organization: flat raw/ only.
 *
 * - CORPUS: corpus_documents.canonical_path, source_registry.local_path, source_registry.storage_relpath
 *   → raw/<basename> (no subdirs under raw)
 * - RUNTIME: document_blobs.storage_relpath → raw/<sha256>.pdf
 *   module_sources.storage_relpath → raw/<basename>
 *
 * Does not move files on disk. After running, move or copy PDFs into storage/.../raw/ to match, then run
 * backfill_corpus_document_paths_from_disk if needed for corpus.
 *
 * Env: CORPUS_DATABASE_URL, RUNTIME_DATABASE_URL (or RUNTIME_DATABASE_URL).
 *
 * Usage:
 *   npx tsx scripts/normalize_storage_paths_to_flat_raw.ts [--dry-run]
 */

import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { loadEnvLocal } from "../app/lib/db/load_env_local";
import { ensureNodePgTls } from "../app/lib/db/ensure_ssl";
import { applyNodeTls } from "../app/lib/db/pg_tls";

loadEnvLocal(process.cwd());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function basename(relpath: string): string {
  const normalized = relpath.replace(/\\/g, "/").trim();
  const last = normalized.split("/").pop() ?? normalized;
  return last || "file.pdf";
}

function toFlatRaw(relpath: string): string {
  const name = basename(relpath);
  return `raw/${name}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("[DRY RUN] No updates.\n");

  const corpusUrl = process.env.CORPUS_DATABASE_URL;
  const runtimeUrl = process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!corpusUrl || !runtimeUrl) {
    console.error("CORPUS_DATABASE_URL and RUNTIME_DATABASE_URL (or DATABASE_URL) required.");
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
    // --- CORPUS: corpus_documents.canonical_path ---
    const cdRows = await corpusPool.query<{ id: string; canonical_path: string | null }>(
      `SELECT id, canonical_path FROM public.corpus_documents WHERE canonical_path IS NOT NULL AND trim(canonical_path) <> ''`
    );
    let cdUpdated = 0;
    for (const row of cdRows.rows) {
      const current = (row.canonical_path ?? "").trim().replace(/\\/g, "/");
      const flat = toFlatRaw(current);
      if (flat === current) continue;
      console.log(`[corpus_documents] ${row.id.slice(0, 8)}… ${current} → ${flat}`);
      if (!dryRun) {
        await corpusPool.query(
          `UPDATE public.corpus_documents SET canonical_path = $1, updated_at = now() WHERE id = $2`,
          [flat, row.id]
        );
      }
      cdUpdated++;
    }
    console.log(`corpus_documents: ${cdUpdated} updated.\n`);

    // --- CORPUS: source_registry local_path, storage_relpath ---
    const srRows = await corpusPool.query<{ id: string; local_path: string | null; storage_relpath: string | null }>(
      `SELECT id, local_path, storage_relpath FROM public.source_registry WHERE (local_path IS NOT NULL AND trim(local_path) <> '') OR (storage_relpath IS NOT NULL AND trim(storage_relpath) <> '')`
    );
    let srUpdated = 0;
    for (const row of srRows.rows) {
      const updates: string[] = [];
      const params: (string | null)[] = [];
      let idx = 1;
      if (row.local_path && row.local_path.trim()) {
        const flat = toFlatRaw(row.local_path.trim().replace(/\\/g, "/"));
        if (flat !== row.local_path.trim().replace(/\\/g, "/")) {
          updates.push(`local_path = $${idx++}`);
          params.push(flat);
        }
      }
      if (row.storage_relpath && row.storage_relpath.trim()) {
        const flat = toFlatRaw(row.storage_relpath.trim().replace(/\\/g, "/"));
        if (flat !== row.storage_relpath.trim().replace(/\\/g, "/")) {
          updates.push(`storage_relpath = $${idx++}`);
          params.push(flat);
        }
      }
      if (updates.length === 0) continue;
      params.push(row.id);
      console.log(`[source_registry] ${row.id.slice(0, 8)}… → ${params.slice(0, -1).join(", ")}`);
      if (!dryRun) {
        await corpusPool.query(
          `UPDATE public.source_registry SET ${updates.join(", ")}, updated_at = now() WHERE id = $${idx}`,
          params
        );
      }
      srUpdated++;
    }
    console.log(`source_registry: ${srUpdated} updated.\n`);

    // --- RUNTIME: document_blobs.storage_relpath → raw/<sha256>.pdf ---
    const blobRows = await runtimePool.query<{ id: string; sha256: string; storage_relpath: string }>(
      `SELECT id, sha256, storage_relpath FROM public.document_blobs WHERE storage_relpath IS NOT NULL AND trim(storage_relpath) <> ''`
    );
    let blobUpdated = 0;
    for (const row of blobRows.rows) {
      const flat = `raw/${row.sha256}.pdf`;
      const current = (row.storage_relpath ?? "").trim().replace(/\\/g, "/");
      if (flat === current) continue;
      console.log(`[document_blobs] ${row.id.slice(0, 8)}… ${current} → ${flat}`);
      if (!dryRun) {
        await runtimePool.query(
          `UPDATE public.document_blobs SET storage_relpath = $1 WHERE id = $2`,
          [flat, row.id]
        );
      }
      blobUpdated++;
    }
    console.log(`document_blobs: ${blobUpdated} updated.\n`);

    // --- RUNTIME: module_sources.storage_relpath → raw/<basename> ---
    const msRows = await runtimePool.query<{ id: string; storage_relpath: string | null }>(
      `SELECT id, storage_relpath FROM public.module_sources WHERE storage_relpath IS NOT NULL AND trim(storage_relpath) <> ''`
    );
    let msUpdated = 0;
    for (const row of msRows.rows) {
      const current = (row.storage_relpath ?? "").trim().replace(/\\/g, "/");
      const flat = toFlatRaw(current);
      if (flat === current) continue;
      console.log(`[module_sources] ${row.id.slice(0, 8)}… ${current} → ${flat}`);
      if (!dryRun) {
        await runtimePool.query(
          `UPDATE public.module_sources SET storage_relpath = $1 WHERE id = $2`,
          [flat, row.id]
        );
      }
      msUpdated++;
    }
    console.log(`module_sources: ${msUpdated} updated.\n`);

    console.log("Done. Ensure PDFs on disk are under storage/*/raw/ to match.");
  } finally {
    await corpusPool.end();
    await runtimePool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
