import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/modules/[moduleCode]/instance/criteria/[criterionId]
 * Update a single instance criterion (question_text, title).
 * Criterion must belong to this module's instance.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ moduleCode: string; criterionId: string }> }
) {
  const { moduleCode, criterionId } = await ctx.params;
  const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
  const normalizedCriterionId = decodeURIComponent(criterionId).trim();

  let body: { question_text?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (body.question_text !== undefined && typeof body.question_text === "string") {
    const text = body.question_text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "question_text cannot be empty", message: "question_text cannot be empty" },
        { status: 400 }
      );
    }
    updates.push(`question_text = $${paramIndex}`);
    values.push(text);
    paramIndex++;
  }
  if (body.title !== undefined && typeof body.title === "string") {
    updates.push(`title = $${paramIndex}`);
    values.push(body.title.trim());
    paramIndex++;
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "No fields to update", message: "Provide question_text and/or title" },
      { status: 400 }
    );
  }

  values.push(normalizedCriterionId, normalizedModuleCode);
  const pool = getRuntimePool();

  const result = await pool.query(
    `UPDATE public.module_instance_criteria c
     SET ${updates.join(", ")}
     FROM public.module_instances mi
     WHERE c.id = $${paramIndex}::uuid
       AND c.module_instance_id = mi.id
       AND mi.module_code = $${paramIndex + 1}
     RETURNING c.id, c.criterion_key, c.question_text, c.title`,
    values
  );

  if (!result.rowCount || result.rows.length === 0) {
    return NextResponse.json(
      { error: "Criterion not found", message: "Criterion not found or does not belong to this module" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    criterion: result.rows[0],
  });
}
