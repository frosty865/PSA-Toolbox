import { NextRequest, NextResponse } from 'next/server';
import { reconcileModulesForAssessment } from '@/app/lib/runtime/reconcile_modules';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/assessments/[assessmentId]/modules/reconcile
 * 
 * Reconciles modules for an assessment based on subsector policy.
 * Automatically attaches DEFAULT_ON and REQUIRED modules.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const pool = getRuntimePool();

    // Lookup subsector_id from the assessment (authoritative)
    // Note: assessments.subsector_id might be UUID or TEXT depending on schema
    const assessmentResult = await pool.query(
      `SELECT subsector_id FROM public.assessments WHERE id = $1`,
      [assessmentId]
    );

    if (assessmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Get subsector_id - might be UUID or TEXT
    let subsectorId: string | null = assessmentResult.rows[0].subsector_id;

    // If assessments.subsector_id is UUID but subsectors.id is TEXT, we need to resolve
    // Check if we need to resolve UUID to TEXT code
    if (subsectorId) {
      // Check if subsectors table has id_uuid column
      const subsectorIdCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subsectors' 
        AND column_name = 'id_uuid'
      `);

      // If subsector_id is UUID and subsectors has id_uuid, resolve to TEXT id
      if (subsectorIdCheck.rows.length > 0 && subsectorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        const resolvedResult = await pool.query(
          'SELECT id FROM subsectors WHERE id_uuid = $1 LIMIT 1',
          [subsectorId]
        );
        if (resolvedResult.rows.length > 0) {
          subsectorId = resolvedResult.rows[0].id;
        }
      }
    }

    const result = await reconcileModulesForAssessment({ assessmentId, subsectorId });
    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/runtime/assessments/[assessmentId]/modules/reconcile] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reconcile modules',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
