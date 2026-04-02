import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getCorpusPool();
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM public.corpus_documents WHERE chunk_count = 0`
  );
  const total = countResult.rows[0]?.total ?? 0;
  const listSql = `
    SELECT id, COALESCE(inferred_title, file_stem, original_filename) AS document_name,
           processing_status, chunk_count, processed_at, last_error
    FROM public.corpus_documents
    WHERE chunk_count = 0
    ORDER BY processed_at DESC NULLS LAST, document_name ASC
    LIMIT 500
  `;
  const { rows } = await pool.query(listSql);
  return NextResponse.json({ count: total, rows });
}

