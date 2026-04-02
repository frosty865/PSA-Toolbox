import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";
import { columnExists, tableExists } from "@/app/lib/db/table_exists";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const pool = getRuntimePool();

    const idStrings = [String(assessmentId)];

    let rows: Record<string, unknown>[] = [];
    try {
      const questionResponsesExists = await tableExists(pool, 'public', 'assessment_question_responses');
      if (questionResponsesExists) {
        const hasResponseEnum = await columnExists(pool, 'public', 'assessment_question_responses', 'response_enum');
        const hasResponse = await columnExists(pool, 'public', 'assessment_question_responses', 'response');
        const responseValueColumn = hasResponseEnum ? 'response_enum' : (hasResponse ? 'response' : null);

        if (!responseValueColumn) {
          rows = [];
        } else {
          const result = await pool.query(
            `SELECT
                id,
                question_code,
                ${responseValueColumn}
             FROM public.assessment_question_responses
             WHERE assessment_id::text = ANY($1::text[])`,
            [idStrings]
          );
          rows = result.rows.map((r: Record<string, unknown>) => ({
            id: r.id,
            response_id: r.id,
            question_code: r.question_code,
            question_canon_id: r.question_code,
            question_template_id: r.question_code,
            response: r.response_enum || r.response,
            response_enum: r.response_enum || r.response,
          }));
        }
      } else {
        const hasQuestionCanonId = await columnExists(pool, 'public', 'assessment_responses', 'question_canon_id');
        const hasQuestionTemplateId = await columnExists(pool, 'public', 'assessment_responses', 'question_template_id');
        const hasQuestionCode = await columnExists(pool, 'public', 'assessment_responses', 'question_code');
        const hasResponse = await columnExists(pool, 'public', 'assessment_responses', 'response');
        const hasAnswer = await columnExists(pool, 'public', 'assessment_responses', 'answer');
        const hasAssessmentId = await columnExists(pool, 'public', 'assessment_responses', 'assessment_id');
        const hasAssessmentInstanceId = await columnExists(pool, 'public', 'assessment_responses', 'assessment_instance_id');
        const assessmentFilterColumn = hasAssessmentId ? 'assessment_id' : (hasAssessmentInstanceId ? 'assessment_instance_id' : null);
        const responseKeyColumns = [
          hasQuestionCanonId ? 'question_canon_id' : null,
          hasQuestionTemplateId ? 'question_template_id' : null,
          hasQuestionCode ? 'question_code' : null,
        ].filter((col): col is string => Boolean(col));
        const responseValueColumn = hasResponse ? 'response' : (hasAnswer ? 'answer' : null);

        if (!responseValueColumn || responseKeyColumns.length === 0 || !assessmentFilterColumn) {
          rows = [];
        } else {
          const result = await pool.query(
            `SELECT 
                id,
                ${responseKeyColumns.join(', ')},
                ${responseValueColumn} as response_enum
             FROM public.assessment_responses
             WHERE ${assessmentFilterColumn}::text = ANY($1::text[])`,
            [idStrings]
          );
          rows = result.rows.map((r: Record<string, unknown>) => ({
            id: r.id,
            response_id: r.id,
            question_code: r.question_canon_id || r.question_template_id || r.question_code,
            question_canon_id: r.question_canon_id || r.question_code,
            question_template_id: r.question_template_id || r.question_code,
            response: r.response_enum,
            response_enum: r.response_enum,
          }));
        }
      }
    } catch (err: unknown) {
      const e = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
      if (e === "42P01") {
        return NextResponse.json(
          {
            ok: false,
            error: 'assessment_responses table must exist in RUNTIME',
            error_code: 'MISSING_RUNTIME_TABLE',
            message: 'assessment_responses must exist in RUNTIME. Legacy fallback removed.'
          },
          { status: 500 }
        );
      }
      // Re-throw other errors
      throw err;
    }

    return NextResponse.json({ assessmentId, responses: rows });
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/responses GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch responses', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const pool = getRuntimePool();

    const body = await req.json();
    const items: Array<{ question_code: string; response_enum: string; detail?: unknown }> = body?.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Only update status if not already IN_PROGRESS (optimization: skip if already set)
      const statusCheck = await client.query(
        `SELECT status FROM assessment_status WHERE assessment_id = $1`,
        [assessmentId]
      );
      
      if (statusCheck.rows.length === 0 || statusCheck.rows[0].status !== 'IN_PROGRESS') {
        await client.query(
          `INSERT INTO assessment_status (assessment_id, status)
           VALUES ($1, 'IN_PROGRESS')
           ON CONFLICT (assessment_id) DO UPDATE SET status='IN_PROGRESS', updated_at=now()`,
          [assessmentId]
        );
      }

      // Batch insert/update using a single query with VALUES clause (much faster)
      const validItems = items.filter(it => it?.question_code && it?.response_enum);
      if (validItems.length > 0) {
        // Build VALUES clause for batch insert
        const values = validItems.map((it, idx) => {
          const baseIdx = idx * 4;
          return `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, now())`;
        }).join(', ');
        
        const params: unknown[] = [];
        validItems.forEach(it => {
          params.push(assessmentId, it.question_code, it.response_enum, JSON.stringify(it.detail ?? {}));
        });

        await client.query(
          `INSERT INTO assessment_question_responses (assessment_id, question_code, response_enum, detail, updated_at)
           VALUES ${values}
           ON CONFLICT (assessment_id, question_code)
           DO UPDATE SET response_enum=EXCLUDED.response_enum, detail=EXCLUDED.detail, updated_at=now()`,
          params
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({ ok: true });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      console.error("[API /api/runtime/assessments/[assessmentId]/responses PUT] Error:", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/responses PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save responses', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
