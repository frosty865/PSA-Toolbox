import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '@/app/lib/baselineLoader';
import type { BaselineSpine } from '@/app/lib/types/baseline';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({
      success: true,
      spines: filtered,
      total: filtered.length,
      metadata: {
        baseline_version: spines[0]?.canon_version || 'unknown',
        frozen: true,
        source: 'baseline_spines_runtime',
      }
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

