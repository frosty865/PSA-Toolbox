import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { validateExistenceQuestion } from "@/app/lib/modules/question_quality";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/module-drafts/[draftId]/questions/[draftQuestionId]
 *
 * Accept or reject a draft question; optional edits to question_text, discipline_id, discipline_subtype_id.
 * Body: { status: "ACCEPTED" | "REJECTED", edits?: { question_text?, discipline_id?, discipline_subtype_id? } }
 *
 * HARD VALIDATION: If accepting, question must pass validateExistenceQuestion().
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ draftId: string; draftQuestionId: string }> }
) {
  try {
    const { draftId, draftQuestionId } = await ctx.params;
    const body = await request.json();
    const status = body.status === "REJECTED" ? "REJECTED" : "ACCEPTED";
    const edits = body.edits && typeof body.edits === "object" ? body.edits : {};

    const pool = getRuntimePool();

    const q = await pool.query(
      `SELECT id, draft_id, question_text FROM public.module_draft_questions WHERE id = $1 AND draft_id = $2`,
      [draftQuestionId, draftId]
    );
    if (!q.rows.length) {
      return NextResponse.json({ error: "Draft question not found" }, { status: 404 });
    }

    // Determine final question text (edited or original)
    const finalQuestionText = edits.question_text != null && typeof edits.question_text === "string" && edits.question_text.trim()
      ? edits.question_text.trim()
      : q.rows[0].question_text;

    // HARD VALIDATION: If accepting, question must pass quality check
    if (status === "ACCEPTED") {
      const validation = validateExistenceQuestion(finalQuestionText);
      if (!validation.ok) {
        return NextResponse.json(
          { error: "Question failed validation", reasons: validation.reasons },
          { status: 400 }
        );
      }
    }

    const updates: string[] = ["status = $1", "updated_at = now()"];
    const values: unknown[] = [status];
    let i = 2;

    if (edits.question_text != null && typeof edits.question_text === "string" && edits.question_text.trim()) {
      updates.push(`question_text = $${i}`);
      values.push(edits.question_text.trim());
      i++;
    }
    if (edits.discipline_id != null && typeof edits.discipline_id === "string") {
      updates.push(`discipline_id = $${i}`);
      values.push(edits.discipline_id);
      i++;
    }
    if (edits.discipline_subtype_id !== undefined) {
      updates.push(`discipline_subtype_id = $${i}`);
      values.push(edits.discipline_subtype_id === null || edits.discipline_subtype_id === "" ? null : edits.discipline_subtype_id);
      i++;
    }

    values.push(draftQuestionId);
    await pool.query(
      `UPDATE public.module_draft_questions SET ${updates.join(", ")} WHERE id = $${i}`,
      values
    );

    return NextResponse.json({ success: true, status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/.../questions/... POST]", e);
    return NextResponse.json(
      { error: "Failed to update draft question", message: msg },
      { status: 500 }
    );
  }
}
