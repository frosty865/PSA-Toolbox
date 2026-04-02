import { NextResponse } from "next/server";
import { getRuntimePool } from "@/app/lib/db/runtime_client";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    const pool = getRuntimePool();

    const { rows } = await pool.query(
      `SELECT status, updated_at FROM assessment_status WHERE assessment_id=$1`,
      [assessmentId]
    );

    return NextResponse.json({ assessmentId, status: rows?.[0]?.status ?? "DRAFT" });
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/status GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status', message: error instanceof Error ? error.message : 'Unknown error' },
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
    const status = body?.status;

    if (!["DRAFT", "IN_PROGRESS", "COMPLETE"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO assessment_status (assessment_id, status)
       VALUES ($1,$2)
       ON CONFLICT (assessment_id) DO UPDATE SET status=$2, updated_at=now()`,
      [assessmentId, status]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[API /api/runtime/assessments/[assessmentId]/status PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update status', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
