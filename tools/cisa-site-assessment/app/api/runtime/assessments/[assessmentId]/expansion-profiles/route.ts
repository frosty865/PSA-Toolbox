import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { assertNotTestAssessment } from '@/app/lib/expansion/validation';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * POST /api/runtime/assessments/[assessmentId]/expansion-profiles
 * 
 * Explicitly applies expansion profiles to an assessment.
 * 
 * Body:
 * - profile_ids: string[] (required)
 * - applied_by?: string (optional)
 * - include_tests?: boolean (default: false, admin-only)
 * 
 * Behavior:
 * - Validates assessment exists
 * - Refuses if assessment is test (unless include_tests=true)
 * - Insert into assessment_expansion_profiles (idempotent)
 * - Returns applied profiles
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await request.json();
    const { profile_ids, applied_by, include_tests = false } = body;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    if (!profile_ids || !Array.isArray(profile_ids) || profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'profile_ids is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    // Get assessment to check if it's a test
    const assessmentResult = await pool.query(`
      SELECT 
        id,
        facility_name,
        qa_flag,
        test_run_id
      FROM public.assessments
      WHERE id = $1
    `, [assessmentId]);

    if (assessmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    const assessment = assessmentResult.rows[0];

    // Check if assessment is a test (unless explicitly allowed)
    try {
      assertNotTestAssessment(assessment, include_tests);
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Cannot apply expansion profiles to test assessment',
          message: err instanceof Error ? err.message : 'Test assessment detected'
        },
        { status: 403 }
      );
    }

    // Validate that all profile_ids exist
    const profileCheck = await pool.query(`
      SELECT profile_id FROM public.sector_expansion_profiles
      WHERE profile_id = ANY($1::text[])
    `, [profile_ids]);

    const existingProfiles = new Set(profileCheck.rows.map((r: Record<string, unknown>) => r.profile_id as string));
    const missingProfiles = profile_ids.filter(id => !existingProfiles.has(id));

    if (missingProfiles.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more profiles not found',
          missing_profiles: missingProfiles
        },
        { status: 404 }
      );
    }

    // Insert profiles (idempotent - ON CONFLICT DO NOTHING)
    const insertValues = profile_ids.map((profileId: string, index: number) => {
      const paramIndex = index * 3 + 1;
      return `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`;
    }).join(', ');

    const insertParams: unknown[] = [];
    profile_ids.forEach((profileId: string) => {
      insertParams.push(assessmentId, profileId, applied_by || null);
    });

    await pool.query(`
      INSERT INTO public.assessment_expansion_profiles (
        assessment_id,
        profile_id,
        applied_by
      ) VALUES ${insertValues}
      ON CONFLICT (assessment_id, profile_id) DO NOTHING
    `, insertParams);

    // Return applied profiles
    const appliedResult = await pool.query(`
      SELECT 
        aep.profile_id,
        aep.applied_at,
        aep.applied_by,
        sep.sector,
        sep.subsector,
        sep.version,
        sep.status
      FROM public.assessment_expansion_profiles aep
      JOIN public.sector_expansion_profiles sep ON aep.profile_id = sep.profile_id
      WHERE aep.assessment_id = $1
      ORDER BY aep.applied_at DESC
    `, [assessmentId]);

    return NextResponse.json({
      success: true,
      applied_profiles: appliedResult.rows
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/expansion-profiles POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply expansion profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/runtime/assessments/[assessmentId]/expansion-profiles
 * 
 * Returns profiles currently applied to the assessment.
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

    const result = await pool.query(`
      SELECT 
        aep.profile_id,
        aep.applied_at,
        aep.applied_by,
        sep.sector,
        sep.subsector,
        sep.version,
        sep.status,
        sep.description
      FROM public.assessment_expansion_profiles aep
      JOIN public.sector_expansion_profiles sep ON aep.profile_id = sep.profile_id
      WHERE aep.assessment_id = $1
      ORDER BY aep.applied_at DESC
    `, [assessmentId]);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/expansion-profiles GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch applied expansion profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

