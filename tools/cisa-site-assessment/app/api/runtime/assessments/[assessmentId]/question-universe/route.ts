import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/question-universe
 * 
 * Returns the question universe for an assessment, ordered by order_index.
 * Includes baseline core + modules + sector/subsector questions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get question universe ordered by order_index
    const result = await pool.query(`
      SELECT 
        layer,
        question_code,
        order_index,
        meta
      FROM public.assessment_question_universe
      WHERE assessment_id = $1
      ORDER BY order_index ASC
    `, [assessmentId]);

    // Get assessment definition for metadata
    const defResult = await pool.query(`
      SELECT 
        baseline_core_version,
        sector_code,
        subsector_code,
        modules
      FROM public.assessment_definitions
      WHERE assessment_id = $1
    `, [assessmentId]);

    const definition = defResult.rows[0] || null;

    return NextResponse.json({
      assessment_id: assessmentId,
      definition: definition,
      questions: result.rows.map(row => ({
        layer: row.layer,
        question_code: row.question_code,
        order_index: row.order_index,
        meta: row.meta
      }))
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/question-universe GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch question universe',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


