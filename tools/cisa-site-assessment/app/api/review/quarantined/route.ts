import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/review/quarantined
 * 
 * Read-only endpoint to fetch quarantined chunks from Phase 4.
 * All authenticated roles can view.
 */
export async function GET(request: NextRequest) {
  try {
    const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';
    const response = await fetch(`${flaskBase}/api/review/quarantined`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth headers if present
        ...(request.headers.get('X-User-Role') && {
          'X-User-Role': request.headers.get('X-User-Role') || '',
        }),
        ...(request.headers.get('X-User-Id') && {
          'X-User-Id': request.headers.get('X-User-Id') || '',
        }),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to fetch quarantined chunks',
          message: errorData.message || `Backend returned ${response.status}`,
          quarantined_chunks: [],
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('[API /api/review/quarantined] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch quarantined chunks',
        message: error instanceof Error ? error.message : 'Unknown error',
        quarantined_chunks: [],
      },
      { status: 503 }
    );
  }
}


