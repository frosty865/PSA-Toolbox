import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * PUT /api/runtime/assessments/[assessmentId]/modules/[moduleCode]/questions/[moduleQuestionId]
 * 
 * Updates a module question response.
 */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ assessmentId: string; moduleCode: string; moduleQuestionId: string }> }
) {
  try {
    const { assessmentId, moduleCode, moduleQuestionId } = await ctx.params;
    const body = await req.json();
    const { response } = body;

    if (!response || !["YES", "NO", "N_A"].includes(response)) {
      return NextResponse.json(
        { error: "Invalid response. Must be YES, NO, or N_A" },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();

    // Update response
    const result = await runtimePool.query(
      `
      UPDATE public.assessment_module_question_responses
      SET response = $1, updated_at = NOW()
      WHERE assessment_id = $2 
        AND module_code = $3 
        AND module_question_id = $4
      RETURNING module_question_id, response
      `,
      [response, assessmentId, moduleCode, moduleQuestionId]
    );

    if (!result.rowCount || result.rowCount === 0) {
      return NextResponse.json(
        { error: "Question not found for this assessment/module" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      module_question_id: moduleQuestionId,
      response: result.rows[0].response,
    });
  } catch (error: unknown) {
    console.error(`[API update module question] Error:`, error);
    return NextResponse.json(
      { error: "Failed to update response", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
