import { NextRequest, NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * GET /api/runtime/assessments/[assessmentId]/followups?parent_response_id=...
 * Returns existing follow-up responses for a parent response
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const url = new URL(req.url);
    const parent_response_id = url.searchParams.get("parent_response_id")?.trim();

    if (!parent_response_id) {
      return jsonError(400, "Missing required query param: parent_response_id");
    }

    const pool = getRuntimePool();
    const result = await pool.query(
      `SELECT 
        id,
        assessment_id,
        parent_response_id,
        discipline_subtype_id,
        followup_key,
        followup_text,
        response_type,
        response_value_text,
        response_value_enum,
        response_value_multi,
        created_at,
        updated_at
      FROM public.assessment_followup_responses
      WHERE assessment_id = $1 AND parent_response_id = $2
      ORDER BY followup_key`,
      [assessmentId, parent_response_id]
    );

    return NextResponse.json({
      ok: true,
      followups: result.rows,
    });
  } catch (error) {
    console.error("[API /api/runtime/assessments/[assessmentId]/followups GET] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * POST /api/runtime/assessments/[assessmentId]/followups
 * Upserts follow-up responses for a parent response
 * Body: { parent_response_id, discipline_subtype_id, followups: [{followup_key, followup_text, response_type, value...}] }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const body = await req.json();
    const { parent_response_id, discipline_subtype_id, followups } = body;

    if (!parent_response_id || !discipline_subtype_id || !Array.isArray(followups)) {
      return jsonError(400, "Missing required fields: parent_response_id, discipline_subtype_id, followups");
    }

    const pool = getRuntimePool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Delete existing followups for this parent_response_id
      await client.query(
        `DELETE FROM public.assessment_followup_responses 
         WHERE assessment_id = $1 AND parent_response_id = $2`,
        [assessmentId, parent_response_id]
      );

      // Insert new followups
      for (const followup of followups) {
        const { followup_key, followup_text, response_type, value } = followup;

        if (!followup_key || !followup_text || !response_type) {
          continue; // Skip invalid entries
        }

        let response_value_text = null;
        let response_value_enum = null;
        let response_value_multi = null;

        if (response_type === "TEXT") {
          response_value_text = value || null;
        } else if (response_type === "ENUM") {
          response_value_enum = value || null;
        } else if (response_type === "MULTISELECT") {
          response_value_multi = Array.isArray(value) ? value : (value ? [value] : null);
        }

        await client.query(
          `INSERT INTO public.assessment_followup_responses (
            assessment_id,
            parent_response_id,
            discipline_subtype_id,
            followup_key,
            followup_text,
            response_type,
            response_value_text,
            response_value_enum,
            response_value_multi
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (parent_response_id, followup_key)
          DO UPDATE SET
            followup_text = EXCLUDED.followup_text,
            response_type = EXCLUDED.response_type,
            response_value_text = EXCLUDED.response_value_text,
            response_value_enum = EXCLUDED.response_value_enum,
            response_value_multi = EXCLUDED.response_value_multi,
            updated_at = now()`,
          [
            assessmentId,
            parent_response_id,
            discipline_subtype_id,
            followup_key,
            followup_text,
            response_type,
            response_value_text,
            response_value_enum,
            response_value_multi,
          ]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      console.error("[API /api/runtime/assessments/[assessmentId]/followups POST] Error:", e);
      return jsonError(500, e instanceof Error ? e.message : "Unknown error");
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[API /api/runtime/assessments/[assessmentId]/followups POST] Error:", error);
    return jsonError(500, error instanceof Error ? error.message : "Unknown error");
  }
}
