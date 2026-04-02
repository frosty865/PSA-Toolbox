import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { assertOfcAttachable } from "@/app/lib/ofc/guardrails";

type Body = {
  question_canon_id: string;
  ofc_id: string;
};

/**
 * POST /api/ofcs/link
 * 
 * Creates a link between a question and an OFC.
 * Doctrine: Hard fails if OFC is not attachable (not approved, subtype mismatch, etc.)
 * 
 * Body:
 * - question_canon_id: string (canon_id from baseline_spines_runtime)
 * - ofc_id: string (candidate_id from ofc_candidate_queue)
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.question_canon_id || !body?.ofc_id) {
      return NextResponse.json(
        { error: "question_canon_id and ofc_id are required" },
        { status: 400 }
      );
    }

    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();

    // Fetch question from baseline_spines_runtime
    const qResult = await runtimePool.query(
      `
      SELECT canon_id, discipline_id, discipline_subtype_id
      FROM public.baseline_spines_runtime
      WHERE canon_id = $1
      `,
      [body.question_canon_id]
    );

    if (qResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const q = qResult.rows[0];

    // Fetch OFC from ofc_candidate_queue
    const ofcResult = await corpusPool.query(
      `
      SELECT 
        candidate_id::text as id,
        discipline_id,
        discipline_subtype_id,
        ofc_origin as origin,
        status,
        approved
      FROM public.ofc_candidate_queue
      WHERE candidate_id = $1
      `,
      [body.ofc_id]
    );

    if (ofcResult.rows.length === 0) {
      return NextResponse.json(
        { error: "OFC not found" },
        { status: 404 }
      );
    }

    const ofc = ofcResult.rows[0];

    // DOCTRINE HARD FAIL - throws Error if violated
    assertOfcAttachable(
      {
        canon_id: q.canon_id,
        discipline_id: q.discipline_id,
        discipline_subtype_id: q.discipline_subtype_id,
      },
      {
        id: ofc.id,
        discipline_id: ofc.discipline_id,
        discipline_subtype_id: ofc.discipline_subtype_id,
        origin: ofc.origin,
        status: ofc.status,
        approved: ofc.approved,
      }
    );

    // Insert link into RUNTIME database (ofc_question_links table)
    // Table structure: question_canon_id, ofc_id, link_score, link_method, link_explanation
    const linkResult = await runtimePool.query(
      `
      INSERT INTO public.ofc_question_links (
        question_canon_id,
        ofc_id,
        link_score,
        link_method,
        link_explanation
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (question_canon_id, ofc_id) DO NOTHING
      RETURNING question_canon_id, ofc_id
      `,
      [
        body.question_canon_id,
        body.ofc_id,
        1.0, // Manual links get max score
        "MANUAL",
        JSON.stringify({ doctrine: "OFC_DOCTRINE_V1", enforced: true }),
      ]
    );

    if (linkResult.rows.length === 0) {
      // Link may already exist, check if it does
      const existingResult = await runtimePool.query(
        `
        SELECT question_canon_id, ofc_id
        FROM public.ofc_question_links
        WHERE question_canon_id = $1 AND ofc_id = $2
        `,
        [body.question_canon_id, body.ofc_id]
      );

      if (existingResult.rows.length > 0) {
        return NextResponse.json({
          ok: true,
          message: "Link already exists",
        });
      }

      return NextResponse.json(
        { error: "Failed to create link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[API /api/ofcs/link] Error:", error);
    
    // If it's a doctrine violation, return 400
    if (error instanceof Error && error.message.includes("doctrine")) {
      return NextResponse.json(
        {
          error: "Doctrine violation",
          message: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to link OFC to question",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

