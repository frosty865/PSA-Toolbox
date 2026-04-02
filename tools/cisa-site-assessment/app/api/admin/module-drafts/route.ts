import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { guardDraftSql } from "@/app/lib/admin/draftBuilderGuards";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/module-drafts
 *
 * Create a draft from sources. WRITES: module_drafts, module_draft_sources only. No questions.
 * Questions are generated later via POST /generate (template-driven).
 * GUARD: Does NOT write to module_ofcs, ofc_candidate_queue, ofc_library*.
 *
 * Body: { title_hint?: string | null, source_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const titleHint = body.title_hint != null ? String(body.title_hint) : null;
    const sourceIds = Array.isArray(body.source_ids) ? body.source_ids.map(String).filter(Boolean) : [];

    if (sourceIds.length === 0) {
      return NextResponse.json({ error: "source_ids must be a non-empty array" }, { status: 400 });
    }

    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();

    const sr = await corpusPool.query<{ id: string; source_key: string; title: string | null; canonical_url: string | null }>(
      `SELECT id::text as id, source_key, title, canonical_url
       FROM public.source_registry
       WHERE id::text = ANY($1::text[]) OR source_key = ANY($1::text[])`,
      [sourceIds]
    );

    const title = (titleHint && titleHint.trim()) || "Module Draft";
    const summary = "Draft from " + String(sr.rows.length) + " source(s). Generate suggestions from template.";

    const sqlDrafts = `INSERT INTO public.module_drafts (title, summary, status) VALUES ($1, $2, 'DRAFT') RETURNING id, title, summary, status, created_at`;
    guardDraftSql(sqlDrafts);
    const draft = await runtimePool.query(sqlDrafts, [title, summary]);
    const draftId = draft.rows[0].id as string;

    const sqlSource = `INSERT INTO public.module_draft_sources (draft_id, source_id, source_label, source_url) VALUES ($1, $2, $3, $4)`;
    guardDraftSql(sqlSource);
    for (const s of sr.rows) {
      await runtimePool.query(sqlSource, [draftId, s.id, s.title || s.source_key, s.canonical_url]);
    }

    return NextResponse.json(
      { draft_id: draftId, status: "DRAFT", suggestions_count: 0 },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts POST]", e);
    return NextResponse.json(
      { error: "Failed to create module draft", message: msg },
      { status: 500 }
    );
  }
}

