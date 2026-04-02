import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import {
  assertNoBaselineContamination,
  isValidResponseForQuestion
} from '@/app/lib/expansion/validation';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * PUT /api/runtime/assessments/[assessmentId]/expansion-responses
 * 
 * Upserts responses for expansion questions only.
 * 
 * Body:
 * - responses: [{ question_id: string, response: string }]
 * 
 * Validation:
 * - question_id must exist and be part of the assessment's applied profiles
 * - response must be one of question.response_enum
 * - refuse if payload contains baseline response fields
 * - Writes to assessment_expansion_responses only
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

    if (!responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'responses is required and must be an array' },
        { status: 400 }
      );
    }

    // Hard guardrail: No baseline contamination
    try {
      assertNoBaselineContamination(body);
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Baseline contamination detected',
          message: err instanceof Error ? err.message : 'Payload contains baseline-only fields'
        },
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

    // Get valid question IDs for this assessment's applied profiles
    const validQuestionsResult = await pool.query(`
      SELECT 
        eq.question_id,
        eq.response_enum
      FROM public.expansion_questions eq
      INNER JOIN public.assessment_expansion_profiles aep 
        ON eq.profile_id = aep.profile_id
      WHERE aep.assessment_id = $1
        AND eq.status = 'ACTIVE'
    `, [assessmentId]);

    const validQuestions = new Map<string, string[]>();
    for (const row of validQuestionsResult.rows) {
      validQuestions.set(row.question_id, row.response_enum);
    }

    // Validate all responses
    const invalidResponses: { question_id?: string; error?: string }[] = [];
    for (const response of responses) {
      if (!response.question_id || !response.response) {
        invalidResponses.push({
          question_id: response.question_id,
          error: 'Missing question_id or response'
        });
        continue;
      }

      if (!validQuestions.has(response.question_id)) {
        invalidResponses.push({
          question_id: response.question_id,
          error: 'Question not found in applied profiles'
        });
        continue;
      }

      const responseEnum = validQuestions.get(response.question_id)!;
      if (!isValidResponseForQuestion(response.response, responseEnum)) {
        invalidResponses.push({
          question_id: response.question_id,
          error: `Response "${response.response}" not in allowed enum: ${responseEnum.join(', ')}`
        });
      }
    }

    if (invalidResponses.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid responses',
          invalid_responses: invalidResponses
        },
        { status: 400 }
      );
    }

    // Upsert responses in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const response of responses) {
        await client.query(`
          INSERT INTO public.assessment_expansion_responses (
            assessment_id,
            question_id,
            response,
            updated_at
          ) VALUES ($1, $2, $3, NOW())
          ON CONFLICT (assessment_id, question_id)
          DO UPDATE SET
            response = EXCLUDED.response,
            updated_at = NOW()
        `, [assessmentId, response.question_id, response.response]);
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Upserted ${responses.length} expansion response(s)`
      }, { status: 200 });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/expansion-responses PUT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to save expansion responses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/runtime/assessments/[assessmentId]/expansion-responses
 * 
 * Returns expansion responses for the assessment.
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
        question_id,
        response,
        updated_at
      FROM public.assessment_expansion_responses
      WHERE assessment_id = $1
      ORDER BY question_id
    `, [assessmentId]);

    return NextResponse.json(result.rows, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/expansion-responses GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch expansion responses',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

