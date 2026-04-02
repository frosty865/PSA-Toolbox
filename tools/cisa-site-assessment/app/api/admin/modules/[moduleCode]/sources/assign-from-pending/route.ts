/**
 * POST /api/admin/modules/[moduleCode]/sources/assign-from-pending
 *
 * Moves an unassigned source (and its documents) from MODULE_UNASSIGNED/MODULE_PENDING to this module.
 * Body: { source_id: string } (UUID of module_sources or module_documents row).
 */

import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

const UNASSIGNED_MODULE_CODES = ["MODULE_UNASSIGNED", "MODULE_PENDING"];

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const targetModuleCode = decodeURIComponent(moduleCode).trim();
    const sourceId = (await req.json().catch(() => ({}))).source_id;
    if (typeof sourceId !== "string" || !sourceId.trim()) {
      return NextResponse.json(
        { ok: false, error: "Missing source_id in body" },
        { status: 400 }
      );
    }
    const id = sourceId.trim();
    const pool = getRuntimePool();

    const mod = await pool.query(
      `SELECT 1 FROM public.assessment_modules WHERE module_code = $1`,
      [targetModuleCode]
    );
    if (mod.rows.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    let sha256: string | null = null;

    const msRow = await pool.query(
      `SELECT sha256 FROM public.module_sources WHERE id = $1::uuid AND module_code = ANY($2::text[])`,
      [id, UNASSIGNED_MODULE_CODES]
    );
    if (msRow.rows.length > 0) {
      sha256 = (msRow.rows[0] as { sha256: string | null }).sha256;
    }

    if (sha256 == null) {
      const mdRow = await pool.query(
        `SELECT sha256 FROM public.module_documents WHERE id = $1::uuid AND module_code = ANY($2::text[])`,
        [id, UNASSIGNED_MODULE_CODES]
      );
      if (mdRow.rows.length > 0) {
        sha256 = (mdRow.rows[0] as { sha256: string | null }).sha256;
      }
    }

    if (sha256 == null) {
      return NextResponse.json(
        { ok: false, error: "Source not found or not unassigned" },
        { status: 404 }
      );
    }

    const msUpdated = await pool.query(
      `UPDATE public.module_sources SET module_code = $1 WHERE module_code = ANY($2::text[]) AND sha256 = $3`,
      [targetModuleCode, UNASSIGNED_MODULE_CODES, sha256]
    );
    const mdUpdated = await pool.query(
      `UPDATE public.module_documents SET module_code = $1 WHERE module_code = ANY($2::text[]) AND sha256 = $3`,
      [targetModuleCode, UNASSIGNED_MODULE_CODES, sha256]
    );

    const moved =
      (msUpdated.rowCount ?? 0) > 0 || (mdUpdated.rowCount ?? 0) > 0;
    return NextResponse.json({
      ok: true,
      moved,
      sources_updated: msUpdated.rowCount ?? 0,
      documents_updated: mdUpdated.rowCount ?? 0,
    });
  } catch (e: unknown) {
    console.error("[API POST assign-from-pending]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Assign failed" },
      { status: 500 }
    );
  }
}
