import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/tech-profiles
 * 
 * Returns technology profiles for an assessment.
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
        id,
        assessment_id,
        discipline_code,
        subtype_code,
        tech_family,
        tech_type,
        tech_variant,
        evidence_basis,
        notes,
        created_at,
        updated_at
      FROM public.assessment_technology_profiles
      WHERE assessment_id = $1
      ORDER BY discipline_code, subtype_code, tech_type
    `, [assessmentId]);

    return NextResponse.json({
      profiles: result.rows
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/tech-profiles GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch technology profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/runtime/assessments/[assessmentId]/tech-profiles
 * 
 * Upserts technology profiles for an assessment.
 * 
 * Body:
 * - profiles: Array<{
 *     discipline_code: string,
 *     subtype_code: string,
 *     tech_family: string,
 *     tech_type: string,
 *     tech_variant?: string,
 *     evidence_basis?: string,
 *     notes?: string
 *   }>
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await request.json();
    const { profiles } = body;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(profiles)) {
      return NextResponse.json(
        { error: 'profiles must be an array' },
        { status: 400 }
      );
    }

    // Validate profiles
    const validEvidenceBasis = ['DIRECT_OBSERVATION', 'SYSTEM_DEMONSTRATION', 'INTERFACE_EVIDENCE', 'DOCUMENTATION_REVIEWED', 'STAKEHOLDER_STATEMENT'];
    for (const profile of profiles) {
      if (!profile.discipline_code || !profile.subtype_code || !profile.tech_family || !profile.tech_type) {
        return NextResponse.json(
          { error: 'Each profile must have discipline_code, subtype_code, tech_family, and tech_type' },
          { status: 400 }
        );
      }
      if (profile.evidence_basis && !validEvidenceBasis.includes(profile.evidence_basis)) {
        return NextResponse.json(
          { error: `evidence_basis must be one of: ${validEvidenceBasis.join(', ')}` },
          { status: 400 }
        );
      }
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

    // Upsert profiles
    const saved: { discipline_code: string; subtype_code: string; tech_type: string }[] = [];
    const errors: { subtype_code: string; tech_type: string; error: string }[] = [];

    for (const profile of profiles) {
      try {
        // Check if profile exists
        const existingResult = await pool.query(`
          SELECT id FROM public.assessment_technology_profiles
          WHERE assessment_id = $1
          AND subtype_code = $2
          AND tech_type = $3
        `, [assessmentId, profile.subtype_code, profile.tech_type]);

        if (existingResult.rows.length > 0) {
          // Update existing profile
          await pool.query(`
            UPDATE public.assessment_technology_profiles
            SET 
              discipline_code = $1,
              tech_family = $2,
              tech_variant = $3,
              evidence_basis = $4,
              notes = $5,
              updated_at = NOW()
            WHERE id = $6
          `, [
            profile.discipline_code,
            profile.tech_family,
            profile.tech_variant || null,
            profile.evidence_basis || null,
            profile.notes || null,
            existingResult.rows[0].id
          ]);
        } else {
          // Insert new profile
          await pool.query(`
            INSERT INTO public.assessment_technology_profiles (
              assessment_id,
              discipline_code,
              subtype_code,
              tech_family,
              tech_type,
              tech_variant,
              evidence_basis,
              notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            assessmentId,
            profile.discipline_code,
            profile.subtype_code,
            profile.tech_family,
            profile.tech_type,
            profile.tech_variant || null,
            profile.evidence_basis || null,
            profile.notes || null
          ]);
        }

        saved.push({
          discipline_code: profile.discipline_code,
          subtype_code: profile.subtype_code,
          tech_type: profile.tech_type
        });
      } catch (err: unknown) {
        errors.push({
          subtype_code: profile.subtype_code,
          tech_type: profile.tech_type,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      saved: saved.length,
      errors: errors.length,
      saved_profiles: saved,
      errors_detail: errors.length > 0 ? errors : undefined
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/tech-profiles PUT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save technology profiles',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/runtime/assessments/[assessmentId]/tech-profiles
 * 
 * Deletes a technology profile.
 * 
 * Query params:
 * - subtype_code: string (required)
 * - tech_type: string (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const { searchParams } = new URL(request.url);
    const subtypeCode = searchParams.get('subtype_code');
    const techType = searchParams.get('tech_type');

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    if (!subtypeCode || !techType) {
      return NextResponse.json(
        { error: 'subtype_code and tech_type query parameters are required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    const result = await pool.query(`
      DELETE FROM public.assessment_technology_profiles
      WHERE assessment_id = $1
      AND subtype_code = $2
      AND tech_type = $3
      RETURNING id
    `, [assessmentId, subtypeCode, techType]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Technology profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deleted: true
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/tech-profiles DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete technology profile',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

