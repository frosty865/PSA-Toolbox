import { NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { existsSync } from 'fs';
import path from 'path';
import { resolveModulePath } from '@/app/lib/storage/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/module-sources
 *
 * Returns all RUNTIME.module_sources (across all modules) for display on the
 * Source Registry page when "Module Sources" tab is selected.
 * Also includes module_documents with status INGESTED or DOWNLOADED that have
 * no matching module_sources row, so the tab is not blank when docs were
 * ingested without a source row.
 * Chunk counts: CORPUS for corpus pointers; RUNTIME.module_chunks for
 * module-native documents so "# Chunks" is correct.
 */
export async function GET() {
  try {
    const pool = getRuntimePool();

    let result: { rows: Record<string, unknown>[] };
    let hasCorpusSourceId = true;
    try {
      result = await pool.query(
        `SELECT
          ms.id,
          ms.module_code,
          ms.source_type,
          ms.source_label,
          ms.publisher,
          ms.source_url,
          ms.storage_relpath,
          ms.sha256,
          ms.created_at,
          am.module_name,
          ms.corpus_source_id
         FROM public.module_sources ms
         LEFT JOIN public.assessment_modules am ON am.module_code = ms.module_code
         ORDER BY ms.module_code, ms.created_at DESC`
      );
    } catch (colErr: unknown) {
      const msg = colErr instanceof Error ? colErr.message : String(colErr);
      if (msg.includes('publisher') && (msg.includes('does not exist') || msg.includes('column'))) {
        try {
          result = await pool.query(
            `SELECT
              ms.id,
              ms.module_code,
              ms.source_type,
              ms.source_label,
              ms.source_url,
              ms.storage_relpath,
              ms.sha256,
              ms.created_at,
              am.module_name,
              ms.corpus_source_id
             FROM public.module_sources ms
             LEFT JOIN public.assessment_modules am ON am.module_code = ms.module_code
             ORDER BY ms.module_code, ms.created_at DESC`
          );
        } catch (e2: unknown) {
          const m2 = e2 instanceof Error ? e2.message : String(e2);
          if (m2.includes('corpus_source_id')) {
            hasCorpusSourceId = false;
            result = await pool.query(
              `SELECT
                ms.id,
                ms.module_code,
                ms.source_type,
                ms.source_label,
                ms.source_url,
                ms.storage_relpath,
                ms.sha256,
                ms.created_at,
                am.module_name
               FROM public.module_sources ms
               LEFT JOIN public.assessment_modules am ON am.module_code = ms.module_code
               ORDER BY ms.module_code, ms.created_at DESC`
            );
          } else {
            throw e2;
          }
        }
      } else if (msg.includes('corpus_source_id')) {
        hasCorpusSourceId = false;
        result = await pool.query(
          `SELECT
            ms.id,
            ms.module_code,
            ms.source_type,
            ms.source_label,
            ms.publisher,
            ms.source_url,
            ms.storage_relpath,
            ms.sha256,
            ms.created_at,
            am.module_name
           FROM public.module_sources ms
           LEFT JOIN public.assessment_modules am ON am.module_code = ms.module_code
           ORDER BY ms.module_code, ms.created_at DESC`
        );
      } else {
        throw colErr;
      }
    }

    // Dedupe by (module_code, sha256): same document can have multiple module_sources rows; show one per document
    const msRows = (result.rows || []) as Record<string, unknown>[];
    const byKey = new Map<string, Record<string, unknown>>();
    for (const r of msRows) {
      const code = String(r.module_code ?? '');
      const sha = r.sha256 != null ? String(r.sha256) : null;
      const key = code && sha ? `${code}:${sha}` : `id:${r.id}`;
      const existing = byKey.get(key);
      const hasPub = (p: unknown) => p != null && String(p).trim() !== '';
      const created = (x: unknown) => (x != null ? new Date(String(x)).getTime() : 0);
      if (!existing) {
        byKey.set(key, r);
      } else if (hasPub(r.publisher) && !hasPub(existing.publisher)) {
        byKey.set(key, r);
      } else if (hasPub(r.publisher) === hasPub(existing.publisher) && created(r.created_at) > created(existing.created_at)) {
        byKey.set(key, r);
      }
    }
    const rows: Record<string, unknown>[] = Array.from(byKey.values());
    const sourceSha256ByModule = new Map<string, Set<string>>();
    for (const r of rows) {
      const code = r.module_code as string;
      const sha = r.sha256 != null ? String(r.sha256) : null;
      if (code && sha) {
        if (!sourceSha256ByModule.has(code)) sourceSha256ByModule.set(code, new Set());
        sourceSha256ByModule.get(code)!.add(sha);
      }
    }
    // Include module_documents that have no matching module_sources row (INGESTED or DOWNLOADED so list isn't blank)
    try {
      const docOnly = await pool.query(
        `SELECT md.id, md.module_code, md.label, md.sha256, md.local_path, am.module_name
         FROM public.module_documents md
         LEFT JOIN public.assessment_modules am ON am.module_code = md.module_code
         WHERE md.status IN ('INGESTED', 'DOWNLOADED')
         ORDER BY md.module_code, md.id`
      );
      for (const doc of (docOnly.rows as Array<Record<string, unknown>>)) {
        const code = String(doc.module_code ?? '');
        const sha = doc.sha256 != null ? String(doc.sha256) : null;
        const set = sourceSha256ByModule.get(code);
        const alreadyHasSource = sha && set ? set.has(sha) : false;
        if (!alreadyHasSource) {
          if (code && sha) {
            if (!sourceSha256ByModule.has(code)) sourceSha256ByModule.set(code, new Set());
            sourceSha256ByModule.get(code)!.add(sha);
          }
          rows.push({
            id: doc.id,
            module_code: doc.module_code,
            module_name: doc.module_name ?? doc.module_code,
            source_type: 'MODULE_UPLOAD',
            source_label: doc.label ?? 'Ingested document',
            source_url: null,
            storage_relpath: null,
            sha256: doc.sha256,
            created_at: null,
            corpus_source_id: null,
            local_path: doc.local_path ?? null,
            publisher: null,
            _from_document: true,
          });
        }
      }
    } catch (docErr) {
      console.warn('[module-sources] module_documents fallback query failed (table may be missing):', docErr);
    }

    const chunkCountByKey: Record<string, number> = {};

    // RUNTIME: chunk counts from module_chunks (module documents live in RUNTIME, not CORPUS)
    try {
      const runtimeChunks = await pool.query<{ module_document_id: string; module_code: string; sha256: string | null; chunk_count: string }>(
        `SELECT md.id::text AS module_document_id, md.module_code, md.sha256,
                COUNT(mc.id)::text AS chunk_count
         FROM public.module_documents md
         LEFT JOIN public.module_chunks mc ON mc.module_document_id = md.id
         GROUP BY md.id, md.module_code, md.sha256`
      );
      for (const r of runtimeChunks.rows || []) {
        chunkCountByKey[`doc:${r.module_document_id}`] = parseInt(r.chunk_count, 10) || 0;
        if (r.module_code && r.sha256) {
          chunkCountByKey[`ms:${r.module_code}:${r.sha256}`] = (chunkCountByKey[`ms:${r.module_code}:${r.sha256}`] ?? 0) + (parseInt(r.chunk_count, 10) || 0);
        }
      }
    } catch (runtimeErr) {
      console.warn('[module-sources] RUNTIME module_chunks lookup failed:', runtimeErr);
    }

    try {
      const corpusPool = getCorpusPool();
      if (hasCorpusSourceId) {
        const corpusPointerIds = rows
          .filter((r: Record<string, unknown>) => r.source_type === 'CORPUS_POINTER' && r.corpus_source_id)
          .map((r: Record<string, unknown>) => r.corpus_source_id as string);
        if (corpusPointerIds.length > 0) {
          const bySource = await corpusPool.query<{ source_registry_id: string; total: string }>(
            `SELECT source_registry_id::text, COALESCE(SUM(chunk_count), 0)::int AS total
             FROM public.corpus_documents
             WHERE source_registry_id = ANY($1::uuid[])
             GROUP BY source_registry_id`,
            [corpusPointerIds]
          );
          for (const r of bySource.rows || []) {
            chunkCountByKey[`corpus:${r.source_registry_id}`] = parseInt(r.total, 10) || 0;
          }
        }
      }
      const sha256s = rows
        .filter((r: Record<string, unknown>) => r.sha256)
        .map((r: Record<string, unknown>) => r.sha256 as string);
      if (sha256s.length > 0) {
        const byHash = await corpusPool.query<{ file_hash: string; chunk_count: number }>(
          `SELECT file_hash, COALESCE(chunk_count, 0)::int AS chunk_count
           FROM public.corpus_documents
           WHERE file_hash = ANY($1::text[])`,
          [sha256s]
        );
        for (const r of byHash.rows || []) {
          chunkCountByKey[`sha256:${r.file_hash}`] = r.chunk_count ?? 0;
        }
      }
    } catch (corpusErr) {
      console.warn('[module-sources] CORPUS chunk_count lookup failed:', corpusErr);
    }

    const sources = rows.map((r: Record<string, unknown>) => {
      let chunk_count = 0;
      let file_exists: boolean | null = null;
      let file_error: string | null = null;
      if (r._from_document && r.id) {
        chunk_count = chunkCountByKey[`doc:${String(r.id)}`] ?? 0;
      } else if (r.source_type === 'CORPUS_POINTER' && r.corpus_source_id) {
        chunk_count = chunkCountByKey[`corpus:${String(r.corpus_source_id)}`] ?? 0;
      } else if (r.module_code && r.sha256) {
        chunk_count = chunkCountByKey[`ms:${String(r.module_code)}:${String(r.sha256)}`] ?? chunkCountByKey[`sha256:${String(r.sha256)}`] ?? 0;
      } else if (r.sha256) {
        chunk_count = chunkCountByKey[`sha256:${String(r.sha256)}`] ?? 0;
      }
      const storageRelpath = typeof r.storage_relpath === 'string' ? r.storage_relpath : null;
      const localPath = typeof r.local_path === 'string' ? r.local_path : null;
      const candidate = storageRelpath || localPath;
      if (candidate) {
        try {
          const absPath = path.isAbsolute(candidate)
            ? candidate
            : resolveModulePath(candidate);
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
        id: r.id,
        module_code: r.module_code,
        module_name: r.module_name ?? r.module_code,
        source_type: r.source_type,
        source_label: r.source_label,
        publisher: r.publisher ?? null,
        source_url: r.source_url,
        storage_relpath: r.storage_relpath,
        local_path: r.local_path ?? null,
        sha256: r.sha256,
        created_at: r.created_at,
        chunk_count,
        file_exists,
        file_error,
        /** When source_type is CORPUS_POINTER, the CORPUS source_registry.id. Used by sources page to dedupe when showing "all". */
        corpus_source_id: r.corpus_source_id ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      sources,
      total: sources.length,
    });
  } catch (error: unknown) {
    console.error('[API /api/admin/module-sources GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch module sources',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

