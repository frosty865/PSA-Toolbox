import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/modules
 * 
 * Returns the current module index configuration.
 */
 
export async function GET(_request: NextRequest) {
  try {
    const moduleIndexPath = path.join(process.cwd(), 'psa_engine', 'question_sets', 'MODULE.index.json');
    
    if (!fs.existsSync(moduleIndexPath)) {
      return NextResponse.json(
        { error: 'MODULE.index.json not found' },
        { status: 404 }
      );
    }

    const moduleIndex = JSON.parse(fs.readFileSync(moduleIndexPath, 'utf-8'));
    return NextResponse.json(moduleIndex);

  } catch (error: unknown) {
    console.error('[API /api/admin/modules] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load modules',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/modules
 * 
 * Updates the module index configuration.
 * Body: { layer: "MODULE", questions_by_module: { ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate structure
    if (!body.layer || body.layer !== 'MODULE') {
      return NextResponse.json(
        { error: 'Invalid layer. Must be "MODULE"' },
        { status: 400 }
      );
    }

    if (!body.questions_by_module || typeof body.questions_by_module !== 'object') {
      return NextResponse.json(
        { error: 'questions_by_module is required and must be an object' },
        { status: 400 }
      );
    }

    // Validate module codes and question codes
    for (const [moduleCode, questionCodes] of Object.entries(body.questions_by_module)) {
      if (!Array.isArray(questionCodes)) {
        return NextResponse.json(
          { error: `Module ${moduleCode} must have an array of question codes` },
          { status: 400 }
        );
      }
      
      if (questionCodes.length === 0) {
        return NextResponse.json(
          { error: `Module ${moduleCode} must have at least one question code` },
          { status: 400 }
        );
      }

      // Validate module code format
      if (!moduleCode.startsWith('MODULE_')) {
        return NextResponse.json(
          { error: `Module code ${moduleCode} must start with "MODULE_"` },
          { status: 400 }
        );
      }
    }

    // Write to file
    const moduleIndexPath = path.join(process.cwd(), 'psa_engine', 'question_sets', 'MODULE.index.json');
    const moduleIndexDir = path.dirname(moduleIndexPath);
    
    // Ensure directory exists
    if (!fs.existsSync(moduleIndexDir)) {
      fs.mkdirSync(moduleIndexDir, { recursive: true });
    }

    // Write formatted JSON
    const formattedJson = JSON.stringify(body, null, 2) + '\n';
    fs.writeFileSync(moduleIndexPath, formattedJson, 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Module index updated successfully',
      modules: body
    });

  } catch (error: unknown) {
    console.error('[API /api/admin/modules] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update modules',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

