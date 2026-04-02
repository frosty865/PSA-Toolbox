import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/modules
 * 
 * Returns modules enabled for this assessment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const pool = getRuntimePool();

    const result = await pool.query(`
      SELECT 
        ami.module_code,
        am.module_name,
        am.description,
        ami.status,
        ami.is_locked,
        ami.attached_via,
        (SELECT COUNT(*) FROM public.module_questions WHERE module_code = ami.module_code) as questions_count,
        (SELECT COUNT(*) FROM public.module_ofcs WHERE module_code = ami.module_code) as ofcs_count
      FROM public.assessment_module_instances ami
      JOIN public.assessment_modules am ON ami.module_code = am.module_code
      WHERE ami.assessment_id = $1
        AND ami.status = 'ACTIVE'
        AND am.is_active = true
      ORDER BY 
        CASE ami.attached_via
          WHEN 'SUBSECTOR_REQUIRED' THEN 1
          WHEN 'SUBSECTOR_DEFAULT' THEN 2
          WHEN 'USER' THEN 3
          ELSE 4
        END,
        ami.attached_at
    `, [assessmentId]);

    return NextResponse.json({
      modules: result.rows,
      count: result.rows.length
    });

  } catch (error: unknown) {
    console.error('[API /api/runtime/assessments/[assessmentId]/modules] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load assessment modules',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runtime/assessments/[assessmentId]/modules
 * 
 * Enable a module for an assessment.
 * Body: { module_code: "MODULE_XXX" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await request.json();
    const { module_code } = body;

    if (!module_code || !module_code.startsWith('MODULE_')) {
      return NextResponse.json(
        { error: 'Invalid module_code. Must start with "MODULE_"' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify assessment exists
      const assessmentCheck = await client.query(
        'SELECT id FROM public.assessments WHERE id = $1',
        [assessmentId]
      );

      if (assessmentCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }

      // Verify module exists and is active
      const moduleCheck = await client.query(
        'SELECT module_code FROM public.assessment_modules WHERE module_code = $1 AND is_active = true',
        [module_code]
      );

      if (moduleCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Module ${module_code} not found or inactive` },
          { status: 404 }
        );
      }

      // Create or update module instance
      await client.query(
        `
        INSERT INTO public.assessment_module_instances 
          (assessment_id, module_code, status, attached_via, attached_at)
        VALUES ($1, $2, 'ACTIVE', 'USER', NOW())
        ON CONFLICT (assessment_id, module_code)
        DO UPDATE SET 
          status = 'ACTIVE',
          attached_at = NOW()
        `,
        [assessmentId, module_code]
      );

      // Get all module questions and clone into assessment responses
      const moduleQuestions = await client.query(
        `
        SELECT module_question_id, question_text, order_index
        FROM public.module_questions
        WHERE module_code = $1
        ORDER BY order_index ASC
        `,
        [module_code]
      );

      // Clone module questions into assessment responses
      for (const q of moduleQuestions.rows) {
        await client.query(
          `
          INSERT INTO public.assessment_module_question_responses
            (assessment_id, module_code, module_question_id, question_text, response, order_index)
          VALUES ($1, $2, $3, $4, 'N_A', $5)
          ON CONFLICT (assessment_id, module_code, module_question_id)
          DO NOTHING
          `,
          [
            assessmentId,
            module_code,
            q.module_question_id,
            q.question_text,
            q.order_index,
          ]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Module ${module_code} enabled for assessment`
      }, { status: 201 });

    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    console.error('[API /api/runtime/assessments/[assessmentId]/modules] POST Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to enable module',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/runtime/assessments/[assessmentId]/modules?module_code=MODULE_XXX
 * 
 * Disable a module for an assessment.
 * Does not delete assessment responses.
 * Locked modules (REQUIRED by subsector) cannot be removed.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const { searchParams } = new URL(request.url);
    const moduleCode = searchParams.get('module_code');

    if (!moduleCode) {
      return NextResponse.json(
        { error: 'module_code parameter is required' },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();
    
    // Check if module is locked
    const instanceCheck = await pool.query(
      `
      SELECT is_locked, attached_via
      FROM public.assessment_module_instances
      WHERE assessment_id = $1 AND module_code = $2
      `,
      [assessmentId, moduleCode]
    );

    if (instanceCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Module instance not found' },
        { status: 404 }
      );
    }

    if (instanceCheck.rows[0].is_locked === true) {
      return NextResponse.json(
        { 
          error: 'Module required by subsector',
          message: 'This module is required by the subsector policy and cannot be removed'
        },
        { status: 409 }
      );
    }

    // Set status to REMOVED (does not delete responses - keeps history)
    await pool.query(
      `
      UPDATE public.assessment_module_instances 
      SET status = 'REMOVED', updated_at = NOW()
      WHERE assessment_id = $1 AND module_code = $2
      `,
      [assessmentId, moduleCode]
    );

    return NextResponse.json({
      success: true,
      message: `Module ${moduleCode} disabled for assessment`
    });

  } catch (error: unknown) {
    console.error('[API /api/runtime/assessments/[assessmentId]/modules] DELETE Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to disable module',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
