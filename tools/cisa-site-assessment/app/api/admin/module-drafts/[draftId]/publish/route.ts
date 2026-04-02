import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardDraftSql } from "@/app/lib/admin/draftBuilderGuards";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/module-drafts/[draftId]/publish
 *
 * Publish draft: copy ACCEPTED questions to module_questions, set draft status.
 * WRITES: module_drafts, assessment_modules, module_questions ONLY.
 * GUARD: Does NOT write to module_ofcs, ofc_candidate_queue, ofc_library*.
 *
 * Body: { module_code: string, title: string }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await ctx.params;
    const body = await request.json();
    const moduleCode = (body.module_code || "").toString().trim();
    const title = (body.title || "").toString().trim();

    if (!moduleCode || !/^MODULE_[A-Z0-9_]+$/.test(moduleCode)) {
      return NextResponse.json({ error: "module_code is required and must match MODULE_[A-Z0-9_]+" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const pool = getRuntimePool();

    const d = await pool.query(
      `SELECT id, title, summary, status FROM public.module_drafts WHERE id = $1`,
      [draftId]
    );
    if (!d.rows.length) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    if (d.rows[0].status !== "DRAFT") {
      return NextResponse.json({ error: "Draft is not in DRAFT status" }, { status: 400 });
    }

    const accepted = await pool.query(
      `SELECT id, question_text, discipline_id, discipline_subtype_id
       FROM public.module_draft_questions WHERE draft_id = $1 AND status = 'ACCEPTED' ORDER BY created_at`,
      [draftId]
    );

    const summary = d.rows[0].summary || null;

    const sqlModule = `INSERT INTO public.assessment_modules (module_code, module_name, description, is_active, status) VALUES ($1, $2, $3, true, 'ACTIVE') ON CONFLICT (module_code) DO UPDATE SET module_name = EXCLUDED.module_name, description = EXCLUDED.description, status = 'ACTIVE', updated_at = now()`;
    guardDraftSql(sqlModule);
    await pool.query(sqlModule, [moduleCode, title, summary]);

    const suffix = moduleCode.replace(/^MODULE_/, "");
    let seq = 1;
    const existing = await pool.query(
      `SELECT module_question_id FROM public.module_questions WHERE module_code = $1 ORDER BY module_question_id DESC LIMIT 1`,
      [moduleCode]
    );
    if (existing.rows?.length) {
      const m = (existing.rows[0].module_question_id as string).match(/_(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }

    const orderRes = await pool.query(
      `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM public.module_questions WHERE module_code = $1`,
      [moduleCode]
    );
    let orderIndex = parseInt(String(orderRes.rows[0]?.next_idx ?? 0), 10);

    const sqlMq = `INSERT INTO public.module_questions (module_code, module_question_id, question_text, discipline_id, discipline_subtype_id, asset_or_location, event_trigger, order_index) VALUES ($1, $2, $3, $4, $5, 'General', 'OTHER', $6)`;
    guardDraftSql(sqlMq);
    for (const r of accepted.rows) {
      const mqId = `MODULEQ_${suffix}_${String(seq).padStart(3, "0")}`;
      await pool.query(sqlMq, [moduleCode, mqId, r.question_text, r.discipline_id, r.discipline_subtype_id, orderIndex]);
      seq++;
      orderIndex++;
    }

    const sqlUpdateDraft = `UPDATE public.module_drafts SET status = 'PUBLISHED', module_code = $1, title = $2, updated_at = now() WHERE id = $3`;
    guardDraftSql(sqlUpdateDraft);
    await pool.query(sqlUpdateDraft, [moduleCode, title, draftId]);

    return NextResponse.json({
      success: true,
      module_code: moduleCode,
      questions_published: accepted.rows.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/[draftId]/publish POST]", e);
    return NextResponse.json(
      { error: "Failed to publish draft", message: msg },
      { status: 500 }
    );
  }
}
