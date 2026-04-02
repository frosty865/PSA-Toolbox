import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * GET /api/runtime/assessments/[assessmentId]/modules/[moduleCode]/questions
 * 
 * Returns module questions for an assessment (with responses).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string; moduleCode: string }> }
) {
  try {
    const { assessmentId, moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();

    // Verify module is attached
    const instanceCheck = await runtimePool.query(
      `SELECT status FROM public.assessment_module_instances 
       WHERE assessment_id = $1 AND module_code = $2 AND status = 'ACTIVE'`,
      [assessmentId, moduleCode]
    );
    if (!instanceCheck.rowCount || instanceCheck.rowCount === 0) {
      return NextResponse.json(
        { error: "Module not attached to this assessment" },
        { status: 404 }
      );
    }

    // Get module questions with responses
    const questions = await runtimePool.query(
      `
      SELECT 
        module_question_id,
        question_text,
        response,
        order_index
      FROM public.assessment_module_question_responses
      WHERE assessment_id = $1 AND module_code = $2
      ORDER BY order_index ASC
      `,
      [assessmentId, moduleCode]
    );

    return NextResponse.json({
      module_code: moduleCode,
      questions: questions.rows,
    });
  } catch (error: unknown) {
    console.error(`[API module questions] Error:`, error);
    return NextResponse.json(
      { error: "Failed to load module questions", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

