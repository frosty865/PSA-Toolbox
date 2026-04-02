import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/modules/[moduleCode]/ofcs/[moduleOfcId]/register
 *
 * Register a module OFC from RUNTIME.module_ofcs into CORPUS.ofc_candidate_queue
 * (ofc_origin='MODULE'). Idempotent: if already registered, returns 200
 * { status: "already_registered" }. Otherwise 201 { status: "registered" }.
 *
 * Bridge only; does not change module_ofcs. No automatic link on Add OFC.
 */
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ moduleCode: string; moduleOfcId: string }> }
) {
  try {
    const { moduleCode, moduleOfcId } = await ctx.params;
    const normalizedCode = decodeURIComponent(moduleCode).trim();
    const normalizedId = String(moduleOfcId || "").trim();

    if (!normalizedCode || !normalizedId) {
      return NextResponse.json(
        { error: "moduleCode and moduleOfcId are required" },
        { status: 400 }
      );
    }

    if (!/^MODULE_[A-Z0-9_]+$/.test(normalizedCode)) {
      return NextResponse.json({ error: "Invalid module_code" }, { status: 400 });
    }

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // 1) Read module OFC from RUNTIME.module_ofcs
    const row = await runtimePool.query(
      `SELECT id, ofc_text, ofc_id
       FROM public.module_ofcs
       WHERE id = $1 AND module_code = $2`,
      [normalizedId, normalizedCode]
    );

    if (!row.rows.length) {
      return NextResponse.json(
        { error: "Module OFC not found" },
        { status: 404 }
      );
    }

    const { ofc_text } = row.rows[0] as { id: string; ofc_text: string; ofc_id: string };

    // 2) Optional: one source from module_ofc_sources for title (queue.title if supported)
    let title: string | null = null;
    const src = await runtimePool.query(
      `SELECT source_label, source_url
       FROM public.module_ofc_sources
       WHERE module_ofc_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [normalizedId]
    );
    if (src.rows.length) {
      const s = src.rows[0] as { source_label: string | null; source_url: string };
      title = (s.source_label && s.source_label.trim()) || (s.source_url && s.source_url.trim()) || null;
    }

    // 3) Resolve source_id for MODULE-origin (same as module-ofcs/create)
    let sourceId: string;
    const existing = await corpusPool.query(
      `SELECT source_id FROM public.canonical_sources
       WHERE title = 'MODULE RESEARCH' AND publisher = 'MODULE'
       LIMIT 1`
    );
    if (existing.rows.length) {
      sourceId = existing.rows[0].source_id;
    } else {
      const ins = await corpusPool.query(
        `INSERT INTO public.canonical_sources (title, publisher, source_type, citation_text)
         VALUES ('MODULE RESEARCH', 'MODULE', 'OTHER', 'MODULE RESEARCH, MODULE')
         RETURNING source_id`
      );
      sourceId = ins.rows[0].source_id;
    }

    // 4) Insert into CORPUS.ofc_candidate_queue; handle unique violation for idempotency
    try {
      await corpusPool.query(
        `INSERT INTO public.ofc_candidate_queue
         (source_id, snippet_text, title, status, ofc_origin, module_ofc_id, discipline_subtype_id, discipline_id, ofc_class)
         VALUES ($1, $2, $3, 'PENDING', 'MODULE', $4, NULL, NULL, 'FOUNDATIONAL')`,
        [sourceId, ofc_text || "", title, normalizedId]
      );
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === "23505" || /unique|duplicate|uq_ofc_candidate_queue_module_ofc/i.test(String(errObj.message ?? ""))) {
        return NextResponse.json(
          { status: "already_registered", module_ofc_id: normalizedId, ofc_origin: "MODULE" },
          { status: 200 }
        );
      }
      throw err;
    }

    return NextResponse.json(
      { status: "registered", module_ofc_id: normalizedId, ofc_origin: "MODULE" },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/modules/.../ofcs/.../register POST]", e);
    return NextResponse.json(
      { error: "Failed to register in Module Data queue", message: msg },
      { status: 500 }
    );
  }
}
