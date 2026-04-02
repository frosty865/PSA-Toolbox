import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * Queue all CORPUS docs with chunk_count=0 for reprocessing.
 * ONLY updates existing corpus_documents rows and enqueues into corpus_reprocess_queue.
 * NEVER INSERTs into corpus_documents.
 */
export async function POST() {
  const pool = getCorpusPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Only queue docs that are reprocessable:
    // - chunk_count = 0
    // - source_registry_id IS NOT NULL (required to resolve the file deterministically)
    // NOTE: we also include FAILED + REGISTERED + PROCESSING states, but exclude PROCESSED by definition.
    const select = await client.query(`
      SELECT id
      FROM public.corpus_documents
      WHERE chunk_count = 0
        AND source_registry_id IS NOT NULL
      ORDER BY COALESCE(processed_at, created_at) DESC NULLS LAST, COALESCE(inferred_title, file_stem, original_filename) ASC
      LIMIT 500
      FOR UPDATE
    `);

    const ids: string[] = select.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) {
      // Helpful: report how many are unqueueable due to missing source_registry_id
      const skipped = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM public.corpus_documents
        WHERE chunk_count = 0
          AND source_registry_id IS NULL
      `);

      await client.query('COMMIT');
      return NextResponse.json({
        ok: true,
        queued: 0,
        skipped_missing_source_registry_id: skipped.rows?.[0]?.count ?? 0,
      });
    }

    // Mark PROCESSING on existing rows ONLY (no inserts)
    await client.query(
      `
      UPDATE public.corpus_documents
      SET processing_status='PROCESSING',
          last_error=NULL,
          processed_at=NULL,
          chunk_count=0
      WHERE id = ANY($1::uuid[])
      `,
      [ids]
    );

    // Enqueue reprocess work (idempotent)
    await client.query(
      `
      INSERT INTO public.corpus_reprocess_queue (corpus_document_id, requested_at, attempts)
      SELECT unnest($1::uuid[]), now(), 0
      ON CONFLICT (corpus_document_id) DO UPDATE
        SET requested_at = EXCLUDED.requested_at
      `,
      [ids]
    );

    // Also report how many 0-chunk docs cannot be queued due to missing source_registry_id
    const skipped = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM public.corpus_documents
      WHERE chunk_count = 0
        AND source_registry_id IS NULL
    `);

    await client.query('COMMIT');
    return NextResponse.json({
      ok: true,
      queued: ids.length,
      skipped_missing_source_registry_id: skipped.rows?.[0]?.count ?? 0,
    });
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  } finally {
    client.release();
  }
}

