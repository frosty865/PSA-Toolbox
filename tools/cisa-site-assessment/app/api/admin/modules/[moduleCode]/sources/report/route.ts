import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { resolveModulePath } from "@/app/lib/storage/config";
import { existsSync } from "fs";

/**
 * GET /api/admin/modules/[moduleCode]/sources/report
 * 
 * Generate a comprehensive source report for a specific module.
 * Returns module-specific source data including statistics, source details,
 * linked documents/chunks, and any issues.
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

    // Get module info
    const moduleInfo = await runtimePool.query(
      `SELECT module_code, title, summary, created_at, updated_at
       FROM public.assessment_modules
       WHERE module_code = $1`,
      [normalizedModuleCode]
    );

    if (moduleInfo.rows.length === 0) {
      return NextResponse.json(
        { error: "Module not found" },
        { status: 404 }
      );
    }

    const moduleRow = moduleInfo.rows[0] as { module_code: string; title: string | null; summary: string | null; created_at: unknown; updated_at: unknown };

    // Get all sources for this module
    const sources = await runtimePool.query(
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
       WHERE module_code = $1
       ORDER BY created_at DESC`,
      [normalizedModuleCode]
    );

    type SourceRow = { id: string; source_type?: string; corpus_source_id?: string; [k: string]: unknown };
    const sourceRows = sources.rows as SourceRow[];
    const linkedDocsMap: Record<string, number> = {};

    const corpusPointerRows = sourceRows.filter(
      (r) => r.source_type === "CORPUS_POINTER" && r.corpus_source_id
    );
    const corpusSourceIds = corpusPointerRows.map((r) => r.corpus_source_id as string);

    if (corpusSourceIds.length > 0) {
      const corpCounts = await corpusPool.query(
        `SELECT source_registry_id, COUNT(*) as count
         FROM public.corpus_documents
         WHERE source_registry_id = ANY($1::uuid[])
         GROUP BY source_registry_id`,
        [corpusSourceIds]
      );
      type CountRow = { source_registry_id: string; count: string };
      const byCorpusId: Record<string, number> = {};
      for (const r of corpCounts.rows as CountRow[]) {
        byCorpusId[r.source_registry_id] = parseInt(r.count, 10);
      }
      for (const s of corpusPointerRows) {
        const sid = s.corpus_source_id ?? '';
        linkedDocsMap[s.id] = byCorpusId[sid] || 0;
      }
    }

    const moduleUploadIds = sourceRows.filter(
      (r) => r.source_type === "MODULE_UPLOAD"
    ).map((r) => r.id);
    if (moduleUploadIds.length > 0) {
      const linkedDocs = await corpusPool.query(
        `SELECT module_source_id, COUNT(*) as count
         FROM public.module_source_documents
         WHERE module_source_id = ANY($1::uuid[])
         GROUP BY module_source_id`,
        [moduleUploadIds]
      );
      type ModuleCountRow = { module_source_id: string; count: string };
      for (const row of linkedDocs.rows as ModuleCountRow[]) {
        linkedDocsMap[row.module_source_id] = parseInt(row.count, 10);
      }
    }

    // Get total linked chunks count
    const chunkCountResult = await corpusPool.query(
      `SELECT COUNT(*) as count
       FROM public.module_chunk_links
       WHERE module_code = $1`,
      [normalizedModuleCode]
    );
    const totalLinkedChunks = parseInt(chunkCountResult.rows[0]?.count || '0', 10);

    // Get total linked documents count
    const docCountResult = await corpusPool.query(
      `SELECT COUNT(DISTINCT corpus_document_id) as count
       FROM public.module_source_documents
       WHERE module_code = $1`,
      [normalizedModuleCode]
    );
    const totalLinkedDocs = parseInt(docCountResult.rows[0]?.count || '0', 10);

    type EnrichedSource = {
      id: unknown;
      source_type: unknown;
      corpus_source_id: unknown;
      source_url: unknown;
      source_label: unknown;
      content_type: unknown;
      storage_relpath: unknown;
      sha256: unknown;
      fetch_status: unknown;
      fetch_error: unknown;
      fetched_at: unknown;
      created_at: unknown;
      linked_documents_count: number;
      file_exists: boolean | null;
      file_error: string | null;
      corpus_source_details: Record<string, unknown> | null;
    };

    // Enrich sources with additional data
    const enrichedSources: EnrichedSource[] = sourceRows.map((source) => {
      let file_exists: boolean | null = null;
      let file_error: string | null = null;
        if (source.source_type === 'MODULE_UPLOAD' && typeof source.storage_relpath === 'string' && source.storage_relpath.length > 0) {
          try {
            const absPath = resolveModulePath(source.storage_relpath);
            file_exists = existsSync(absPath);
          if (!file_exists) {
            file_error = 'File not found at expected location';
          }
        } catch (error) {
          file_exists = false;
          file_error = error instanceof Error ? error.message : 'Invalid storage path';
        }
      }

      return {
        id: source.id,
        source_type: source.source_type,
        corpus_source_id: source.corpus_source_id,
        source_url: source.source_url,
        source_label: source.source_label,
        content_type: source.content_type,
        storage_relpath: source.storage_relpath,
        sha256: source.sha256,
        fetch_status: source.fetch_status,
        fetch_error: source.fetch_error,
        fetched_at: source.fetched_at,
        created_at: source.created_at,
        linked_documents_count: linkedDocsMap[source.id] || 0,
        file_exists,
        file_error,
        corpus_source_details: null as Record<string, unknown> | null,
      };
    });

    // Get corpus source details for CORPUS_POINTER sources
    if (corpusSourceIds.length > 0) {
      const corpusDetails = await corpusPool.query(
        `SELECT id, source_key, publisher, title, tier, publication_date, canonical_url
         FROM public.source_registry
         WHERE id = ANY($1::uuid[])`,
        [corpusSourceIds]
      );
      const corpusDetailsMap: Record<string, Record<string, unknown>> = {};
      for (const row of corpusDetails.rows as Record<string, unknown>[]) {
        const id = row.id as string;
        corpusDetailsMap[id] = row;
      }
      for (const source of enrichedSources) {
        if (source.source_type === 'CORPUS_POINTER' && source.corpus_source_id) {
          const sid = String(source.corpus_source_id);
          source.corpus_source_details = corpusDetailsMap[sid] ?? null;
        }
      }
    }

    // Calculate statistics
    const stats = {
      total_sources: sourceRows.length,
      by_type: {
        CORPUS_POINTER: sourceRows.filter((s) => s.source_type === 'CORPUS_POINTER').length,
        MODULE_UPLOAD: sourceRows.filter((s) => s.source_type === 'MODULE_UPLOAD').length,
        unknown: sourceRows.filter((s) => !s.source_type).length
      },
      by_status: {
        PENDING: sourceRows.filter((s) => s.fetch_status === 'PENDING').length,
        DOWNLOADED: sourceRows.filter((s) => s.fetch_status === 'DOWNLOADED').length,
        FAILED: sourceRows.filter((s) => s.fetch_status === 'FAILED').length
      },
      total_linked_documents: totalLinkedDocs,
      total_linked_chunks: totalLinkedChunks,
      sources_with_documents: enrichedSources.filter((s) => s.linked_documents_count > 0).length,
      sources_without_documents: enrichedSources.filter((s) => s.linked_documents_count === 0).length
    };

    // Identify issues
    const issues = {
      missing_files: enrichedSources.filter((s) => s.file_exists === false),
      failed_downloads: enrichedSources.filter((s) => s.fetch_status === 'FAILED'),
      sources_without_documents: enrichedSources.filter((s) => s.linked_documents_count === 0 && s.source_type === 'MODULE_UPLOAD'),
      missing_labels: enrichedSources.filter((s) => !s.source_label || String(s.source_label).trim() === '')
    };

    const reportDate = new Date().toISOString();

    return NextResponse.json({
      success: true,
      report_date: reportDate,
      module: {
        module_code: moduleRow.module_code,
        title: moduleRow.title,
        summary: moduleRow.summary,
        created_at: moduleRow.created_at,
        updated_at: moduleRow.updated_at
      },
      summary: {
        statistics: stats,
        issues_count: {
          missing_files: issues.missing_files.length,
          failed_downloads: issues.failed_downloads.length,
          sources_without_documents: issues.sources_without_documents.length,
          missing_labels: issues.missing_labels.length
        }
      },
      sources: enrichedSources,
      issues
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API /api/admin/modules/[moduleCode]/sources/report] Error:`, error);
    return NextResponse.json(
      {
        error: "Failed to generate module source report",
        message
      },
      { status: 500 }
    );
  }
}
