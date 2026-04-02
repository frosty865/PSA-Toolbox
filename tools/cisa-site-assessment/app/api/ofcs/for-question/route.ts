/**
 * GET /api/ofcs/for-question
 * 
 * Returns ranked and capped OFCs for a specific question (vulnerability).
 * Applies deterministic ranking and returns max 4 OFCs per question.
 * 
 * Query params:
 * - question_canon_id: string (required)
 * - question_subtype_id: string (required)
 * - question_discipline_id: string (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorpusPool } from "@/app/lib/db/corpus_client";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { selectBestOfcs, OfcCandidate } from "@/app/lib/ofc/ranking";
import { OFC_DOCTRINE } from "@/app/lib/doctrine/ofc_doctrine";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const question_canon_id = url.searchParams.get("question_canon_id");
    const question_subtype_id = url.searchParams.get("question_subtype_id");
    const question_discipline_id = url.searchParams.get("question_discipline_id");

    if (!question_canon_id || !question_subtype_id) {
      return NextResponse.json(
        { error: "question_canon_id and question_subtype_id are required" },
        { status: 400 }
      );
    }

    const corpusPool = getCorpusPool();
    const runtimePool = getRuntimePool();

    // Fetch all approved OFCs linked to this question (or eligible for this subtype)
    // First, check if there are existing links
    const linksResult = await runtimePool.query(
      `
      SELECT DISTINCT ofc_id
      FROM public.ofc_question_links
      WHERE question_canon_id = $1
      `,
      [question_canon_id]
    );

    const linkedOfcIds = linksResult.rows.map((r) => r.ofc_id);

    // Fetch OFCs: either linked ones, or all approved OFCs for this subtype
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
        ocq.source_id,
        COALESCE(ocq.ofc_class, 'FOUNDATIONAL') as ofc_class,
        oql.link_score as similarity_score
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.ofc_question_links oql 
        ON ocq.candidate_id::text = oql.ofc_id 
        AND oql.question_canon_id = $1
      WHERE ocq.discipline_subtype_id = $2
        AND ocq.approved = TRUE
        AND ocq.status = 'PROMOTED'
        AND ocq.source_id IS NOT NULL
    `;
    const params: unknown[] = [question_canon_id, question_subtype_id];

    // If we have linked OFCs, prefer those; otherwise get all eligible
    if (linkedOfcIds.length > 0) {
      query += ` AND (ocq.candidate_id::text = ANY($3::text[]) OR oql.ofc_id IS NOT NULL)`;
      params.push(linkedOfcIds);
    }

    query += ` ORDER BY oql.link_score DESC NULLS LAST, ocq.created_at DESC`;

    const result = await corpusPool.query(query, params);

    // Convert to OfcCandidate format
    const candidates: OfcCandidate[] = result.rows.map((row) => ({
      id: row.id,
      ofc_text: row.ofc_text,
      title: row.title,
      discipline_subtype_id: row.discipline_subtype_id,
      discipline_id: row.discipline_id,
      origin: row.origin,
      status: row.status,
      approved: row.approved,
      ofc_class: row.ofc_class,
      source_id: row.source_id,
      citation_bound: row.source_id != null,
      similarity_score: row.similarity_score,
    }));

    // Apply ranking and cap
    const bestOfcs = selectBestOfcs(
      candidates,
      question_subtype_id,
      question_discipline_id || undefined
    );

    return NextResponse.json({
      question_canon_id,
      ofcs: bestOfcs,
      total_candidates: candidates.length,
      returned: bestOfcs.length,
      max_per_vuln: OFC_DOCTRINE.MAX_OFCS_PER_VULN,
    });
  } catch (error: unknown) {
    console.error("[API /api/ofcs/for-question] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch ranked OFCs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

