import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertTableOnOwnerPool } from '@/app/lib/db/pool_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/runtime/nominations/by-response/[responseId]
 * 
 * Returns nominations for a specific assessment_response_id for verification.
 * Admin/diagnostic endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ responseId: string }> }
) {
  try {
    // Hard guard: Assert table is on correct pool
    await assertTableOnOwnerPool("public.ofc_nominations");

    const { responseId } = await params;
    const runtimePool = getRuntimePool();

    const result = await runtimePool.query(
      `
      SELECT 
        nomination_id::text as id,
        assessment_id::text as assessment_id,
        assessment_response_id::text as assessment_response_id,
        candidate_id::text as candidate_id,
        ofc_id::text as ofc_id,
        created_at,
        link_key,
        status
      FROM public.ofc_nominations
      WHERE assessment_response_id::text = $1
      ORDER BY created_at DESC
      `,
      [responseId]
    );

    return NextResponse.json({
      ok: true,
      response_id: responseId,
      nominations: result.rows
    });

  } catch (error) {
    console.error('[API /api/admin/diagnostics/runtime/nominations/by-response/[responseId] GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch nominations',
        error_code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
