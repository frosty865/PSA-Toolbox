import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * Permanently remove all CORPUS documents with chunk_count = 0 and their dependents.
 * Deletes in FK order: document_chunks, module_source_documents, corpus_reprocess_queue, corpus_documents.
 * Use with caution - this permanently removes records.
 */
export async function POST() {
  const pool = getCorpusPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const zeroDocIds = await client.query(
      `SELECT id FROM public.corpus_documents WHERE chunk_count = 0`
    );
    const ids = zeroDocIds.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) {
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    // 1. document_chunks (document_id -> corpus_documents.id)
    await client.query(
      `DELETE FROM public.document_chunks WHERE document_id = ANY($1::uuid[])`,
      [ids]
    );

    // 2. module_source_documents (corpus_document_id -> corpus_documents.id)
    const hasModuleSourceDocuments = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'module_source_documents'`
    );
    if (hasModuleSourceDocuments.rows.length > 0) {
      await client.query(
        `DELETE FROM public.module_source_documents WHERE corpus_document_id = ANY($1::uuid[])`,
        [ids]
      );
    }

    // 3. corpus_reprocess_queue (corpus_document_id)
    const hasQueue = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corpus_reprocess_queue'`
    );
    if (hasQueue.rows.length > 0) {
      await client.query(
        `DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY($1::uuid[])`,
        [ids]
      );
    }

    // 4. corpus_documents
    const result = await client.query(
      `DELETE FROM public.corpus_documents WHERE chunk_count = 0 RETURNING id`
    );
    const deleted = result.rowCount ?? 0;

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, deleted });
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  } finally {
    client.release();
  }
}

