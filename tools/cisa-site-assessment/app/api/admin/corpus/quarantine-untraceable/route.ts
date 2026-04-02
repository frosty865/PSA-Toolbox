import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * Quarantine untraceable CORPUS documents (source_registry_id IS NULL).
 * Marks them as FAILED with explicit error message.
 */
export async function POST() {
  const pool = getCorpusPool();
  const result = await pool.query(`
    UPDATE public.corpus_documents
    SET processing_status='FAILED',
        chunk_count=0,
        processed_at=COALESCE(processed_at, now()),
        last_error=COALESCE(last_error, 'Untraceable: missing source_registry_id')
    WHERE source_registry_id IS NULL
  `);
  return NextResponse.json({ ok: true, updated: result.rowCount ?? 0 });
}

