import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '@/app/lib/baselineLoader';
import type { BaselineSpine } from '@/app/lib/types/baseline';

export const dynamic = 'force-dynamic';

function buildCoverageByDiscipline(spines: BaselineSpine[]) {
  const map = new Map<
    string,
    { discipline_name: string; subtypes: Set<string>; questions: number }
  >();
  for (const s of spines) {
    const id = s.discipline_code || 'unknown';
    const name = (s.discipline_name && s.discipline_name.trim()) || id;
    if (!map.has(id)) {
      map.set(id, { discipline_name: name, subtypes: new Set(), questions: 0 });
    }
    const row = map.get(id)!;
    row.questions += 1;
    if (s.subtype_code) row.subtypes.add(s.subtype_code);
  }
  return Array.from(map.entries()).map(([discipline_id, v]) => ({
    discipline_id,
    discipline_name: v.discipline_name,
    subtype_count: v.subtypes.size,
    question_count: v.questions,
    capability_dimensions: [] as string[],
  }));
}

function buildCoverageBySubtype(spines: BaselineSpine[]) {
  const map = new Map<
    string,
    {
      subtype_name: string;
      subtype_code: string;
      discipline_id: string;
      discipline_name: string;
      questions: number;
    }
  >();
  for (const s of spines) {
    const code = s.subtype_code?.trim();
    if (!code) continue;
    const key = `${s.discipline_code || 'unknown'}::${code}`;
    if (!map.has(key)) {
      map.set(key, {
        subtype_name: (s.discipline_subtype_name && s.discipline_subtype_name.trim()) || code,
        subtype_code: code,
        discipline_id: s.discipline_code || 'unknown',
        discipline_name: (s.discipline_name && s.discipline_name.trim()) || s.discipline_code || 'Unknown',
        questions: 0,
      });
    }
    map.get(key)!.questions += 1;
  }
  return Array.from(map.values()).map((v) => ({
    subtype_id: `${v.discipline_id}::${v.subtype_code}`,
    subtype_name: v.subtype_name,
    subtype_code: v.subtype_code,
    discipline_id: v.discipline_id,
    discipline_name: v.discipline_name,
    question_count: v.questions,
    capability_dimensions: [] as string[],
  }));
}

/**
 * GET /api/reference/baseline-questions
 * 
 * Returns baseline spines from baseline_spines_runtime (DB) via Next.js API route (consolidated).
 * 
 * NOW USES: baseline_spines_runtime (DB) directly via Next.js API
 * NO LEGACY FALLBACKS: Hard fails if database unavailable
 * 
 * Returns: Array of BaselineSpine objects (canon_id-centric)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const disciplineCode = searchParams.get('discipline_code');
    const subtypeCode = searchParams.get('subtype_code');

    // Load baseline spines from Next.js API route (consolidated - no external psaback needed)
    const spines: BaselineSpine[] = await loadBaseline(true); // active only

    // Apply filters
    let filtered = spines;
    if (disciplineCode) {
      filtered = filtered.filter(s => s.discipline_code === disciplineCode);
    }
    if (subtypeCode) {
      filtered = filtered.filter(s => s.subtype_code === subtypeCode);
    }

    const uniqueSubtypeCodes = new Set(
      filtered.map((s) => s.subtype_code).filter((c): c is string => Boolean(c && c !== '_none'))
    );

    const hasFilters = Boolean(disciplineCode || subtypeCode);

    return NextResponse.json({
      success: true,
      spines: filtered,
      total: filtered.length,
      coverage: {
        by_discipline: buildCoverageByDiscipline(filtered),
        by_subtype: buildCoverageBySubtype(filtered),
      },
      metadata: {
        baseline_version: spines[0]?.canon_version || 'unknown',
        status: 'Active',
        total_questions: filtered.length,
        subtype_count: uniqueSubtypeCodes.size,
        capability_dimensions: [] as string[],
        filtered_count: hasFilters ? filtered.length : undefined,
        frozen: true,
        source: 'baseline_spines_runtime',
      },
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/reference/baseline-questions] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load baseline questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

