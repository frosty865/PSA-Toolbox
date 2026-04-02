import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * Purge untraceable CORPUS documents (source_registry_id IS NULL AND chunk_count = 0).
 * ONLY deletes untraceable documents with 0 chunks.
 * Use with caution - this permanently removes records.
 */
export async function POST() {
  const pool = getCorpusPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      DELETE FROM public.corpus_documents
      WHERE source_registry_id IS NULL
        AND chunk_count = 0
      RETURNING id
    `);
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, deleted: result.rowCount ?? 0 });
  } catch (e: unknown) {
    await client.query('ROLLBACK').catch(() => {});
    const err = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: err }, { status: 500 });
  } finally {
    client.release();
  }
}

