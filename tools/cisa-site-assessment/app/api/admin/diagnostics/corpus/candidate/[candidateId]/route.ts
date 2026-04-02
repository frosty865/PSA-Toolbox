import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/corpus/candidate/[candidateId]
 * 
 * Returns candidate status and approval fields from CORPUS for verification.
 * Admin/diagnostic endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  try {
    // Hard guard: Assert table is on correct pool
    await assertTableOnOwnerPool("public.ofc_candidate_queue");

    const { candidateId } = await params;
    const corpusPool = getCorpusPool();

    const result = await corpusPool.query(
      `
      SELECT 
        candidate_id::text as id,
        status,
        approved as approved_status,
        reviewed_at as approved_at,
        reviewed_by as approved_by,
        updated_at,
        ofc_origin as source_type,
        title,
        snippet_text
      FROM public.ofc_candidate_queue
      WHERE candidate_id::text = $1
      `,
      [candidateId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found', error_code: 'CANDIDATE_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      candidate: result.rows[0]
    });

  } catch (error) {
    console.error('[API /api/admin/diagnostics/corpus/candidate/[candidateId] GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch candidate status',
        error_code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
