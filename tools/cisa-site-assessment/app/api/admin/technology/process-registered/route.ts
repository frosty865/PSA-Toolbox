import { NextRequest, NextResponse } from "next/server";
import { getCorpusPoolForAdmin } from "@/app/lib/db/corpus_client";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/technology/process-registered
 * Body: { source_registry_id: string }
 * Technology pipeline stub: validates source_registry_id and scope_tags.target_type === 'TECHNOLOGY',
 * logs, and returns accepted. Full pipeline (chunking, etc.) to be implemented later.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { source_registry_id?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // optional body
    }
    const source_registry_id = body.source_registry_id;
    if (!source_registry_id || typeof source_registry_id !== "string") {
      return NextResponse.json(
        { error: "source_registry_id is required" },
        { status: 400 }
      );
    }

    const pool = getCorpusPoolForAdmin();
    const sr = await pool.query(
      `SELECT id, source_key, scope_tags FROM public.source_registry WHERE id = $1`,
      [source_registry_id]
    );
    if (sr.rows.length === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }
    const row = sr.rows[0];
    const scope = (row.scope_tags as Record<string, unknown>) || {};
    if (scope.target_type !== "TECHNOLOGY") {
      return NextResponse.json(
        { error: "Source scope_tags.target_type is not TECHNOLOGY" },
        { status: 400 }
      );
    }

    console.log(`[Technology] process-registered accepted (pipeline not enabled yet): ${row.source_key}`);
    return NextResponse.json({
      accepted: true,
      message: "Technology pipeline not enabled yet. Candidate marked INGESTED with log.",
      source_key: row.source_key,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "process-registered failed", message: msg }, { status: 500 });
  }
}
