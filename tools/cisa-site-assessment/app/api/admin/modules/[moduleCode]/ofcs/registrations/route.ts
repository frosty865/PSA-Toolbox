import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/modules/[moduleCode]/ofcs/registrations
 *
 * Returns module_ofc_ids that are registered in CORPUS.ofc_candidate_queue
 * (ofc_origin='MODULE', module_ofc_id IS NOT NULL) for this module.
 * Used to show "Registered" badges on Overview without fetching the global queue.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalizedCode = decodeURIComponent(moduleCode).trim();

    if (!normalizedCode || !/^MODULE_[A-Z0-9_]+$/.test(normalizedCode)) {
      return NextResponse.json({ error: "Invalid module_code" }, { status: 400 });
    }

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // 1) RUNTIME: ids of module OFCs for this module
    const rt = await runtimePool.query(
      `SELECT id::text FROM public.module_ofcs WHERE module_code = $1`,
      [normalizedCode]
    );
    const moduleOfcIds: string[] = (rt.rows || []).map((r: Record<string, unknown>) => r.id).filter(Boolean) as string[];

    if (moduleOfcIds.length === 0) {
      return NextResponse.json({ registered_module_ofc_ids: [] }, { status: 200 });
    }

    // 2) CORPUS: which of those are registered (module_ofc_id column may not exist yet)
    let registered: string[] = [];
    try {
      const corpus = await corpusPool.query(
        `SELECT module_ofc_id FROM public.ofc_candidate_queue
         WHERE ofc_origin = 'MODULE' AND module_ofc_id IS NOT NULL AND module_ofc_id = ANY($1::text[])`,
        [moduleOfcIds]
      );
      registered = (corpus.rows || []).map((r: Record<string, unknown>) => r.module_ofc_id).filter(Boolean) as string[];
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/column.*module_ofc_id.*does not exist/i.test(msg)) {
        return NextResponse.json({ registered_module_ofc_ids: [] }, { status: 200 });
      }
      throw e;
    }

    return NextResponse.json({ registered_module_ofc_ids: registered }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/modules/.../ofcs/registrations GET]", e);
    return NextResponse.json(
      { error: "Failed to load registrations", message: msg },
      { status: 500 }
    );
  }
}
