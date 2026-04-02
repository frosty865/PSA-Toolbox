import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reference/discipline-subtypes/[subtypeId]/reference-impl
 * Returns the canonical reference implementation for a discipline subtype
 * 
 * Returns 404 if no reference implementation exists (do not invent content)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ subtypeId: string }> }
) {
  try {
    const { subtypeId } = await params;

    // Basic UUID validation
    if (!/^[0-9a-fA-F-]{32,36}$/.test(subtypeId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid subtype ID format" },
        { status: 400 }
      );
    }

    const pool = getRuntimePool();
    const result = await pool.query(
      `SELECT 
        discipline_subtype_id,
        reference_impl
      FROM public.discipline_subtype_reference_impl
      WHERE discipline_subtype_id = $1`,
      [subtypeId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Reference implementation not found" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    return NextResponse.json({
      ok: true,
      discipline_subtype_id: row.discipline_subtype_id,
      reference_impl: row.reference_impl,
    });
  } catch (error) {
    console.error("[API /api/reference/discipline-subtypes/[subtypeId]/reference-impl GET] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch reference implementation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
