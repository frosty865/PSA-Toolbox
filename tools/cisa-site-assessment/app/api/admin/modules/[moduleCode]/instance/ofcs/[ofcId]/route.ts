import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/modules/[moduleCode]/instance/ofcs/[ofcId]
 * Update a single instance OFC (ofc_text).
 * OFC must belong to this module's instance.
 */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ moduleCode: string; ofcId: string }> }
) {
  const { moduleCode, ofcId } = await ctx.params;
  const normalizedModuleCode = decodeURIComponent(moduleCode).trim();
  const normalizedOfcId = decodeURIComponent(ofcId).trim();

  let body: { ofc_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body.ofc_text === undefined || typeof body.ofc_text !== "string") {
    return NextResponse.json(
      { error: "ofc_text required", message: "Provide ofc_text" },
      { status: 400 }
    );
  }

  const text = body.ofc_text.trim();
  if (!text) {
    return NextResponse.json(
      { error: "ofc_text cannot be empty", message: "ofc_text cannot be empty" },
      { status: 400 }
    );
  }

  const pool = getRuntimePool();

  const result = await pool.query(
    `UPDATE public.module_instance_ofcs o
     SET ofc_text = $1
     FROM public.module_instances mi
     WHERE o.id = $2::uuid
       AND o.module_instance_id = mi.id
       AND mi.module_code = $3
     RETURNING o.id, o.criterion_key, o.template_key, o.ofc_text`,
    [text, normalizedOfcId, normalizedModuleCode]
  );

  if (!result.rowCount || result.rows.length === 0) {
    return NextResponse.json(
      { error: "OFC not found", message: "OFC not found or does not belong to this module" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    ofc: result.rows[0],
  });
}
