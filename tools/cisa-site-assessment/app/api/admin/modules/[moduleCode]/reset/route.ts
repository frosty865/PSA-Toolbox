import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

/**
 * POST /api/admin/modules/[moduleCode]/reset
 *
 * Removes the module instance (and CASCADE removes criteria, OFCs, citations,
 * checklist groups, checklist items) so the module returns to a blank canvas.
 * Does NOT delete the module itself (assessment_modules) or its sources.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const normalized = decodeURIComponent(moduleCode).trim();
    if (!normalized) {
      return NextResponse.json({ error: "moduleCode required" }, { status: 400 });
    }

    const runtimePool = getRuntimePool();

    const mod = await runtimePool.query(
      "SELECT 1 FROM public.assessment_modules WHERE module_code = $1",
      [normalized]
    );
    if (!mod.rowCount) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    await runtimePool.query(
      "DELETE FROM public.module_instances WHERE module_code = $1",
      [normalized]
    );

    return NextResponse.json({
      ok: true,
      message: "Module instance removed. Criteria, OFCs, and checklist data have been cleared.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/modules/[moduleCode]/reset]", e);
    return NextResponse.json(
      { error: "Reset failed", message: msg },
      { status: 500 }
    );
  }
}
