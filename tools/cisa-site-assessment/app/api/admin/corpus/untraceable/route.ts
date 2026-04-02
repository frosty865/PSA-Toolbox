import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * List untraceable CORPUS documents (source_registry_id IS NULL).
 * These cannot be processed or reprocessed because the PDF file path cannot be resolved.
 */
export async function GET() {
  const pool = getCorpusPool();
  const { rows } = await pool.query(`
    SELECT
      id,
      COALESCE(inferred_title, file_stem, original_filename) AS document_name,
      processing_status,
      chunk_count,
      processed_at,
      last_error,
      created_at AS ingested_at
    FROM public.corpus_documents
    WHERE source_registry_id IS NULL
    ORDER BY COALESCE(processed_at, created_at) DESC NULLS LAST, 
             COALESCE(inferred_title, file_stem, original_filename) ASC
    LIMIT 1000
  `);
  return NextResponse.json({ count: rows.length, rows });
}

