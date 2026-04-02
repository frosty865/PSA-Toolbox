import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { resolveModulePath } from "@/app/lib/storage/config";
import { existsSync } from "fs";

/**
 * GET /api/admin/modules/[moduleCode]/sources
 *
 * Returns module sources for the requested module only: CORPUS_POINTER (attached evidence)
 * and MODULE_UPLOAD (module-local). Does not include pending/unassigned (MODULE_PENDING);
 * those appear only when viewing that module.
 * - RUNTIME: module_sources (source_type, corpus_source_id, storage_relpath).
 * - CORPUS: module_source_documents for MODULE_UPLOAD; corpus_documents for CORPUS_POINTER linked counts.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();

    let sources: { rows: Record<string, unknown>[] };
    try {
      sources = await runtimePool.query(
        `SELECT
          id,
          source_type,
          corpus_source_id,
          source_url,
          source_label,
          publisher,
          content_type,
          file_path,
          storage_relpath,
          sha256,
          fetch_status,
          fetch_error,
          fetched_at,
          created_at
         FROM public.module_sources
         WHERE module_code ILIKE $1
         ORDER BY created_at DESC`,
        [normalizedModuleCode]
      );
    } catch (colErr: unknown) {
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (msg.includes("publisher") && (msg.includes("does not exist") || msg.includes("column"))) {
        sources = await runtimePool.query(
          `SELECT
            id,
            source_type,
            corpus_source_id,
            source_url,
            source_label,
            content_type,
            file_path,
            storage_relpath,
            sha256,
            fetch_status,
            fetch_error,
            fetched_at,
            created_at
           FROM public.module_sources
           WHERE module_code ILIKE $1
           ORDER BY created_at DESC`,
          [normalizedModuleCode]
        );
        sources.rows = sources.rows.map((r) => ({ ...r, publisher: null }));
      } else {
        throw colErr;
      }
    }

    const _sourceIds = sources.rows.map((r: Record<string, unknown>) => r.id);
    void _sourceIds;
    const linkedDocsMap: Record<string, number> = {};

    // Include module_documents that have no matching module_sources row (INGESTED or DOWNLOADED so list is not blank).
    // Table columns (from live RUNTIME): id, module_code, label, source_type, local_path, url, sha256, status, notes, created_at, updated_at, document_blob_id
    const sourceSha256Set = new Set(
      sources.rows
        .filter((r: Record<string, unknown>) => r.source_type === "MODULE_UPLOAD" && r.sha256)
        .map((r: Record<string, unknown>) => String(r.sha256))
    );
    try {
      const docOnlyRows = await runtimePool.query(
        `SELECT id, label, sha256, status, module_code FROM public.module_documents
         WHERE module_code ILIKE $1 AND status IN ('INGESTED', 'DOWNLOADED')
         ORDER BY id`,
        [normalizedModuleCode]
      );
      for (const doc of (docOnlyRows.rows as Array<Record<string, unknown>>)) {
        const sha = doc.sha256 != null ? String(doc.sha256) : null;
        const alreadyHasSource = sha ? sourceSha256Set.has(sha) : false;
        if (!alreadyHasSource) {
          if (sha) sourceSha256Set.add(sha);
          const docId = String(doc.id);
          const docStatus = doc.status != null ? String(doc.status) : "DOWNLOADED";
          sources.rows.push({
            id: docId,
            source_type: "MODULE_UPLOAD",
            source_label: doc.label ?? "Ingested document",
            sha256: doc.sha256,
            storage_relpath: null,
            source_url: null,
            corpus_source_id: null,
            fetch_status: docStatus === "INGESTED" ? "DOWNLOADED" : docStatus,
            created_at: null,
            _from_document: true
          } as Record<string, unknown>);
          linkedDocsMap[docId] = 1;
        }
      }
    } catch (docErr: unknown) {
      console.warn("[GET modules/[moduleCode]/sources] module_documents fallback failed:", docErr);
      // Continue with module_sources only; do not 500
    }

    const corpusPointerRows = sources.rows.filter(
      (r: Record<string, unknown>) => r.source_type === "CORPUS_POINTER" && r.corpus_source_id
    );
    const corpusSourceIds = corpusPointerRows.map((r) => r.corpus_source_id);

    if (corpusSourceIds.length > 0) {
      try {
        const corpCounts = await corpusPool.query(
          `SELECT source_registry_id, COUNT(*) as count
           FROM public.corpus_documents
           WHERE source_registry_id = ANY($1::uuid[])
           GROUP BY source_registry_id`,
          [corpusSourceIds]
        );
        const byCorpusId: Record<string, number> = {};
        for (const r of corpCounts.rows as Array<Record<string, unknown>>) {
          byCorpusId[String(r.source_registry_id)] = parseInt(String(r.count), 10);
        }
        for (const s of corpusPointerRows) {
          linkedDocsMap[String(s.id)] = byCorpusId[String(s.corpus_source_id)] ?? 0;
        }
      } catch (e) {
        console.warn("[GET modules/[moduleCode]/sources] corpus_documents counts failed:", e);
      }
    }

    // MODULE_UPLOAD: linked count from RUNTIME module_documents (ingested docs), not CORPUS
    const moduleUploadRows = sources.rows.filter(
      (r: Record<string, unknown>) => r.source_type === "MODULE_UPLOAD"
    );
    if (moduleUploadRows.length > 0) {
      try {
        const runtimeLinked = await runtimePool.query(
          `SELECT ms.id, COUNT(md.id)::int AS doc_count
           FROM public.module_sources ms
           LEFT JOIN public.module_documents md ON LOWER(md.module_code) = LOWER(ms.module_code) AND md.sha256 = ms.sha256 AND md.status = 'INGESTED'
           WHERE ms.module_code ILIKE $1 AND ms.source_type = 'MODULE_UPLOAD'
           GROUP BY ms.id`,
          [normalizedModuleCode]
        );
        for (const row of runtimeLinked.rows as Array<Record<string, unknown>>) {
          linkedDocsMap[String(row.id)] = Number(row.doc_count) ?? 0;
        }
        await runtimePool.query(
          `UPDATE public.module_sources ms
           SET fetch_status = 'DOWNLOADED', fetched_at = COALESCE(ms.fetched_at, now())
           FROM public.module_documents md
           WHERE LOWER(ms.module_code) = LOWER(md.module_code) AND ms.sha256 = md.sha256
             AND ms.module_code ILIKE $1 AND ms.source_type = 'MODULE_UPLOAD'
             AND md.status = 'INGESTED'
             AND (ms.fetch_status IS NULL OR ms.fetch_status = 'PENDING')`,
          [normalizedModuleCode]
        );
      } catch (e) {
        console.warn("[GET modules/[moduleCode]/sources] module_sources linked counts failed:", e);
      }
    }

    // Summary counts from CORPUS; on failure still return 200 with sources
    let totalLinkedChunks = 0;
    let totalLinkedDocs = 0;
    try {
      const chunkCountResult = await corpusPool.query(
        `SELECT COUNT(*) as count
         FROM public.module_chunk_links
         WHERE module_code = $1`,
        [normalizedModuleCode]
      );
      totalLinkedChunks = parseInt(chunkCountResult.rows[0]?.count || '0', 10);
      const docCountResult = await corpusPool.query(
        `SELECT COUNT(DISTINCT corpus_document_id) as count
         FROM public.module_source_documents
         WHERE module_code = $1`,
        [normalizedModuleCode]
      );
      totalLinkedDocs = parseInt(docCountResult.rows[0]?.count || '0', 10);
    } catch (e) {
      console.warn("[GET modules/[moduleCode]/sources] corpus summary counts failed:", e);
    }

    // Enrich sources with linked document counts and file existence
    const enrichedSources = sources.rows.map((source: Record<string, unknown>) => {
      let file_exists = null;
      let file_error = null;
      const sourceId = String(source.id ?? "");
      const linkedCount = linkedDocsMap[sourceId] || 0;
      // MODULE_UPLOAD: show DOWNLOADED when we have ingested docs (RUNTIME), even if DB still says PENDING
      const effectiveStatus =
        source.source_type === 'MODULE_UPLOAD' && linkedCount > 0
          ? 'DOWNLOADED'
          : (source.fetch_status || 'PENDING');
      // Check if file exists for MODULE_UPLOAD sources with storage_relpath
      if (source.source_type === 'MODULE_UPLOAD' && typeof source.storage_relpath === 'string' && source.storage_relpath.length > 0) {
        try {
          const absPath = resolveModulePath(source.storage_relpath);
          file_exists = existsSync(absPath);
          if (!file_exists) {
            file_error = 'File not found at expected location';
          }
        } catch (error) {
          // Path escapes root or other error
          file_exists = false;
          file_error = error instanceof Error ? error.message : 'Invalid storage path';
        }
      }
      // If label is raw sha256 (long hex), show a shorter display label
      const rawLabel = typeof source.source_label === 'string' ? source.source_label : null;
      let displayLabel = rawLabel;
      if (
        source.source_type === 'MODULE_UPLOAD' &&
        displayLabel &&
        /^[a-f0-9]{32,64}$/i.test(displayLabel.trim())
      ) {
        displayLabel = `Document (${displayLabel.slice(0, 12)}...)`;
      }
      return {
        ...source,
        source_label: displayLabel ?? source.source_label,
        fetch_status: effectiveStatus,
        linked_documents_count: linkedCount,
        file_exists,
        file_error
      };
    });

    return NextResponse.json({
      sources: enrichedSources,
      summary: {
        total_sources: sources.rows.length,
        total_linked_documents: totalLinkedDocs,
        total_linked_chunks: totalLinkedChunks,
        sources_by_status: {
          PENDING: enrichedSources.filter((s: Record<string, unknown>) => s.fetch_status === 'PENDING').length,
          DOWNLOADED: enrichedSources.filter((s: Record<string, unknown>) => s.fetch_status === 'DOWNLOADED').length,
          FAILED: enrichedSources.filter((s: Record<string, unknown>) => s.fetch_status === 'FAILED').length
        }
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[API /api/admin/modules/[moduleCode]/sources] Error:`, error);
    return NextResponse.json(
      { error: "Failed to load module sources", message: msg },
      { status: 500 }
    );
  }
}
