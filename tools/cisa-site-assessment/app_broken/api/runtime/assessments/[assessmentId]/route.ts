import { NextRequest, NextResponse } from 'next/server';
import { getAssessment, saveResponse } from '@/app/lib/psaDataProvider';

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

    const data = await getAssessment(assessmentId);
    
    if (!data) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching assessment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch assessment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    if (!body.element_id || !body.response) {
      return NextResponse.json(
        { error: 'element_id and response are required' },
        { status: 400 }
      );
    }

    if (!['YES', 'NO', 'N/A'].includes(body.response)) {
      return NextResponse.json(
        { error: 'response must be YES, NO, or N/A' },
        { status: 400 }
      );
    }

    const result = await saveResponse(assessmentId, body.element_id, body.response);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error saving assessment response:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

