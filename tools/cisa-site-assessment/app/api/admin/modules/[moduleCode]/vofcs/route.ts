import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  try {
    const { moduleCode } = await ctx.params;
    const runtimePool = getRuntimePool();

    const { rows } = await runtimePool.query(
      `
      SELECT
        m.id,
        m.module_code,
        m.title,
        m.vofc_text,
        m.tags,
        m.status,
        COALESCE((
          SELECT json_agg(json_build_object(
            'source_registry_id', c.source_registry_id,
            'locator_type', c.locator_type,
            'locator_json', c.locator_json,
            'quote', c.quote
          ) ORDER BY c.created_at DESC)
          FROM public.module_ofc_citations c
          WHERE c.module_ofc_id = m.id
        ), '[]'::json) AS citations
      FROM public.module_ofc_library m
      WHERE m.module_code = $1
        AND m.status = 'ACTIVE'
      ORDER BY m.created_at DESC
      `,
      [moduleCode]
    );

    return NextResponse.json({ count: rows.length, rows });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch module VOFCs";
    console.error(`[API /api/admin/modules/[moduleCode]/vofcs] Error:`, error);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
