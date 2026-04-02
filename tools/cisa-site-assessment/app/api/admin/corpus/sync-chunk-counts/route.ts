import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * Recalculate corpus_documents.chunk_count from document_chunks for rows
 * where chunk_count = 0 but document_chunks has rows. Fixes drift when
 * ingest wrote chunks but the status update failed or wasn't committed.
 */
export async function POST() {
  const pool = getCorpusPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      WITH counts AS (
        SELECT document_id, COUNT(*)::int AS cnt
        FROM public.document_chunks
        GROUP BY document_id
      )
      UPDATE public.corpus_documents d
      SET
        chunk_count = c.cnt,
        processing_status = 'PROCESSED',
        processed_at = COALESCE(d.processed_at, now()),
        last_error = NULL
      FROM counts c
      WHERE d.id = c.document_id
        AND c.cnt > 0
        AND d.chunk_count = 0
      RETURNING d.id
    `);
    const updated = result.rowCount ?? 0;
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, updated });
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  } finally {
    client.release();
  }
}

