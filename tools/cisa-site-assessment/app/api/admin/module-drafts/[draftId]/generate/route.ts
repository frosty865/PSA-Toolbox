import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { guardDraftSql } from "@/app/lib/admin/draftBuilderGuards";
import { generateModuleQuestionSuggestions } from "@/app/lib/modules/module_suggestions";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/module-drafts/[draftId]/generate
 *
 * Generate draft questions from module template + evidence. Template-first, evidence-gated.
 * Body: { module_code: string }
 *
 * WRITES: module_draft_questions only. GUARD: no module_ofcs, ofc_candidate_queue, ofc_library*.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await ctx.params;
    const body = await request.json();
    const moduleCode = (body.module_code || "").toString().trim();

    if (!moduleCode || !/^MODULE_[A-Z0-9_]+$/.test(moduleCode)) {
      return NextResponse.json(
        { error: "module_code is required and must match MODULE_[A-Z0-9_]+" },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();

    const d = await runtimePool.query(
      `SELECT id, status FROM public.module_drafts WHERE id = $1`,
      [draftId]
    );
    if (!d.rows.length) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (d.rows[0].status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT can be edited" }, { status: 400 });

    // Get draft sources
    const sources = await runtimePool.query<{ source_id: string }>(
      `SELECT source_id FROM public.module_draft_sources WHERE draft_id = $1`,
      [draftId]
    );
    if (!sources.rows.length) {
      return NextResponse.json({ error: "Draft has no sources" }, { status: 400 });
    }

    const sourceIds = sources.rows.map(r => r.source_id);

    // Generate template-based suggestions
    const { suggestions } = await generateModuleQuestionSuggestions(moduleCode, sourceIds);

    // Map suggestions to draft questions format
    // Need to resolve discipline_subtype_code to discipline_subtype_id
    const subRows = await runtimePool.query<{ id: string; code: string; discipline_id: string }>(
      `SELECT id, code, discipline_id FROM public.discipline_subtypes WHERE is_active = true`
    );
    const subtypeByCode = new Map<string, { id: string; discipline_id: string }>();
    for (const r of subRows.rows) {
      if (r.code) subtypeByCode.set(r.code.toUpperCase(), { id: r.id, discipline_id: r.discipline_id });
    }

    const sqlQuestion = `INSERT INTO public.module_draft_questions (draft_id, question_text, discipline_id, discipline_subtype_id, confidence, rationale, status) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT')`;
    guardDraftSql(sqlQuestion);

    let inserted = 0;
    for (const sug of suggestions) {
      const subtype = sug.discipline_subtype_code ? subtypeByCode.get(sug.discipline_subtype_code) : null;
      if (!subtype) continue; // Skip if subtype not found

      await runtimePool.query(sqlQuestion, [
        draftId,
        sug.question,
        subtype.discipline_id,
        subtype.id,
        0.7, // confidence from template + evidence
        sug.rationale, // evidence excerpt
      ]);
      inserted++;
    }

    return NextResponse.json({
      success: true,
      suggestions_count: inserted,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/.../generate POST]", e);
    return NextResponse.json(
      { error: "Failed to generate suggestions", message: msg },
      { status: 500 }
    );
  }
}
