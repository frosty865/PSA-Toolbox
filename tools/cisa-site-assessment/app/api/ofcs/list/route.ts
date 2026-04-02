import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { OFC_DOCTRINE, OfcOrigin } from "@/app/lib/doctrine/ofc_doctrine";
import { assertPanelSeparation } from "@/app/lib/ofc/guardrails";

/**
 * GET /api/ofcs/list
 * 
 * Returns approved OFCs for attachment panels (library selection).
 * Doctrine: Only shows approved OFCs, filtered by origin and subtype.
 * 
 * Query params:
 * - origin: 'CORPUS' | 'MODULE' (required)
 * - discipline_subtype_id: UUID (required)
 * - discipline_id: UUID (optional, for additional filtering)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const origin = (url.searchParams.get("origin") || "CORPUS") as OfcOrigin;
    const discipline_subtype_id = url.searchParams.get("discipline_subtype_id");
    const discipline_id = url.searchParams.get("discipline_id");

    if (!discipline_subtype_id) {
      return NextResponse.json(
        { error: "discipline_subtype_id is required" },
        { status: 400 }
      );
    }

    if (OFC_DOCTRINE.STRICT_CORPUS_MODULE_SEPARATION) {
      if (origin !== "CORPUS" && origin !== "MODULE") {
        return NextResponse.json(
          { error: "Invalid origin. Must be CORPUS or MODULE" },
          { status: 400 }
        );
      }
    }

    const pool = getCorpusPool();

    // Doctrine: only show approved OFCs for attachment panels
    // PROMOTED status = approved
    // Also include ofc_class for ranking
    let query = `
      SELECT 
        ocq.candidate_id::text as id,
        ocq.snippet_text as ofc_text,
        ocq.title,
        ocq.discipline_id,
        ocq.discipline_subtype_id,
        ocq.ofc_origin as origin,
        ocq.status,
        ocq.approved,
        COALESCE(ocq.ofc_class, 'FOUNDATIONAL') as ofc_class,
        ocq.created_at
      FROM public.ofc_candidate_queue ocq
      WHERE ocq.discipline_subtype_id = $1
        AND ocq.ofc_origin = $2
        AND ocq.approved = TRUE
        AND ocq.status = 'PROMOTED'
        AND ocq.source_id IS NOT NULL
    `;
    const params: unknown[] = [discipline_subtype_id, origin];
    let paramIndex = 3;

    if (discipline_id) {
      query += ` AND ocq.discipline_id = $${paramIndex}`;
      params.push(discipline_id);
      paramIndex++;
    }

    query += ` ORDER BY ocq.title NULLS LAST, ocq.created_at DESC`;

    const result = await pool.query(query, params);

    // Validate each OFC matches requested origin (defense in depth)
    const items = result.rows.map((row) => {
      const ofc = {
        id: row.id,
        discipline_id: row.discipline_id,
        discipline_subtype_id: row.discipline_subtype_id,
        origin: row.origin,
        status: row.status,
        approved: row.approved,
      };
      // This will throw if doctrine is violated
      assertPanelSeparation(origin, ofc);
      return {
        id: row.id,
        title: row.title,
        ofc_text: row.ofc_text,
        discipline_id: row.discipline_id,
        discipline_subtype_id: row.discipline_subtype_id,
        origin: row.origin,
        status: row.status,
        ofc_class: row.ofc_class,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error("[API /api/ofcs/list] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch OFCs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

