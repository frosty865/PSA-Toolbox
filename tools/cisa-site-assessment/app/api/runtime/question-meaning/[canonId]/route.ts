/**
 * GET /api/runtime/question-meaning/[canonId]
 * 
 * Returns RAG-derived meaning for a question by canon_id.
 * 
 * Response:
 * {
 *   canon_id: string;
 *   meaning_text: string | null;
 *   citations: Array<{chunk_id, corpus_document_id, page_number}>;
 *   derived_at: string;
 *   model_name: string;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonId: string }> }
) {
  try {
    const { canonId } = await params;

    if (!canonId) {
      return NextResponse.json(
        { error: 'canonId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    const result = await pool.query(`
      SELECT 
        canon_id,
        meaning_text,
        citations,
        derived_at,
        model_name
      FROM public.question_meaning
      WHERE canon_id = $1
      LIMIT 1
    `, [canonId]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        canon_id: canonId,
        meaning_text: null,
        citations: [],
        derived_at: null,
        model_name: null
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      canon_id: row.canon_id,
      meaning_text: row.meaning_text,
      citations: row.citations || [],
      derived_at: row.derived_at,
      model_name: row.model_name
    });
  } catch (error) {
    console.error('[API /api/runtime/question-meaning/[canonId]] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load question meaning',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
