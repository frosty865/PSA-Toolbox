import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { reconcileModulesForAssessment } from '@/app/lib/runtime/reconcile_modules';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * PUT /api/runtime/assessments/[assessmentId]/subsector
 * 
 * Updates the subsector for an assessment and reconciles modules.
 * Body: { subsector_id: string | null }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await request.json().catch(() => ({}));
    const subsectorId = (body?.subsector_id ?? null) as string | null;

    const pool = getRuntimePool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check what type assessments.subsector_id expects
      const subsectorIdTypeCheck = await client.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'assessments' 
        AND column_name = 'subsector_id'
      `);

      const expectsUUID = subsectorIdTypeCheck.rows.length > 0 && 
                         subsectorIdTypeCheck.rows[0].data_type === 'uuid';

      // Resolve subsector_id if needed (TEXT to UUID conversion)
      let resolvedSubsectorId: string | null = null;
      if (subsectorId) {
        if (expectsUUID) {
          // Check if subsectors has id_uuid column
          const idUuidCheck = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'subsectors' 
            AND column_name = 'id_uuid'
          `);
          
          if (idUuidCheck.rows.length > 0) {
            const subsectorResult = await client.query(
              'SELECT id_uuid FROM subsectors WHERE id = $1 LIMIT 1',
              [subsectorId]
            );
            if (subsectorResult.rows.length > 0 && subsectorResult.rows[0].id_uuid) {
              resolvedSubsectorId = subsectorResult.rows[0].id_uuid;
            }
          }
        } else {
          // Use TEXT id directly
          resolvedSubsectorId = subsectorId;
        }
      }

      // Update assessment subsector
      const updateResult = await client.query(
        `
        UPDATE public.assessments
        SET subsector_id = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, subsector_id
        `,
        [assessmentId, resolvedSubsectorId]
      );

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }

      await client.query('COMMIT');

      // Reconcile modules driven by subsector policy (after commit)
      // Use the original subsectorId (TEXT) for policy lookup
      const reconcileResult = await reconcileModulesForAssessment({
        assessmentId,
        subsectorId: subsectorId // Use TEXT id for policy lookup
      });

      return NextResponse.json({
        ok: true,
        assessment: updateResult.rows[0],
        reconcile: reconcileResult
      }, { status: 200 });

    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error("[API /api/runtime/assessments/[assessmentId]/subsector] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to update subsector",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
