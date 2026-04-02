import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";

const ALLOWED_TYPES = new Set(["OBJECT", "PLAN"]);

/**
 * GET /api/admin/module-standards
 *
 * Returns APPROVED module standards for dropdown selection.
 * Query: ?type=OBJECT|PLAN to filter by standard_type (optional).
 * CORPUS only; no baseline, no canon_id.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type && !ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Invalid type. Use OBJECT or PLAN." },
      { status: 400 }
    );
  }

  let pool;
  try {
    pool = getCorpusPool();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/admin/module-standards] CORPUS pool failed:", e);
    return NextResponse.json(
      {
        error: "CORPUS database unavailable",
        message: msg,
        hint: "Standards live in CORPUS (module_standards). Set CORPUS_DATABASE_URL and ensure CORPUS is reachable.",
      },
      { status: 503 }
    );
  }

  try {
    const params: string[] = [];
    let where = "WHERE status = 'APPROVED'";
    if (type) {
      params.push(type);
      where += ` AND standard_type = $${params.length}`;
    }

    const sql = `
      SELECT standard_key, name, version, standard_type, description
      FROM public.module_standards
      ${where}
      ORDER BY standard_key ASC
    `;
    const q = await pool.query(sql, params);

    return NextResponse.json({
      standards: (q.rows as { standard_key: string; name: string; version: string; standard_type: string; description: string | null }[]).map(
        (r) => ({
          standard_key: r.standard_key,
          name: r.name,
          version: r.version,
          standard_type: r.standard_type,
          description: r.description ?? undefined,
        })
      ),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("module_standards")) {
      return NextResponse.json(
        {
          error: "Module standards not available. Run CORPUS migration for module_standards.",
          hint: "Standards live in CORPUS (module_standards). Ensure CORPUS_DATABASE_URL is set and CORPUS is reachable, then run: node scripts/run_corpus_module_standards.js",
          migrations: [
            "db/migrations/corpus/20260126_1200_module_standards.sql",
            "db/migrations/corpus/20260128_1500_module_standards_type.sql",
          ],
          seeds: [
            "db/seeds/corpus/EV_PARKING_standard_seed.sql",
            "db/seeds/corpus/EAP_standard_seed.sql",
          ],
        },
        { status: 503 }
      );
    }
    console.error("[GET /api/admin/module-standards]", e);
    return NextResponse.json(
      { error: "Failed to load module standards", message: msg },
      { status: 500 }
    );
  }
}

