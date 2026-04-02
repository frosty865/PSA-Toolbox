import { NextRequest, NextResponse } from "next/server";
import { ensureRuntimePoolConnected } from "@/app/lib/db/runtime_client";
import { getOrCreateRequestId } from "@/app/lib/api/reqId";
import { createModuleQuestion } from "@/app/lib/admin/createModuleQuestion";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/modules/[moduleCode]/questions
 *
 * Add a single module question. Body: { question_text, discipline_id, discipline_subtype_id, asset_or_location, event_trigger? }
 * - discipline_subtype_id: UUID only. If subtype_code is sent, 400 SUBTYPE_CODE_NOT_ALLOWED.
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
  const discipline_id = b?.discipline_id;
  const discipline_subtype_id = b?.discipline_subtype_id;

  const pool = await ensureRuntimePoolConnected();

  try {
    const out = await createModuleQuestion(pool, moduleCode, {
      question_text: b?.question_text,
      discipline_id: b?.discipline_id,
      discipline_subtype_id: b?.discipline_subtype_id,
      asset_or_location: b?.asset_or_location,
      event_trigger: b?.event_trigger,
      subtype_code: b?.subtype_code,
    } as Parameters<typeof createModuleQuestion>[2]);

    let subtypeName: string | null = null;
    try {
      const sn = await pool.query(`SELECT name FROM public.discipline_subtypes WHERE id = $1`, [discipline_subtype_id]);
      subtypeName = sn.rows[0]?.name ?? null;
    } catch { /* ignore */ }

     
    console.log(
      `[module-questions POST] moduleCode=${moduleCode} discipline_id=${discipline_id} discipline_subtype_id=${discipline_subtype_id} subtype_name=${subtypeName ?? "—"} table=module_questions id=${out.module_question_id} request_id=${requestId}`
    );

    return NextResponse.json(
      { success: true, module_question_id: out.module_question_id, order_index: out.order_index, request_id: requestId },
      { status: 201 }
    );
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; details?: Record<string, unknown> };
    if (err?.code === "SUBTYPE_CODE_NOT_ALLOWED" || err?.code === "VALIDATION_ERROR" || err?.code === "INVALID_MODULE_CODE") {
       
      console.log(`[module-questions POST] validation fail code=${err.code} request_id=${requestId}`);
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

    // DB or unexpected
    const msg = err?.message ?? (e instanceof Error ? e.message : String(e));
    const stack = e instanceof Error ? e.stack : undefined;
     
    console.error(`[module-questions POST] error message=${msg} request_id=${requestId}`, stack);

    return NextResponse.json(
      {
        message: "Failed to add module question",
        code: "INSERT_FAILED",
        details: { error: msg, request_id: requestId },
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}
