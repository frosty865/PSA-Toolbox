import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/component-capability/responses
 * 
 * Returns component capability responses for an assessment.
 * Responses are stored separately from baseline responses.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    
    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    // For now, return empty array (component capability responses not yet persisted to DB)
    // In future, query from component_capability_responses table
    return NextResponse.json({ responses: [] });
  } catch (error: unknown) {
    console.error("Error fetching component capability responses:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch component capability responses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/runtime/assessments/[assessmentId]/component-capability/responses
 * 
 * Saves a component capability response.
 * Responses are stored separately from baseline responses and do not affect scoring.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> }
) {
  try {
    const { assessmentId } = await params;
    
    if (!assessmentId) {
      return NextResponse.json(
        { error: 'assessmentId parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    if (!body.component_code || !body.response) {
      return NextResponse.json(
        { error: 'component_code and response are required' },
        { status: 400 }
      );
    }

    if (!['YES', 'NO', 'N/A'].includes(body.response)) {
      return NextResponse.json(
        { error: 'response must be YES, NO, or N/A' },
        { status: 400 }
      );
    }

    // For now, return success (component capability responses not yet persisted to DB)
    // In future, save to component_capability_responses table
    return NextResponse.json({
      status: 'saved',
      component_code: body.component_code,
      response: body.response,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error("Error saving component capability response:", error);
    return NextResponse.json(
      {
        error: "Failed to save component capability response",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
