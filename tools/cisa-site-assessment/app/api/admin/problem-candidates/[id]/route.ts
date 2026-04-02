/**
 * PATCH /api/admin/problem-candidates/[id]
 * Update candidate status (e.g. REJECTED). Only REJECTED is allowed via PATCH; ACCEPTED is set on promote.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';

    if (status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Only status=REJECTED is allowed via PATCH. Use POST .../promote to accept and create OFC.' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    const result = await pool.query(
      `UPDATE public.problem_candidates
       SET status = 'REJECTED', updated_at = now()
       WHERE id::text = $1 AND status = 'PENDING'
       RETURNING id, status`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found or not PENDING', error_code: 'NOT_FOUND_OR_NOT_PENDING' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: result.rows[0].id,
      status: result.rows[0].status,
    });
  } catch (err) {
    console.error('[PATCH /api/admin/problem-candidates/[id]]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500 }
    );
  }
}
