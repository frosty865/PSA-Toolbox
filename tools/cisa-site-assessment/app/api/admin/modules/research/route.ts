import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/modules/research
 *
 * The legacy module research downloader is retired from the Vercel-facing app.
 * Keep research generation in the offline tooling under tools/research/ if
 * you need it locally.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "LEGACY_RESEARCH_DISABLED",
        message: "Module research downloader is not available in the deployed app.",
        migration: {
          step1: "Use the offline tools/research workflow locally.",
          step2: "Keep research-generated discovery/manifest artifacts out of the Vercel runtime path.",
        },
      },
    },
    { status: 410 }
  );
}
