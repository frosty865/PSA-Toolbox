import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/modules/ingest/scan
 * Legacy compatibility endpoint.
 *
 * The Python-backed scanner has been retired in favor of the Node module ingest
 * routes:
 * - /api/admin/modules/[moduleCode]/sources/upload
 * - /api/admin/modules/[moduleCode]/sources/add-from-url
 * - /api/admin/modules/[moduleCode]/process-incoming-pdfs
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "LEGACY_ENDPOINT_DISABLED",
      message:
        "This endpoint is retired. Use /api/admin/modules/[moduleCode]/process-incoming-pdfs or the module source upload routes instead.",
    },
    { status: 410 }
  );
}
