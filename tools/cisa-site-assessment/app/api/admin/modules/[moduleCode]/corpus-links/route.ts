import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * POST /api/admin/modules/[moduleCode]/corpus-links
 * 
 * Attach a CORPUS source to a module via read-only pointer.
 * 
 * Body: { corpus_source_registry_id, label?, notes? }
 * 
 * Action: Insert into RUNTIME.module_corpus_links only.
 * Does NOT copy documents/chunks. CORPUS remains read-only.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    
    if (!normalized) {
      return NextResponse.json({ ok: false, error: "moduleCode required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const corpusSourceId = body.corpus_source_registry_id;
    
    if (!corpusSourceId) {
      return NextResponse.json(
        { ok: false, error: "corpus_source_registry_id required" },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    
    await runtimePool.query(
      `INSERT INTO public.module_corpus_links (module_code, corpus_source_registry_id, label, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (module_code, corpus_source_registry_id) DO NOTHING
       RETURNING id`,
      [normalized, corpusSourceId, body.label || null, body.notes || null]
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/modules/[moduleCode]/corpus-links]", e);
    return NextResponse.json(
      { ok: false, error: "Failed to attach CORPUS source", message: msg },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/modules/[moduleCode]/corpus-links
 * 
 * List CORPUS sources attached to this module.
 * Returns pointers from RUNTIME.module_corpus_links.
 * For display, fetch CORPUS metadata separately (read-only SELECT from CORPUS).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    
    if (!normalized) {
      return NextResponse.json({ ok: false, error: "moduleCode required" }, { status: 400 });
    }

    const runtimePool = getRuntimePool();
    
    const links = await runtimePool.query(
      `SELECT id, module_code, corpus_source_registry_id, label, notes, created_at
       FROM public.module_corpus_links
       WHERE module_code = $1
       ORDER BY created_at DESC`,
      [normalized]
    );

    return NextResponse.json({
      ok: true,
      links: links.rows,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/admin/modules/[moduleCode]/corpus-links]", e);
    return NextResponse.json(
      { ok: false, error: "Failed to list CORPUS links", message: msg },
      { status: 500 }
    );
  }
}
