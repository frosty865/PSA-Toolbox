import { NextRequest, NextResponse } from 'next/server';
import { loadBaseline } from '@/app/lib/baselineLoader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/baseline/spines
 * 
 * Returns baseline spines directly from baseline_spines_runtime table.
 * 
 * This replaces the psaback Flask endpoint - no external HTTP call needed.
 * Uses the consolidated loadBaseline() function which queries the database directly.
 * 
 * Query params:
 * - active_only (bool, default=true): Only return active spines
 * 
 * Returns: Array of BaselineSpine objects
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') !== 'false'; // default true

    // Use consolidated loader (queries database directly in server context)
    const spines = await loadBaseline(activeOnly);

    return NextResponse.json(spines, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/baseline/spines] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch baseline spines',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

