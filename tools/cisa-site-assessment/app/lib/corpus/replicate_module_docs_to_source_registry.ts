/**
 * Replicate ingested module documents (RUNTIME.module_documents) into CORPUS.source_registry
 * and link them via RUNTIME.module_doc_source_link. This ensures standard/generate can cite
 * module uploads by source_registry_id without a separate backfill step.
 *
 * Call after ingestion completes (e.g. from process-incoming-pdfs API or backfill CLI).
 * Requires: CORPUS_DATABASE_URL, RUNTIME DB with module_doc_source_link table.
 */

import type { Pool } from "pg";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPoolForAdmin } from "@/app/lib/db/corpus_client";

export type ReplicateResult = { replicated: number };

const MODULE_CODE_RE = /^MODULE_[A-Z0-9_]+$/i;

function sha256Prefix(sha: string): string {
  return sha.slice(0, 12);
}

function titleFromLabel(label: string, sha: string): string {
  const t = (label || "").trim();
  if (t && !/^[a-f0-9]{40,64}$/i.test(t)) return t.slice(0, 500);
  return `Document ${sha256Prefix(sha)}`;
}

/**
 * Upsert CORPUS.source_registry for each RUNTIME module document (by sha256) and
 * insert/update RUNTIME.module_doc_source_link. Returns number of docs replicated.
 * Use getCorpusPoolForAdmin() for writes; throws if CORPUS is not configured.
 */
export async function replicateModuleDocsToSourceRegistry(
  moduleCode: string,
  options?: { runtimePool?: Pool; corpusPool?: Pool }
): Promise<ReplicateResult> {
  const normalized = moduleCode.trim();
  if (!MODULE_CODE_RE.test(normalized)) {
    throw new Error(`Invalid module_code: ${moduleCode}`);
  }

  const runtimePool = options?.runtimePool ?? getRuntimePool();
  let corpusPool: Pool;
  try {
    corpusPool = options?.corpusPool ?? getCorpusPoolForAdmin();
  } catch (_e) {
    throw new Error(
      "CORPUS database is not available for replication. Set CORPUS_DATABASE_URL and ensure module_doc_source_link migration is applied on RUNTIME."
    );
  }

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
    [normalized]
  );

  if (docRows.rows.length === 0) {
    return { replicated: 0 };
  }

  for (const row of docRows.rows) {
    const doc_sha256 = row.doc_sha256;
    const title = titleFromLabel(row.label, doc_sha256);
    const source_key = `module:${normalized}:${sha256Prefix(doc_sha256)}`;
    const scope_tags = { source_type: "MODULE_UPLOAD", module_code: normalized };

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
    if (!source_registry_id) continue;

    await runtimePool.query(
      `INSERT INTO public.module_doc_source_link (module_code, doc_sha256, source_registry_id)
       VALUES ($1, $2, $3::uuid)
       ON CONFLICT (module_code, doc_sha256) DO UPDATE SET source_registry_id = EXCLUDED.source_registry_id`,
      [normalized, doc_sha256, source_registry_id]
    );
  }

  return { replicated: docRows.rows.length };
}
