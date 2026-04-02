import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '../../../lib/baselineLoader';
import { assertRuntimeQuestionList } from '@/app/lib/contracts/runtimeQuestion';
import { assertNoLegacyIntent } from '@/app/lib/invariants/noLegacyIntent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/questions
 *
 * QUESTION CATALOG ENDPOINT (PSA scope, canon-centric)
 *
 * Returns baseline questions from public.baseline_spines_runtime only.
 * - Does NOT query public.expansion_questions (not in canonical workflow).
 * - Does NOT inject legacy intent (intent, what_counts_as_yes, typical_evidence, etc.).
 * - IntentPanel fetches reference_impl / subtype_overview by discipline_subtype_id.
 *
 * Query params:
 * - universe: 'BASE' | 'EXPANSION' | 'ALL' (default: 'ALL')
 *   - ALL or BASE: return baseline from baseline_spines_runtime.
 *   - EXPANSION: return empty list (expansion_questions not used).
 * - include_intent: Accepted but ignored. We do NOT attach legacy intent (intent, what_counts_as_yes, etc.).
 *   IntentPanel fetches reference_impl lazily by discipline_subtype_id.
 * - active_only: Filter to active spines (default: true)
 *
 * Response shape:
 * {
 *   questions: [ { canon_id, discipline_code, subtype_code, discipline_subtype_id, question_text, response_enum, layer } ],
 *   base_questions: <same as questions, for backward compat>,
 *   expansion_questions: [],
 *   meta: { universe, baseline_count, expansion_included: false }
 * }
 */

interface QuestionItem {
  canon_id: string;
  question_code: string;
  discipline_code: string;
  subtype_code: string | null;
  discipline_subtype_id: string | null;
  question_text: string;
  response_enum: ['YES', 'NO', 'N_A'];
  layer: 'baseline';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const universe = searchParams.get('universe') || 'ALL';
    const activeOnly = searchParams.get('active_only') !== 'false';
    // include_intent: accepted but ignored; we do not attach legacy intent. IntentPanel uses discipline_subtype_id.

    const questions: QuestionItem[] = [];
    let baseline_count = 0;

    // Baseline from baseline_spines_runtime (canon-centric, active only unless requested)
    if (universe === 'ALL' || universe === 'BASE') {
      const spines = await loadBaseline(activeOnly);
      for (const s of spines) {
        const re = Array.isArray(s.response_enum) ? s.response_enum : ['YES', 'NO', 'N_A'];
        questions.push({
          canon_id: s.canon_id,
          question_code: s.canon_id,
          discipline_code: s.discipline_code,
          subtype_code: s.subtype_code ?? null,
          discipline_subtype_id: s.discipline_subtype_id ?? null,
          question_text: s.question_text,
          response_enum: re.length === 3 ? (re as ['YES', 'NO', 'N_A']) : ['YES', 'NO', 'N_A'],
          layer: 'baseline',
        });
      }
      baseline_count = questions.length;
    }

    // EXPANSION: not used; return empty. No query to expansion_questions, no ERROR logs.
    // expansion_included is always false.

    const body = {
      questions,
      base_questions: questions,
      expansion_questions: [] as typeof questions,
      meta: {
        universe,
        baseline_count,
        expansion_included: false as const,
      },
    };

    assertRuntimeQuestionList(questions);
    assertNoLegacyIntent(body, 'GET /api/runtime/questions');

    return NextResponse.json(body, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = (error as { code?: string })?.code;

    console.error('[API /api/runtime/questions GET] Error:', { message, code });

    return NextResponse.json(
      {
        error: 'Failed to fetch questions',
        message,
        code: code ?? undefined,
        hint:
          code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND'
            ? 'Database connection failed. Check RUNTIME_DATABASE_URL and verify the runtime database is reachable.'
            : undefined,
      },
      { status: 500 }
    );
  }
}

