/**
 * ARCHIVED: GET /api/admin/status
 *
 * Deprecated: Proxied to Flask backend (FLASK_BASE). The PSA app is consolidated
 * and no longer requires the external Flask server; assessment status is available
 * via GET /api/runtime/assessments. Archived 2025-01-24.
 *
 * Restore: move this file back to app/api/admin/status/route.ts
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/status
 *
 * Get assessment status overview for governance visibility.
 * Proxies to Flask backend, but gracefully handles backend unavailability.
 */
export async function GET(request: NextRequest) {
  try {
    const flaskBase = process.env.FLASK_BASE || 'http://localhost:5000';
    // Try multiple possible endpoints
    const endpoints = [
      `${flaskBase}/api/admin/assessments/status`,
      `${flaskBase}/api/v2/assessments`,
    ];

    let response: Response | null = null;
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    if (!response) {
      // If no endpoint worked, return a simple status response
      return NextResponse.json(
        {
          status: 'unknown',
          message: 'Backend service may be unavailable',
          error: lastError?.message || 'Failed to connect to backend',
        },
        { status: 200 } // Return 200 so UI doesn't break
      );
    }

    if (!response.ok) {
      // Return a simple status response even if backend fails
      return NextResponse.json(
        {
          status: 'unavailable',
          message: `Backend returned ${response.status}`,
        },
        { status: 200 } // Return 200 so UI doesn't break
      );
    }

    const data = await response.json();

    // If we got assessments data, transform it to status format
    if (Array.isArray(data) || data.assessments) {
      const assessments = Array.isArray(data) ? data : (data.assessments || []);
      const statusCounts = {
        DRAFT: 0,
        IN_PROGRESS: 0,
        SUBMITTED: 0,
        LOCKED: 0,
      };

      assessments.forEach((assessment: any) => {
        const status = assessment.status || 'DRAFT';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
      });

      return NextResponse.json({
        total: assessments.length,
        by_status: statusCounts,
        status: 'available',
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API /api/admin/status] Error:', error);
    // Return a graceful response instead of 503
    return NextResponse.json(
      {
        status: 'unknown',
        message: 'Backend service unavailable',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 } // Return 200 so UI doesn't break
    );
  }
}
