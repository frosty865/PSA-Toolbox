import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/technology-types-catalog
 * 
 * Returns the technology types catalog for discipline/subtype-scoped tech type selection.
 */
export async function GET() {
  try {
    const catalogPath = join(process.cwd(), 'analytics', 'runtime', 'technology_types_catalog.json');
    const catalogContent = await readFile(catalogPath, 'utf-8');
    const catalog = JSON.parse(catalogContent);

    return NextResponse.json(catalog, { status: 200 });
  } catch (error: unknown) {
    console.error('[API /api/runtime/technology-types-catalog GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load technology types catalog',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


