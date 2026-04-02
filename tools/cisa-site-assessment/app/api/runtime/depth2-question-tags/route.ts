import { NextRequest, NextResponse } from 'next/server';
import { getDepth2TagsBySubtype, getDepth2TagsIndex } from '@/app/lib/checklistLoader';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/depth2-question-tags
 * 
 * Returns tags for depth-2 questions.
 * Optional filter by subtype_code.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subtypeCode = searchParams.get('subtype_code');

    if (subtypeCode) {
      // Return tags for specific subtype
      const tagsByQuestion = getDepth2TagsBySubtype(subtypeCode);
      const questions = Array.from(tagsByQuestion.entries()).map(([canon_id, tags]) => ({
        canon_id,
        tags,
      }));

      return NextResponse.json(
        { questions },
        { status: 200 }
      );
    } else {
      // Return all tags
      const allTags = getDepth2TagsIndex();
      const questions = Array.from(allTags.entries()).map(([canon_id, tags]) => ({
        canon_id,
        tags,
      }));

      return NextResponse.json(
        { questions },
        { status: 200 }
      );
    }

  } catch (error: unknown) {
    console.error("[API /api/runtime/depth2-question-tags GET] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to load depth-2 question tags",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

