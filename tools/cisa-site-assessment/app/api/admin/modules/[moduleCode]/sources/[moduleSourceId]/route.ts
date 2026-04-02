/**
 * PATCH /api/admin/modules/[moduleCode]/sources/[moduleSourceId]
 * Body: { source_label: string, publisher?: string }
 * Updates the source label and optional publisher (module_sources or module_documents).
 * If id matches module_sources, updates that row; else if id matches module_documents for this module, updates document label.
 *
 * DELETE /api/admin/modules/[moduleCode]/sources/[moduleSourceId]
 * Remove a source from the module. Deletes the module_sources row if present; otherwise
 * deletes the module_documents row (synthetic source) so the UI can remove any listed source.
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string; moduleSourceId: string }> }
) {
  try {
    const { moduleCode, moduleSourceId } = await ctx.params;
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
    const sourceId = decodeURIComponent(moduleSourceId).trim();
    if (!sourceId) {
      return NextResponse.json({ ok: false, error: "Missing source id" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const source_label =
      typeof body?.source_label === "string" ? body.source_label.trim() : null;
    const publisher =
      body?.publisher !== undefined ? (typeof body.publisher === "string" ? body.publisher.trim() : null) : undefined;
    if (source_label === null) {
      return NextResponse.json(
        { ok: false, error: "Body must include source_label (string)" },
        { status: 400 }
      );
    }
    const pool = getRuntimePool();

    // Try module_sources first (id is module_sources.id)
    const hasPublisherCol = await pool
      .query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_sources' AND column_name = 'publisher'`
      )
      .then((r) => (r.rows?.length ?? 0) > 0);

    const setPublisher = hasPublisherCol && publisher !== undefined;
    const updated = setPublisher
      ? await pool.query(
          `UPDATE public.module_sources SET source_label = $1, publisher = $2 WHERE id = $3::uuid AND module_code = $4 RETURNING id, source_label, publisher`,
          [source_label || null, publisher || null, sourceId, normalizedModuleCode]
        )
      : await pool.query(
          `UPDATE public.module_sources SET source_label = $1 WHERE id = $2::uuid AND module_code = $3 RETURNING id, source_label`,
          [source_label || null, sourceId, normalizedModuleCode]
        );
    if (updated.rowCount && updated.rowCount > 0) {
      const row = updated.rows[0] as { source_label: string; publisher?: string | null };
      return NextResponse.json({ ok: true, source_label: row.source_label, ...(row.publisher !== undefined ? { publisher: row.publisher } : {}) });
    }

    // Id may be module_documents.id (synthetic row from module_documents without module_sources)
    const docUpdated = await pool.query(
      `UPDATE public.module_documents
       SET label = $1
       WHERE id = $2::uuid AND module_code = $3
       RETURNING id, label`,
      [source_label || null, sourceId, normalizedModuleCode]
    );
    if (docUpdated.rowCount && docUpdated.rowCount > 0) {
      const row = (docUpdated.rows as { label: string }[])[0];
      return NextResponse.json({ ok: true, source_label: row.label });
    }

    return NextResponse.json(
      { ok: false, error: "Source not found" },
      { status: 404 }
    );
  } catch (e: unknown) {
    console.error("[API PATCH module source]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to update label" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string; moduleSourceId: string }> }
) {
  try {
    const { moduleCode, moduleSourceId } = await ctx.params;
    const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
    const sourceId = decodeURIComponent(moduleSourceId).trim();

    if (!sourceId) {
      return NextResponse.json(
        { ok: false, error: "Missing source id" },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();

    let deleted = await pool.query(
      `DELETE FROM public.module_sources
       WHERE id = $1::uuid AND module_code = $2
       RETURNING id`,
      [sourceId, normalizedModuleCode]
    );

    if (!deleted.rowCount || deleted.rowCount === 0) {
      // Id may be a synthetic source (module_documents without module_sources); remove that row so the UI can clear it
      deleted = await pool.query(
        `DELETE FROM public.module_documents
         WHERE id = $1::uuid AND module_code = $2
         RETURNING id`,
        [sourceId, normalizedModuleCode]
      );
    }

    if (!deleted.rowCount || deleted.rowCount === 0) {
      return NextResponse.json({ ok: true, removed: false });
    }

    return NextResponse.json({ ok: true, removed: true });
  } catch (e: unknown) {
    console.error("[API DELETE module source]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to remove source" },
      { status: 500 }
    );
  }
}
