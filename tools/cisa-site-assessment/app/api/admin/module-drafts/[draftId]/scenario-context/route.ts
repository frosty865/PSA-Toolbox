import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/module-drafts/[draftId]/scenario-context
 *
 * DEPRECATED: Scenario context is no longer used (template-first doctrine).
 * This endpoint is kept for backward compatibility but is a no-op.
 * Body: { threat_scenarios, environments, assets_at_risk, phases? }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await ctx.params;
    // Consume body but ignore it
    await request.json();

    const pool = getRuntimePool();
    const d = await pool.query(
      `SELECT id, status FROM public.module_drafts WHERE id = $1`,
      [draftId]
    );
    if (!d.rows.length) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (d.rows[0].status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT can be edited" }, { status: 400 });

    // No-op: scenario context is deprecated (template-first)
    return NextResponse.json({ success: true, scenario_context_ready: false, deprecated: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[API /api/admin/module-drafts/.../scenario-context POST]", e);
    return NextResponse.json(
      { error: "Failed to set scenario context", message: msg },
      { status: 500 }
    );
  }
}
