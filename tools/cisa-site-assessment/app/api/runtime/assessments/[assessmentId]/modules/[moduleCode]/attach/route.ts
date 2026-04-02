import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * POST /api/runtime/assessments/[assessmentId]/modules/[moduleCode]/attach
 * 
 * Attaches a module to an assessment by:
 * 1. Creating assessment_module_instances row
 * 2. Cloning module_questions into assessment_module_question_responses
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ assessmentId: string; moduleCode: string }> }
) {
  try {
    const { assessmentId, moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();

    // Verify assessment exists
    const assessmentCheck = await runtimePool.query(
      `SELECT id FROM public.assessments WHERE id = $1`,
      [assessmentId]
    );
    if (!assessmentCheck.rowCount || assessmentCheck.rowCount === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Verify module exists
    const moduleCheck = await runtimePool.query(
      `SELECT module_code, module_name FROM public.assessment_modules WHERE module_code = $1 AND is_active = true`,
      [moduleCode]
    );
    if (!moduleCheck.rowCount || moduleCheck.rowCount === 0) {
      return NextResponse.json({ error: "Module not found or inactive" }, { status: 404 });
    }

    const client = await runtimePool.connect();
    try {
      await client.query("BEGIN");

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
        [assessmentId, moduleCode]
      );

      // Get all module questions
      const moduleQuestions = await client.query(
        `
        SELECT module_question_id, question_text, order_index
        FROM public.module_questions
        WHERE module_code = $1
        ORDER BY order_index ASC
        `,
        [moduleCode]
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
            moduleCode,
            q.module_question_id,
            q.question_text,
            q.order_index,
          ]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        module_code: moduleCode,
        questions_cloned: moduleQuestions.rowCount,
      });
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error(`[API attach module] Error:`, error);
    return NextResponse.json(
      { error: "Failed to attach module", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
