import { NextResponse } from "next/server";
import { OFC_DOCTRINE } from "@/app/lib/doctrine/ofc_doctrine";

/**
 * GET /api/admin/doctrine/selftest
 * 
 * Simple visibility check that the runtime is on doctrine V1.
 * Returns the doctrine flags for verification.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    doctrine: OFC_DOCTRINE,
    timestamp: new Date().toISOString(),
  });
}

