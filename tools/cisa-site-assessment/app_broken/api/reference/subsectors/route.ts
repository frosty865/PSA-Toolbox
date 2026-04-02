import { NextResponse } from 'next/server';
import { getPool } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');

    const pool = getPool();

    // If no sectorId provided, return all active subsectors
    if (!sectorId) {
      const query = `
        SELECT 
          id,
          name,
          sector_id,
          description,
          is_active
        FROM subsectors
        WHERE is_active = true
        ORDER BY name
      `;

      const result = await pool.query(query);

      // Filter out code-only subsectors (short alphanumeric names)
      const filteredData = (result.rows || []).filter(subsector => {
        const name = subsector.name?.trim() || '';
        if (name.length <= 3 && /^[a-z0-9]+$/i.test(name)) {
          return false;
        }
        return true;
      });

      return NextResponse.json({ subsectors: filteredData });
    }

    // Fetch subsectors by sector ID
    console.log(`[API /api/reference/subsectors] Querying for sectorId: ${sectorId}`);

    // Check if sectorId is a UUID
    const isUUID = sectorId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    let actualSectorId = sectorId;

    if (!isUUID) {
      // Try to find sector by name/id first
      const sectorQuery = `
        SELECT id
        FROM sectors
        WHERE id = $1 
           OR sector_name = $1 
           OR name = $1
           OR LOWER(sector_name) = LOWER($1)
           OR LOWER(name) = LOWER($1)
        LIMIT 1
      `;
      
      const sectorResult = await pool.query(sectorQuery, [sectorId]);
      
      if (sectorResult.rows.length === 0) {
        console.error(`[API /api/reference/subsectors] Could not find sector with name/id: ${sectorId}`);
        return NextResponse.json(
          { error: `Sector not found: ${sectorId}`, subsectors: [] },
          { status: 404 }
        );
      }
      
      actualSectorId = sectorResult.rows[0].id;
      console.log(`[API /api/reference/subsectors] Found sector ID: ${actualSectorId} for input: ${sectorId}`);
    }

    const query = `
      SELECT 
        id,
        name,
        sector_id,
        description,
        is_active
      FROM subsectors
      WHERE is_active = true
        AND sector_id = $1
      ORDER BY name
    `;

    const result = await pool.query(query, [actualSectorId]);

    // Filter out code-only subsectors
    const filteredData = (result.rows || []).filter(subsector => {
      const name = subsector.name?.trim() || '';
      if (name.length <= 3 && /^[a-z0-9]+$/i.test(name)) {
        console.log(`[API /api/reference/subsectors] Filtering out code-only subsector: "${name}"`);
        return false;
      }
      return true;
    });

    console.log(`[API /api/reference/subsectors] Fetched ${result.rows.length} subsectors, returning ${filteredData.length} after filtering for sectorId: ${sectorId}`);

    return NextResponse.json({ subsectors: filteredData });
  } catch (error) {
    console.error('[API /api/reference/subsectors] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Database service unavailable',
        message: error instanceof Error ? error.message : 'Failed to fetch subsectors',
        subsectors: [] 
      },
      { status: 500 }
    );
  }
}

