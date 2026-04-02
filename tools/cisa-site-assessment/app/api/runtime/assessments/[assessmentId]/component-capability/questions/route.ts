import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/assessments/[assessmentId]/component-capability/questions
 * 
 * Returns component capability questions for an assessment.
 * Loads from analytics/candidates/component_capability_questions.json
 * Returns empty array if file doesn't exist (non-blocking).
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

    // Path to component capability questions
    const questionsPath = join(
      process.cwd(),
      'analytics',
      'candidates',
      'component_capability_questions.json'
    );

    // If file doesn't exist, return empty array (non-blocking)
    if (!existsSync(questionsPath)) {
      return NextResponse.json({ questions: [] });
    }

    const content = await readFile(questionsPath, 'utf-8');
    const data = JSON.parse(content);

    // Validate structure
    if (!data || !Array.isArray(data.questions)) {
      return NextResponse.json({ questions: [] });
    }

    // Return questions only (exclude metadata)
    return NextResponse.json({ questions: data.questions });
  } catch (error: unknown) {
    console.log("Component capability questions not available:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ questions: [] });
  }
}
