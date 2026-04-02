/**
 * POST /api/admin/modules/[moduleCode]/sources/[moduleSourceId]/move-to-pending
 *
 * Moves a source back to unassigned (library). Sets module_code to MODULE_UNASSIGNED
 * so the source appears under unassigned and is no longer attached to this module.
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

const UNASSIGNED_MODULE_CODE = "MODULE_UNASSIGNED";

export const dynamic = "force-dynamic";

export async function POST(
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

    const msUpdated = await pool.query(
      `UPDATE public.module_sources
       SET module_code = $1
       WHERE id = $2::uuid AND module_code = $3
       RETURNING id`,
      [UNASSIGNED_MODULE_CODE, sourceId, normalizedModuleCode]
    );

    if (msUpdated.rowCount && msUpdated.rowCount > 0) {
      return NextResponse.json({ ok: true, moved: true, table: "module_sources" });
    }

    const mdUpdated = await pool.query(
      `UPDATE public.module_documents
       SET module_code = $1
       WHERE id = $2::uuid AND module_code = $3
       RETURNING id`,
      [UNASSIGNED_MODULE_CODE, sourceId, normalizedModuleCode]
    );

    if (mdUpdated.rowCount && mdUpdated.rowCount > 0) {
      return NextResponse.json({ ok: true, moved: true, table: "module_documents" });
    }

    return NextResponse.json(
      { ok: false, error: "Source not found or not in this module" },
      { status: 404 }
    );
  } catch (e: unknown) {
    console.error("[API POST move-to-pending]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Move failed" },
      { status: 500 }
    );
  }
}
