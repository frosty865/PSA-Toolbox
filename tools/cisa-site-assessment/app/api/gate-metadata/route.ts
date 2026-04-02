import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/gate-metadata
 * 
 * Returns the baseline migration table for client-side gate metadata lookup.
 */
export async function GET() {
  try {
    const migrationPath = path.join(process.cwd(), 'analytics', 'reports', 'baseline_migration_table.json');
    
    if (!fs.existsSync(migrationPath)) {
      return NextResponse.json(
        { error: 'Migration table not found' },
        { status: 404 }
      );
    }

    const migrationData = JSON.parse(fs.readFileSync(migrationPath, 'utf-8'));
    
    return NextResponse.json(migrationData, { status: 200 });
  } catch (error: unknown) {
    console.error('[API /api/gate-metadata GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch gate metadata',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


