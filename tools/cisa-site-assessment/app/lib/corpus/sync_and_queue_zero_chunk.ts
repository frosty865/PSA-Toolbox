import type { Pool } from 'pg';
import type { PoolClient } from 'pg';

/**
 * Recalculate corpus_documents.chunk_count from document_chunks for rows
 * where chunk_count = 0 but document_chunks has rows. Fixes drift when
 * ingest wrote chunks but the status update failed or wasn't committed.
 * Caller must pass an already-connected client if running in a transaction.
 */
export async function syncChunkCounts(
  pool: Pool,
  client?: PoolClient
): Promise<{ updated: number }> {
  const useOwn = !client;
  const c = client ?? (await pool.connect());
  try {
    if (useOwn) await c.query('BEGIN');
    const result = await c.query(`
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
    if (useOwn) await c.query('COMMIT');
    return { updated };
  } catch (e) {
    if (useOwn) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (useOwn) c.release();
  }
}

/**
 * Count corpus_documents with chunk_count = 0 and source_registry_id IS NOT NULL
 * (i.e. queueable for reprocessing).
 */
export async function countZeroChunkWithSource(pool: Pool): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM public.corpus_documents
     WHERE chunk_count = 0 AND source_registry_id IS NOT NULL`
  );
  return result.rows[0]?.count ?? 0;
}

/**
 * Queue up to `limit` CORPUS docs with chunk_count=0 and source_registry_id IS NOT NULL
 * into corpus_reprocess_queue. Returns number queued and number skipped (no source_registry_id).
 * Caller must pass an already-connected client if running in a transaction.
 */
export async function queueZeroChunk(
  pool: Pool,
  limit: number,
  client?: PoolClient
): Promise<{ queued: number; skipped_missing_source_registry_id: number }> {
  const useOwn = !client;
  const c = client ?? (await pool.connect());
  try {
    if (useOwn) await c.query('BEGIN');

    const select = await c.query(
      `
      SELECT id
      FROM public.corpus_documents
      WHERE chunk_count = 0
        AND source_registry_id IS NOT NULL
      ORDER BY COALESCE(processed_at, created_at) DESC NULLS LAST, COALESCE(inferred_title, file_stem, original_filename) ASC
      LIMIT $1
      FOR UPDATE
      `,
      [limit]
    );

    const ids: string[] = select.rows.map((r: { id: string }) => r.id);
    if (ids.length === 0) {
      const skipped = await c.query(`
        SELECT COUNT(*)::int AS count
        FROM public.corpus_documents
        WHERE chunk_count = 0
          AND source_registry_id IS NULL
      `);
      if (useOwn) await c.query('COMMIT');
      return {
        queued: 0,
        skipped_missing_source_registry_id: skipped.rows?.[0]?.count ?? 0,
      };
    }

    await c.query(
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

    await c.query(
      `
      INSERT INTO public.corpus_reprocess_queue (corpus_document_id, requested_at, attempts)
      SELECT unnest($1::uuid[]), now(), 0
      ON CONFLICT (corpus_document_id) DO UPDATE
        SET requested_at = EXCLUDED.requested_at
      `,
      [ids]
    );

    const skipped = await c.query(`
      SELECT COUNT(*)::int AS count
      FROM public.corpus_documents
      WHERE chunk_count = 0
        AND source_registry_id IS NULL
    `);

    if (useOwn) await c.query('COMMIT');
    return {
      queued: ids.length,
      skipped_missing_source_registry_id: skipped.rows?.[0]?.count ?? 0,
    };
  } catch (e) {
    if (useOwn) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    if (useOwn) c.release();
  }
}
