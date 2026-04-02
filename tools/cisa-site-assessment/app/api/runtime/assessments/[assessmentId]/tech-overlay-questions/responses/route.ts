import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * PUT /api/runtime/assessments/[assessmentId]/tech-overlay-questions/responses
 * 
 * Upserts responses to technology overlay questions.
 * 
 * Body:
 * - responses: Array<{
 *     tech_question_template_id: string,
 *     response: 'YES' | 'NO' | 'N_A',
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
    const { responses } = body;

    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'responses must be an array' },
        { status: 400 }
      );
    }

    // Validate responses
    const validResponses = ['YES', 'NO', 'N_A', 'N/A'];
    for (const resp of responses) {
      if (!resp.tech_question_template_id) {
        return NextResponse.json(
          { error: 'Each response must have tech_question_template_id' },
          { status: 400 }
        );
      }
      if (!validResponses.includes(resp.response)) {
        return NextResponse.json(
          { error: `response must be one of: ${validResponses.join(', ')}` },
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

    // Upsert responses
    const saved: { tech_question_template_id: string; response: string }[] = [];
    const errors: { tech_question_template_id: string; error: string }[] = [];

    for (const resp of responses) {
      try {
        // Normalize response value (N/A -> N_A)
        const normalizedResponse = resp.response === 'N/A' ? 'N_A' : resp.response;

        // Check if response exists
        const existingResult = await pool.query(`
          SELECT id FROM public.tech_question_responses
          WHERE assessment_id = $1
          AND tech_question_template_id = $2
        `, [assessmentId, resp.tech_question_template_id]);

        if (existingResult.rows.length > 0) {
          // Update existing response
          await pool.query(`
            UPDATE public.tech_question_responses
            SET 
              response = $1,
              notes = $2,
              updated_at = NOW()
            WHERE id = $3
          `, [normalizedResponse, resp.notes || null, existingResult.rows[0].id]);
        } else {
          // Insert new response
          await pool.query(`
            INSERT INTO public.tech_question_responses (
              assessment_id,
              tech_question_template_id,
              response,
              notes
            ) VALUES ($1, $2, $3, $4)
          `, [assessmentId, resp.tech_question_template_id, normalizedResponse, resp.notes || null]);
        }

        saved.push({
          tech_question_template_id: resp.tech_question_template_id,
          response: normalizedResponse
        });
      } catch (err: unknown) {
        errors.push({
          tech_question_template_id: resp.tech_question_template_id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      saved: saved.length,
      errors: errors.length,
      saved_responses: saved,
      errors_detail: errors.length > 0 ? errors : undefined
    }, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/tech-overlay-questions/responses PUT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save technology overlay question responses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

