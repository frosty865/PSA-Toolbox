import { NextRequest, NextResponse } from "next/server";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";
import { getOrCreateRequestId } from "@/app/lib/api/reqId";
import { createModuleOfc } from "@/app/lib/admin/createModuleOfc";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/modules/[moduleCode]/ofcs
 *
 * Add a single module OFC from template. Body: { discipline_subtype_id, source_url?, source_label? }
 * - ofc_text comes from module_ofc_templates_v1 (discipline_subtype_id). Do not send ofc_text or subtype_code.
 * - If no template for subtype: 400 NO_OFC_TEMPLATE_FOR_SUBTYPE.
 * - On validation failure: 400 { message, code, details, request_id }
 * - On DB/insert failure: 500 { message, code, details, request_id }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ moduleCode: string }> }
) {
  const requestId = getOrCreateRequestId(request);
  const { moduleCode } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body", code: "INVALID_JSON", details: undefined, request_id: requestId },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const discipline_subtype_id = b?.discipline_subtype_id;

  const pool = await ensureRuntimePoolConnected();

  try {
    const out = await createModuleOfc(pool, moduleCode, {
      discipline_subtype_id: b?.discipline_subtype_id,
      source_url: b?.source_url,
      source_label: b?.source_label,
      subtype_code: b?.subtype_code,
      ofc_text: b?.ofc_text,
    } as Parameters<typeof createModuleOfc>[2]);

    let subtypeName: string | null = null;
    try {
      const sn = await pool.query(`SELECT name FROM public.discipline_subtypes WHERE id = $1`, [discipline_subtype_id]);
      subtypeName = sn.rows[0]?.name ?? null;
    } catch { /* ignore */ }

     
    console.log(
      `[module-ofcs POST] moduleCode=${moduleCode} discipline_subtype_id=${discipline_subtype_id} subtype_name=${subtypeName ?? "—"} table=module_ofcs id=${out.id} request_id=${requestId}`
    );

    return NextResponse.json(
      { success: true, ofc_id: out.ofc_id, id: out.id, order_index: out.order_index, request_id: requestId },
      { status: 201 }
    );
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; details?: Record<string, unknown> };
    if (
      err?.code === "SUBTYPE_CODE_NOT_ALLOWED" ||
      err?.code === "OFC_TEXT_NOT_ALLOWED" ||
      err?.code === "VALIDATION_ERROR" ||
      err?.code === "INVALID_MODULE_CODE" ||
      err?.code === "NO_OFC_TEMPLATE_FOR_SUBTYPE"
    ) {
       
      console.log(`[module-ofcs POST] validation fail code=${err.code} request_id=${requestId}`);
      return NextResponse.json(
        { message: err.message ?? "Validation failed", code: err.code, details: err.details, request_id: requestId },
        { status: 400 }
      );
    }
    if (err?.code === "MODULE_NOT_FOUND") {
      return NextResponse.json(
        { message: err.message ?? "Module not found", code: err.code, details: err.details, request_id: requestId },
        { status: 404 }
      );
    }

    const msg = err?.message ?? (e instanceof Error ? e.message : String(e));
    const stack = e instanceof Error ? e.stack : undefined;
     
    console.error(`[module-ofcs POST] error message=${msg} request_id=${requestId}`, stack);

    return NextResponse.json(
      {
        message: "Failed to add module OFC",
        code: "INSERT_FAILED",
        details: { error: msg, request_id: requestId },
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}
