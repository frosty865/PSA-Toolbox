import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/review/[chunk_id]
 * 
 * Submit a review decision for a quarantined chunk.
 * Requires ENGINEER or GOVERNANCE role.
 */
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chunk_id: string }> }
) {
  try {
    const { chunk_id } = await params;
    const chunkId = chunk_id;
    const body = await request.json();

    const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';
    const response = await fetch(`${flaskBase}/api/review/${chunkId}`, {
      method: 'POST',
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
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to submit review',
          message: errorData.message || `Backend returned ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const chunkId = await params.then(p => p.chunk_id).catch(() => 'unknown');
    console.error(`[API /api/review/${chunkId}] Error:`, error);
    return NextResponse.json(
      {
        error: 'Failed to submit review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

