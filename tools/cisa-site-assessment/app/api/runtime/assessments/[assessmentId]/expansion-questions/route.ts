import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertTablesOnOwnerPools } from '@/app/lib/db/pool_guard';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/expansion-questions
 * 
 * Returns the expansion question set for the assessment based on applied profiles.
 * 
 * - Joins assessment_expansion_profiles → expansion_questions
 * - Includes question_id, subtype_code, question_text, response_enum, profile_id
 * - Must return empty array if no profiles applied
 * - Must exclude RETIRED questions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    // Hard guard: Assert RUNTIME-owned tables are on correct pool
    await assertTablesOnOwnerPools([
      "public.assessments",
      "public.expansion_questions",
      "public.disciplines",
      "public.discipline_subtypes"
    ]);
    
    const { assessmentId } = await params;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get expansion questions for applied profiles
    const result = await pool.query(`
      SELECT DISTINCT
        eq.question_id,
        eq.profile_id,
        eq.subtype_code,
        eq.question_text,
        eq.response_enum,
        eq.introduced_version,
        eq.status,
        eq.created_at,
        eq.updated_at
      FROM public.expansion_questions eq
      INNER JOIN public.assessment_expansion_profiles aep 
        ON eq.profile_id = aep.profile_id
      WHERE aep.assessment_id = $1
        AND eq.status = 'ACTIVE'
      ORDER BY eq.profile_id, eq.subtype_code, eq.question_id
    `, [assessmentId]);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/expansion-questions GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch expansion questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

