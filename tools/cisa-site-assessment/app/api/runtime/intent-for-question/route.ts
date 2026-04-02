import { NextRequest, NextResponse } from 'next/server';
import { loadIntentForQuestion } from '@/app/lib/intentLoader';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/intent-for-question
 * 
 * Returns the authoritative intent payload for a question based on strict precedence:
 * - If discipline_subtype_id exists: Reference Impl > Subtype Overview > minimal message
 * - If no discipline_subtype_id: Legacy intent (if available) or "no_subtype"
 * 
 * Query params:
 * - discipline_subtype_id: UUID of the subtype (optional)
 * - canon_id: Question canon_id for legacy intent lookup (optional)
 * - question_code: Alternative question identifier (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const disciplineSubtypeId = searchParams.get('discipline_subtype_id');
    const canonId = searchParams.get('canon_id');
    const questionCode = searchParams.get('question_code');

    const payload = await loadIntentForQuestion({
      discipline_subtype_id: disciplineSubtypeId || null,
      canon_id: canonId || undefined,
      question_code: questionCode || undefined,
    });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error('[API /api/runtime/intent-for-question] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load intent for question',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

