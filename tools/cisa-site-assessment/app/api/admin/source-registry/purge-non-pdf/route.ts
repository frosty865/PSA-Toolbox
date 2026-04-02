import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { verifyPdfUrl } from '@/app/lib/crawler/pdfVerify';
import { getAdminAuditContext, writeAdminAuditLog } from '@/app/lib/admin/audit';
import { columnExists, tableExists } from '@/app/lib/db/table_exists';

export const dynamic = 'force-dynamic';

const MAX_VERIFY_PER_REQUEST = 30;

/**
 * Permanently remove source_registry rows that are not verified PDFs, and their dependents.
 * 1) Removes rows where source_type IS DISTINCT FROM 'pdf'.
 * 2) For rows with source_type='pdf' and canonical_url, verifies via %PDF- signature (up to MAX_VERIFY_PER_REQUEST per request); removes if verification fails.
 */
export async function POST(request: NextRequest) {
  const audit = getAdminAuditContext(request);
  const corpusPool = getCorpusPoolForAdmin();
  const runtimePool = getRuntimePool();

  const corpusClient = await corpusPool.connect();
  try {
    const nonPdf = await corpusClient.query(
      `SELECT id, source_key FROM public.source_registry WHERE source_type IS DISTINCT FROM 'pdf'`
    );
    const ids: string[] = nonPdf.rows.map((r: { id: string }) => (r.id != null ? String(r.id) : '')).filter(Boolean);

    const pdfWithUrl = await corpusClient.query(
      `SELECT id, source_key, canonical_url FROM public.source_registry WHERE source_type = 'pdf' AND canonical_url IS NOT NULL LIMIT $1`,
      [MAX_VERIFY_PER_REQUEST]
    );
    for (const row of pdfWithUrl.rows) {
      const url = row.canonical_url as string;
      const v = await verifyPdfUrl(url, { maxRedirects: 2, headTimeoutMs: 5000, rangeTimeoutMs: 5000 });
      if (!v.ok) {
        ids.push(String(row.id));
      }
    }

    const sourceKeys = await corpusClient.query(
      `SELECT source_key FROM public.source_registry WHERE id = ANY($1::uuid[])`,
      [ids.length ? ids : []]
    );
    const sourceKeyList = sourceKeys.rows.map((r: { source_key: string }) => r.source_key ?? '').filter(Boolean);

    if (ids.length === 0) {
      writeAdminAuditLog('source_registry_purge_non_pdf_noop', audit, { verified: pdfWithUrl.rows.length });
      return NextResponse.json({ ok: true, deleted: 0, verifiedFailed: 0 });
    }

    // RUNTIME: delete/update all references to these sources
    const runtimeClient = await runtimePool.connect();
    try {
      await runtimeClient.query('BEGIN');

      if (sourceKeyList.length > 0 && await tableExists(runtimeClient, 'public', 'ofc_library_citations')) {
        await runtimeClient.query(
          `DELETE FROM public.ofc_library_citations WHERE source_key = ANY($1::text[])`,
          [sourceKeyList]
        );
      }

      if (await columnExists(runtimeClient, 'public', 'module_sources', 'corpus_source_id')) {
        await runtimeClient.query(
          `DELETE FROM public.module_sources WHERE corpus_source_id = ANY($1::uuid[])`,
          [ids]
        );
      }

      if (await tableExists(runtimeClient, 'public', 'module_ofc_citations')) {
        await runtimeClient.query(
          `DELETE FROM public.module_ofc_citations WHERE source_registry_id = ANY($1::uuid[])`,
          [ids]
        );
      }

      if (await tableExists(runtimeClient, 'public', 'module_corpus_links')) {
        await runtimeClient.query(
          `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id = ANY($1::uuid[])`,
          [ids]
        );
      }

      if (await tableExists(runtimeClient, 'public', 'module_chunk_comprehension')) {
        await runtimeClient.query(
          `DELETE FROM public.module_chunk_comprehension WHERE source_registry_id = ANY($1::uuid[])`,
          [ids]
        );
      }

      if (await columnExists(runtimeClient, 'public', 'module_questions', 'evidence_anchors')) {
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
          [ids]
        );
      }

      await runtimeClient.query('COMMIT');
    } catch (e: unknown) {
      await runtimeClient.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      runtimeClient.release();
    }

    // CORPUS: delete in FK order
    await corpusClient.query('BEGIN');

    if (sourceKeyList.length > 0) {
      if (await tableExists(corpusClient, 'public', 'canonical_sources')) {
        await corpusClient.query(
          `DELETE FROM public.canonical_sources WHERE source_key = ANY($1::text[])`,
          [sourceKeyList]
        );
      }
    }

    if (await columnExists(corpusClient, 'public', 'module_standards', 'source_registry_id')) {
      await corpusClient.query(
        `DELETE FROM public.module_standards WHERE source_registry_id = ANY($1::uuid[])`,
        [ids]
      );
    }

    if (await tableExists(corpusClient, 'public', 'document_chunks')) {
      await corpusClient.query(
        `DELETE FROM public.document_chunks
         WHERE document_id IN (SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[]))`,
        [ids]
      );
    }

    if (await tableExists(corpusClient, 'public', 'module_source_documents')) {
      await corpusClient.query(
        `DELETE FROM public.module_source_documents
         WHERE corpus_document_id IN (SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[]))`,
        [ids]
      );
    }

    if (await tableExists(corpusClient, 'public', 'corpus_reprocess_queue')) {
      await corpusClient.query(
        `DELETE FROM public.corpus_reprocess_queue
         WHERE corpus_document_id IN (SELECT id FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[]))`,
        [ids]
      );
    }

    if (await columnExists(corpusClient, 'public', 'corpus_documents', 'source_registry_id')) {
      await corpusClient.query(
        `DELETE FROM public.corpus_documents WHERE source_registry_id = ANY($1::uuid[])`,
        [ids]
      );
    }

    const result = await corpusClient.query(
      `DELETE FROM public.source_registry WHERE id = ANY($1::uuid[]) RETURNING id`,
      [ids]
    );
    const deleted = result.rowCount ?? 0;

    await corpusClient.query('COMMIT');
    writeAdminAuditLog('source_registry_purge_non_pdf_completed', audit, {
      deleted,
      verifiedFailed: ids.length - nonPdf.rows.length,
      requestedDeletes: ids.length,
    });
    return NextResponse.json({
      ok: true,
      deleted,
      verifiedFailed: ids.length - nonPdf.rows.length,
    });
  } catch (e: unknown) {
    await corpusClient.query('ROLLBACK').catch(() => {});
    const err = e instanceof Error ? e.message : String(e);
    writeAdminAuditLog('source_registry_purge_non_pdf_error', audit, { error: err });
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  } finally {
    corpusClient.release();
  }
}

