#!/usr/bin/env tsx
/**
 * Backfill CORPUS source_registry from RUNTIME module documents (sha256-linked)
 * and populate RUNTIME.module_doc_source_link so standard/generate can attach citations.
 *
 * Usage:
 *   npx tsx tools/corpus/backfill_module_sources_to_corpus.ts <module_code>
 *   npx tsx tools/corpus/backfill_module_sources_to_corpus.ts MODULE_EV_PARKING_CHARGING
 *
 * Prerequisites:
 *   - RUNTIME: module_documents with status=INGESTED and sha256 set
 *   - Migration applied: db/migrations/runtime/20260202_module_doc_source_link.sql
 *   - CORPUS_DATABASE_URL and RUNTIME_DATABASE_URL (or DATABASE_URL) set in .env.local
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { getRuntimePool } from "../../app/lib/db/runtime_client";
import { getCorpusPoolForAdmin } from "../../app/lib/db/corpus_client";

const MODULE_CODE_ARG = process.argv[2];
if (!MODULE_CODE_ARG || !/^MODULE_[A-Z0-9_]+$/i.test(MODULE_CODE_ARG)) {
  console.error("Usage: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts <module_code>");
  console.error("Example: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts MODULE_EV_PARKING_CHARGING");
  process.exit(1);
}

const moduleCode = MODULE_CODE_ARG.trim();

async function main(): Promise<void> {
  const runtimePool = getRuntimePool();
  const corpusPool = getCorpusPoolForAdmin();

  // RUNTIME: distinct docs by sha256 with best label/local_path (from module_documents + module_sources)
  const docRows = await runtimePool.query<{
    doc_sha256: string;
    label: string;
    local_path: string | null;
  }>(
    `SELECT DISTINCT ON (COALESCE(md.sha256, md.id::text))
        COALESCE(md.sha256, md.id::text) AS doc_sha256,
        COALESCE(
          (SELECT ms.source_label FROM public.module_sources ms
           WHERE ms.module_code = md.module_code AND ms.sha256 = md.sha256 AND ms.source_type = 'MODULE_UPLOAD' LIMIT 1),
          md.label,
          ''
        ) AS label,
        md.local_path
     FROM public.module_documents md
     WHERE md.module_code = $1
       AND md.sha256 IS NOT NULL
       AND md.sha256 <> ''
     ORDER BY COALESCE(md.sha256, md.id::text), md.updated_at DESC`,
    [moduleCode]
  );

  if (docRows.rows.length === 0) {
    console.log(`No module_documents with sha256 found for ${moduleCode}. Nothing to backfill.`);
    await runtimePool.end();
    await corpusPool.end();
    return;
  }

  const sha256Prefix = (sha: string) => sha.slice(0, 12);
  const titleFromLabel = (label: string, sha: string): string => {
    const t = (label || "").trim();
    if (t && !/^[a-f0-9]{40,64}$/i.test(t)) return t.slice(0, 500);
    return `Document ${sha256Prefix(sha)}`;
  };

  // Guardrail: module_code MUST be set and MUST NOT be cleared on UPDATE.
  // Assessment corpus = source_registry where module_code IS NULL; these rows must stay module.
  for (const row of docRows.rows) {
    const doc_sha256 = row.doc_sha256;
    const title = titleFromLabel(row.label, doc_sha256);
    const source_key = `module:${moduleCode}:${sha256Prefix(doc_sha256)}`;
    const scope_tags = { source_type: "MODULE_UPLOAD", module_code: moduleCode };

    const upsert = await corpusPool.query<{ id: string }>(
      `INSERT INTO public.source_registry
         (source_key, publisher, tier, title, source_type, local_path, doc_sha256, scope_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (source_key) DO UPDATE SET
         title = EXCLUDED.title,
         publisher = EXCLUDED.publisher,
         local_path = EXCLUDED.local_path,
         doc_sha256 = EXCLUDED.doc_sha256,
         scope_tags = EXCLUDED.scope_tags,
         updated_at = now()
       RETURNING id`,
      [
        source_key,
        null, // module sources: scope/category only; no publisher
        3,
        title,
        "pdf",
        row.local_path ?? null,
        doc_sha256,
        JSON.stringify(scope_tags),
      ]
    );

    const source_registry_id = upsert.rows[0]?.id;
    if (!source_registry_id) {
      console.warn(`[SKIP] No id returned for doc_sha256=${sha256Prefix(doc_sha256)}…`);
      continue;
    }

    await runtimePool.query(
      `INSERT INTO public.module_doc_source_link (module_code, doc_sha256, source_registry_id)
       VALUES ($1, $2, $3::uuid)
       ON CONFLICT (module_code, doc_sha256) DO UPDATE SET source_registry_id = EXCLUDED.source_registry_id`,
      [moduleCode, doc_sha256, source_registry_id]
    );

    console.log(`${sha256Prefix(doc_sha256)}… -> ${source_registry_id} -> ${title.slice(0, 50)}${title.length > 50 ? "…" : ""}`);
  }

  console.log(`[OK] Backfilled ${docRows.rows.length} doc(s) for ${moduleCode}.`);
  await runtimePool.end();
  await corpusPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
