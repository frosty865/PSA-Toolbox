import { NextResponse } from 'next/server';
import { getPool } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();

    const query = `
      SELECT 
        id,
        sector_name,
        name,
        description,
        is_active,
        created_at,
        updated_at
      FROM sectors
      ORDER BY sector_name, name
    `;

    const result = await pool.query(query);

    // Normalize sectors
    const normalizedSectors = (result.rows || []).map(s => {
      const sectorName = s.sector_name || s.name || `Sector ${s.id}`;
      
      return {
        ...s,
        sector_name: sectorName,
        id: s.id
      };
    });

    console.log(`[API /api/reference/sectors] Fetched ${normalizedSectors.length} sectors`);
    
    return NextResponse.json({ sectors: normalizedSectors });
  } catch (error) {
    console.error('[API /api/reference/sectors] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Database service unavailable',
        message: error instanceof Error ? error.message : 'Failed to fetch sectors',
        sectors: [] 
      },
      { status: 503 }
    );
  }
}

