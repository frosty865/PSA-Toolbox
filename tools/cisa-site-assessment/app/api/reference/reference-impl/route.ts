import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { getOrCompute } from "@/app/lib/runtime/reference_impl_cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const discipline_subtype_id = url.searchParams.get("discipline_subtype_id")?.trim();

    if (!discipline_subtype_id) {
      return jsonError(400, "Missing required query param: discipline_subtype_id");
    }

    if (!/^[0-9a-fA-F-]{32,36}$/.test(discipline_subtype_id)) {
      return jsonError(400, "discipline_subtype_id does not look like a UUID");
    }

    const cached = await getOrCompute(discipline_subtype_id, async () => {
      const pool = getRuntimePool();
      const result = await pool.query(
        `SELECT
          discipline_subtype_id,
          reference_impl
         FROM public.discipline_subtype_reference_impl
         WHERE discipline_subtype_id = $1`,
        [discipline_subtype_id]
      );

      if (result.rows.length === 0) {
        return { ok: true, found: false };
      }

      const row = result.rows[0] as { discipline_subtype_id: string; reference_impl: unknown };
      return { ok: true, found: true, payload: { discipline_subtype_id: row.discipline_subtype_id, reference_impl: row.reference_impl } };
    });

    if ("error" in cached) {
      const resp = NextResponse.json({ ok: false, error: cached.error }, { status: 500 });
      resp.headers.set("X-Reference-Impl-Cache", cached.cache);
      return resp;
    }

    if (!cached.payload.found) {
      const resp = NextResponse.json({ ok: false, error: "Reference implementation not found" }, { status: 404 });
      resp.headers.set("X-Reference-Impl-Cache", cached.cache);
      return resp;
    }

    const resp = NextResponse.json(cached.payload.payload, { status: 200 });
    resp.headers.set("X-Reference-Impl-Cache", cached.cache);
    return resp;
  } catch (error) {
    console.error("[API /api/reference/reference-impl GET] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Unknown error");
  }
}
