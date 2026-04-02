import { NextResponse } from "next/server";
import { runTriage } from "@/app/lib/triage/run_triage";

export const dynamic = "force-dynamic";

export async function POST() {
  const result = await runTriage();
  return NextResponse.json(
    { ok: result.error_count === 0, ...result },
    { status: result.error_count ? 207 : 200 }
  );
}

