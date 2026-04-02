import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/results
 * 
 * Returns split results: baseline and expansion (separate, no composite score in Phase 1).
 * 
 * Response structure:
 * {
 *   baseline: { ...existing baseline score payload ... },
 *   expansion: {
 *     applied_profiles: [...],
 *     answered_count,
 *     total_questions,
 *     by_profile: [{profile_id, answered_count, total_questions}],
 *     by_subtype: [{subtype_code, answered_count, total_questions}]
 *   }
 * }
 * 
 * Expansion results are informational only in Phase 1 (no composite score).
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

    // Verify assessment exists
    const assessmentCheck = await pool.query(`
      SELECT id FROM public.assessments WHERE id = $1
    `, [assessmentId]);

    if (assessmentCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Get baseline results
    // For Phase 1, we return a placeholder structure
    // In production, you could import and call the scoring logic directly
    // or make an internal API call to /api/assessment/scoring
    const baselineResult: Record<string, unknown> = {
      summary: {
        total: 0,
        yes: 0,
        no: 0,
        na: 0,
        percent: null
      },
      disciplines: []
    };

    // Note: To get actual baseline scoring, you can:
    // 1. Import the scoring logic from app/api/assessment/scoring/route.ts
    // 2. Make an internal fetch to /api/assessment/scoring?documentId=${assessmentId}
    // 3. Or refactor scoring into a shared utility function
    // For Phase 1, we return the structure but leave actual scoring calculation
    // to the existing /api/assessment/scoring endpoint

    // Get expansion results
    // 1. Get applied profiles
    const profilesResult = await pool.query(`
      SELECT 
        aep.profile_id,
        aep.applied_at,
        sep.sector,
        sep.subsector,
        sep.version
      FROM public.assessment_expansion_profiles aep
      JOIN public.sector_expansion_profiles sep ON aep.profile_id = sep.profile_id
      WHERE aep.assessment_id = $1
      ORDER BY aep.applied_at DESC
    `, [assessmentId]);

    const appliedProfiles = profilesResult.rows;

    // 2. Get expansion questions for applied profiles
    const questionsResult = await pool.query(`
      SELECT DISTINCT
        eq.question_id,
        eq.profile_id,
        eq.subtype_code
      FROM public.expansion_questions eq
      INNER JOIN public.assessment_expansion_profiles aep 
        ON eq.profile_id = aep.profile_id
      WHERE aep.assessment_id = $1
        AND eq.status = 'ACTIVE'
    `, [assessmentId]);

    const totalQuestions = questionsResult.rows.length;

    // 3. Get expansion responses
    const responsesResult = await pool.query(`
      SELECT question_id, response
      FROM public.assessment_expansion_responses
      WHERE assessment_id = $1
    `, [assessmentId]);

    const responses = new Map<string, string>();
    for (const row of responsesResult.rows) {
      responses.set(row.question_id, row.response);
    }

    const answeredCount = responses.size;

    // 4. Aggregate by profile
    const byProfile = new Map<string, { total: number; answered: number }>();
    for (const question of questionsResult.rows) {
      const profileId = question.profile_id;
      if (!byProfile.has(profileId)) {
        byProfile.set(profileId, { total: 0, answered: 0 });
      }
      const stats = byProfile.get(profileId)!;
      stats.total++;
      if (responses.has(question.question_id)) {
        stats.answered++;
      }
    }

    const byProfileArray = Array.from(byProfile.entries()).map(([profileId, stats]) => ({
      profile_id: profileId,
      answered_count: stats.answered,
      total_questions: stats.total
    }));

    // 5. Aggregate by subtype
    const bySubtype = new Map<string, { total: number; answered: number }>();
    for (const question of questionsResult.rows) {
      const subtypeCode = question.subtype_code;
      if (!bySubtype.has(subtypeCode)) {
        bySubtype.set(subtypeCode, { total: 0, answered: 0 });
      }
      const stats = bySubtype.get(subtypeCode)!;
      stats.total++;
      if (responses.has(question.question_id)) {
        stats.answered++;
      }
    }

    const bySubtypeArray = Array.from(bySubtype.entries()).map(([subtypeCode, stats]) => ({
      subtype_code: subtypeCode,
      answered_count: stats.answered,
      total_questions: stats.total
    }));

    // Build expansion results
    const expansionResult = {
      applied_profiles: appliedProfiles.map((p: Record<string, unknown>) => ({
        profile_id: p.profile_id,
        sector: p.sector,
        subsector: p.subsector,
        version: p.version,
        applied_at: p.applied_at
      })),
      answered_count: answeredCount,
      total_questions: totalQuestions,
      by_profile: byProfileArray,
      by_subtype: bySubtypeArray
    };

    return NextResponse.json({
      baseline: baselineResult,
      expansion: expansionResult
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/results GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch assessment results',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

