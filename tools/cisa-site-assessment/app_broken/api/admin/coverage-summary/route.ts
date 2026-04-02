import { NextRequest, NextResponse } from 'next/server';

const FLASK_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.FLASK_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const url = `${FLASK_BASE}/api/admin/coverage/sector-subsector`;
    console.log(`[API] Fetching from Flask: ${url}`);
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      let errorText = 'Unknown error';
      let errorDetails = '';
      try {
        errorText = await response.text();
        // Try to parse as JSON for structured error
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.error || errorJson.message || errorJson.details || errorText.substring(0, 500);
        } catch {
          errorDetails = errorText.substring(0, 500);
        }
      } catch (e) {
        errorDetails = 'Could not read error response';
      }
      
      console.error(`Flask backend error (${response.status}):`, errorDetails);
      
      // For 500 errors, return 502 (Bad Gateway) to indicate it's a backend issue
      // This helps distinguish between Next.js errors and Flask errors
      const statusCode = response.status === 500 ? 502 : response.status;
      
      return NextResponse.json(
        { 
          error: `Flask backend returned ${response.status}: ${response.statusText}`,
          details: errorDetails,
          backend_url: url,
          note: response.status === 500 
            ? 'This is a Flask backend error. Check Flask server logs for details.'
            : undefined
        },
        { status: statusCode }
      );
    }

    const data = await response.json();
    console.log(`[API] Successfully fetched sector/subsector coverage data`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error fetching sector/subsector coverage:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's an abort/timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          error: 'Request timeout - Flask backend did not respond within 10 seconds',
          details: 'The Flask server may be overloaded or unresponsive',
          backend_url: `${FLASK_BASE}/api/admin/coverage/sector-subsector`,
        },
        { status: 504 }
      );
    }
    
    // Provide more specific error messages
    let userMessage = 'Failed to connect to backend server';
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      userMessage = 'Cannot connect to Flask backend server. Is it running on port 5000?';
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      userMessage = 'Cannot resolve backend server hostname';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Backend server connection timeout';
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        details: errorMessage,
        backend_url: `${FLASK_BASE}/api/admin/coverage/sector-subsector`,
        troubleshooting: {
          check_flask_running: 'Verify Flask server is running: Check http://localhost:5000/api/system/status',
          check_port: 'Ensure Flask is running on port 5000 (or update FLASK_URL in .env.local)',
          check_firewall: 'Check if firewall is blocking connections',
        }
      },
      { status: 503 }
    );
  }
}

