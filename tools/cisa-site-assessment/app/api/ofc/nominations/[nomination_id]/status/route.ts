import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { logAuditEvent } from '@/app/lib/ofc-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ofc/nominations/{nomination_id}/status
 * Update nomination status (UNDER_REVIEW, WITHDRAWN)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nomination_id: string }> }
) {
  try {
    const { nomination_id } = await params;
    const nominationId = nomination_id;
    const body = await request.json();

    const { status, updated_by } = body;

    if (!status || !updated_by) {
      return NextResponse.json(
        { error: 'Missing required fields: status, updated_by' },
        { status: 400 }
      );
    }

    if (!['UNDER_REVIEW', 'WITHDRAWN'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be UNDER_REVIEW or WITHDRAWN' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get nomination
    const nomResult = await pool.query(
      `SELECT * FROM public.ofc_nominations WHERE nomination_id = $1`,
      [nominationId]
    );

    if (nomResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Nomination not found' },
        { status: 404 }
      );
    }

    const nomination = nomResult.rows[0];

    if (nomination.locked) {
      return NextResponse.json(
        { error: 'Nomination is locked and cannot be modified' },
        { status: 409 }
      );
    }

    // Validate status transition
    if (status === 'WITHDRAWN' && nomination.status === 'APPROVED') {
      return NextResponse.json(
        { error: 'Cannot withdraw an approved nomination' },
        { status: 409 }
      );
    }

    // Update status
    await pool.query(
      `UPDATE public.ofc_nominations
       SET status = $1
       WHERE nomination_id = $2`,
      [status, nominationId]
    );

    // Log audit event
    await logAuditEvent(
      pool,
      'OFC_NOMINATION_STATUS_CHANGED',
      {
        nomination_id: nominationId,
        old_status: nomination.status,
        new_status: status,
        updated_by
      },
      updated_by
    );

    return NextResponse.json({
      success: true,
      nomination_id: nominationId,
      status
    });

  } catch (error) {
    console.error('[API /api/ofc/nominations/[nomination_id]/status] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

