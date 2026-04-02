import { NextRequest, NextResponse } from 'next/server';
import { getAssessments } from '@/app/lib/psaDataProvider';

export async function GET(request: NextRequest) {
  try {
    const assessments = await getAssessments();
    // Always return an array, even if empty
    return NextResponse.json(Array.isArray(assessments) ? assessments : []);
  } catch (error) {
    console.error('Error fetching assessments list:', error);
    // Return empty array instead of error to prevent 500
    // This allows the UI to load even if backend is unavailable
    return NextResponse.json([]);
  }
}

