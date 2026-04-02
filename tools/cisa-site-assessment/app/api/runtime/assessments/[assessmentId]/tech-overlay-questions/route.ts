import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/tech-overlay-questions
 * 
 * Returns technology overlay questions for an assessment based on selected tech profiles.
 * Only returns questions matching the tech_types selected for the assessment.
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

    // Get technology profiles for this assessment
    const profilesResult = await pool.query(`
      SELECT tech_type, subtype_code
      FROM public.assessment_technology_profiles
      WHERE assessment_id = $1
    `, [assessmentId]);

    if (profilesResult.rows.length === 0) {
      return NextResponse.json({
        questions: [],
        responses: []
      }, { status: 200 });
    }

    // Get unique tech types
    const techTypes = [...new Set(profilesResult.rows.map((r: Record<string, unknown>) => r.tech_type as string))];
    const subtypeCodes = [...new Set(profilesResult.rows.map((r: Record<string, unknown>) => r.subtype_code as string))];

    // Get overlay questions matching tech types and subtypes
    const questionsResult = await pool.query(`
      SELECT 
        id,
        tech_type,
        discipline_code,
        subtype_code,
        question_text,
        response_enum,
        overlay_level,
        order_index
      FROM public.tech_question_templates
      WHERE tech_type = ANY($1::text[])
      AND subtype_code = ANY($2::text[])
      AND is_active = true
      ORDER BY subtype_code, order_index, tech_type
    `, [techTypes, subtypeCodes]);

    // Get responses for these questions
    const questionIds = questionsResult.rows.map((q: Record<string, unknown>) => q.id);
    let responsesResult: { rows: Record<string, unknown>[] } = { rows: [] };
    
    if (questionIds.length > 0) {
      responsesResult = await pool.query(`
        SELECT 
          tech_question_template_id,
          response,
          notes,
          responded_at
        FROM public.tech_question_responses
        WHERE assessment_id = $1
        AND tech_question_template_id = ANY($2::uuid[])
      `, [assessmentId, questionIds]);
    }

    // Map responses by question ID
    const responseMap = new Map();
    for (const row of responsesResult.rows) {
      responseMap.set(row.tech_question_template_id, {
        response: row.response,
        notes: row.notes,
        responded_at: row.responded_at
      });
    }

    // Enrich questions with responses
    const questions = questionsResult.rows.map((q: Record<string, unknown>) => ({
      id: q.id,
      tech_type: q.tech_type,
      discipline_code: q.discipline_code,
      subtype_code: q.subtype_code,
      question_text: q.question_text,
      response_enum: q.response_enum,
      overlay_level: q.overlay_level,
      order_index: q.order_index,
      current_response: responseMap.get(q.id)?.response || null,
      notes: responseMap.get(q.id)?.notes || null,
      responded_at: responseMap.get(q.id)?.responded_at || null,
    }));

    return NextResponse.json({
      questions,
      responses: Array.from(responseMap.values())
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/tech-overlay-questions GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch technology overlay questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

