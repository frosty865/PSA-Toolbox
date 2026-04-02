import { NextRequest, NextResponse } from 'next/server';

const FLASK_BASE = process.env.NEXT_PUBLIC_FLASK_BASE || 'http://localhost:5000';

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

    const url = `${FLASK_BASE}/api/v2/assessments/${encodeURIComponent(assessmentId)}/ofcs`;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { assessment_id: assessmentId, ofcs: [] },
          { status: 200 }
        );
      }
      
      const errorText = await response.text().catch(() => 'Unknown error');
      return NextResponse.json(
        { 
          error: `Backend returned ${response.status}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Safety filter: Remove OFCs from deprecated required elements
    // This is a defensive measure in case the backend hasn't been updated yet
    if (data.ofcs && Array.isArray(data.ofcs)) {
      // Filter out OFCs that reference deprecated elements
      // Note: This requires element information, which may not be in the OFC response
      // The primary filtering should happen in the backend OFC generation logic
      const filteredOfcs = data.ofcs.filter((ofc: any) => {
        // Check if OFC references a deprecated element code
        const legacyDeprecatedCodes = ['BASE-061', 'BASE-062', 'BASE-063', 'BASE-064', 'BASE-065', 'BASE-066', 'BASE-070', 'BASE-071'];
        if (ofc.required_element_code && legacyDeprecatedCodes.includes(ofc.required_element_code)) {
          console.log(`[OFC API] Filtering out OFC from deprecated element: ${ofc.required_element_code}`);
          return false;
        }
        return true;
      });
      
      return NextResponse.json({
        ...data,
        ofcs: filteredOfcs
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching OFCs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch OFCs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

