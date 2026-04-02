import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/system/security-mode
 * 
 * Proxy to Flask backend security mode endpoint.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js route signature
export async function GET(request: NextRequest) {
  try {
    const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';
    const response = await fetch(`${flaskBase}/api/system/security-mode`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(2000), // Reduced to 2 seconds for faster failure
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to get security mode',
          message: errorData.message || `Backend returned ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error('[API /api/system/security-mode] Error:', error);
    // Return default response if Flask backend is unavailable
    // This allows the app to load even without Flask running
    return NextResponse.json(
      {
        mode: 'DISABLED',
        mutable: false,
        allowed_modes: ['DISABLED', 'ENGINEERING', 'ENFORCED'],
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/system/security-mode
 * 
 * Proxy to Flask backend security mode endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';
    
    const response = await fetch(`${flaskBase}/api/system/security-mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to set security mode',
          message: errorData.message || `Backend returned ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error('[API /api/system/security-mode] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to set security mode',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


