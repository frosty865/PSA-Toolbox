import { NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

/**
 * GET /api/admin/module-standards/[standardKey]
 *
 * Returns one module standard (no attributes - attributes removed from doctrine).
 * CORPUS only.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ standardKey: string }> }
) {
  try {
    const { standardKey } = await ctx.params;
    const key = decodeURIComponent(standardKey).trim();
    if (!key) {
      return NextResponse.json({ error: "standardKey required" }, { status: 400 });
    }

    let pool;
    try {
      pool = getCorpusPool();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[GET /api/admin/module-standards/[standardKey]] CORPUS pool failed:", e);
      return NextResponse.json(
        { error: "CORPUS database unavailable", message: msg },
        { status: 503 }
      );
    }

    const std = await pool.query(
      `SELECT id, standard_key, name, description, version, status
       FROM public.module_standards
       WHERE standard_key = $1 AND status = 'APPROVED'`,
      [key]
    );
    if (!std.rowCount) {
      return NextResponse.json({ standard: null }, { status: 200 });
    }

    return NextResponse.json({
      standard: {
        standard_key: std.rows[0].standard_key,
        name: std.rows[0].name,
        description: std.rows[0].description,
        version: std.rows[0].version,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("module_standards")) {
      return NextResponse.json(
        {
          error: "Module standards not available. Run CORPUS migration for module_standards.",
          hint: "Run: node scripts/run_corpus_module_standards.js (requires CORPUS_DATABASE_URL in .env.local)",
        },
        { status: 503 }
      );
    }
    console.error("[GET /api/admin/module-standards/[standardKey]]", e);
    return NextResponse.json(
      { error: "Failed to load module standard", message: msg },
      { status: 500 }
    );
  }
}
