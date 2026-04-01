import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/**
 * GET /api/vofc/ready — VOFC generation readiness.
 * VOFCs are generated from in-app derived findings; no workbook/library file required.
 */
export async function GET() {
  return NextResponse.json({ ready: true });
}
