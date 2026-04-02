import { NextRequest, NextResponse } from 'next/server';
import { getChecklist } from '@/app/lib/checklistLoader';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/subtype-checklists
 * 
 * Returns capability checklist for a subtype.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subtypeCode = searchParams.get('subtype_code');

    if (!subtypeCode) {
      return NextResponse.json(
        { error: 'subtype_code parameter is required' },
        { status: 400 }
      );
    }

    const checklist = getChecklist(subtypeCode);

    if (!checklist) {
      return NextResponse.json(
        { checklist: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { checklist },
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error("[API /api/runtime/subtype-checklists GET] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to load subtype checklist",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

