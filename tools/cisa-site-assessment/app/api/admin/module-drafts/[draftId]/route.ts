import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/module-drafts/[draftId]
 *
 * Update draft title and/or summary during review.
 * Body: { title?: string, summary?: string }
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await ctx.params;
    const body = await request.json();
    const pool = getRuntimePool();

    const d = await pool.query(`SELECT id, status FROM public.module_drafts WHERE id = $1`, [draftId]);
    if (!d.rows.length) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (d.rows[0].status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT can be edited" }, { status: 400 });

    const updates: string[] = ["updated_at = now()"];
    const values: unknown[] = [];
    let i = 1;
    if (body.title !== undefined) {
      updates.push(`title = $${i}`);
      values.push(String(body.title).trim() || "Module Draft");
      i++;
    }
    if (body.summary !== undefined) {
      updates.push(`summary = $${i}`);
      values.push(body.summary == null ? null : String(body.summary).trim());
      i++;
    }
    if (values.length === 0) return NextResponse.json({ success: true });

    values.push(draftId);
    await pool.query(`UPDATE public.module_drafts SET ${updates.join(", ")} WHERE id = $${i}`, values);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/[draftId] PATCH]", e);
    return NextResponse.json({ error: "Failed to update draft", message: msg }, { status: 500 });
  }
}

/**
 * GET /api/admin/module-drafts/[draftId]
 *
 * Returns draft + sources + draft_questions with status.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await ctx.params;
    const pool = getRuntimePool();

    const d = await pool.query(
      `SELECT id, module_code, title, summary, status, scenario_context, scenario_context_ready, created_at, updated_at
       FROM public.module_drafts WHERE id = $1`,
      [draftId]
    );
    if (!d.rows.length) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const src = await pool.query(
      `SELECT id, source_id, source_label, source_url, created_at
       FROM public.module_draft_sources WHERE draft_id = $1 ORDER BY created_at`,
      [draftId]
    );

    const q = await pool.query(
      `SELECT dq.id, dq.question_text, dq.discipline_id, dq.discipline_subtype_id, dq.confidence, dq.rationale, dq.status, dq.created_at, dq.updated_at,
         disc.name AS discipline_name, ds.name AS discipline_subtype_name
       FROM public.module_draft_questions dq
       LEFT JOIN public.disciplines disc ON disc.id = dq.discipline_id
       LEFT JOIN public.discipline_subtypes ds ON ds.id = dq.discipline_subtype_id
       WHERE dq.draft_id = $1 ORDER BY dq.created_at`,
      [draftId]
    );

    return NextResponse.json({
      draft: d.rows[0],
      sources: src.rows,
      questions: q.rows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/[draftId] GET]", e);
    return NextResponse.json(
      { error: "Failed to load draft", message: msg },
      { status: 500 }
    );
  }
}
