import { NextResponse } from 'next/server';
import { getPool } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');

    const pool = getPool();

    // Fetch disciplines separately (matching PSATool's fallback approach)
    let disciplinesQuery = `
      SELECT 
        id,
        name,
        code,
        description,
        category,
        is_active,
        created_at,
        updated_at
      FROM disciplines
      WHERE 1=1
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (active !== null) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(active === 'true');
      paramIndex++;
    }

    if (conditions.length > 0) {
      disciplinesQuery += ` AND ${conditions.join(' AND ')}`;
    }

    disciplinesQuery += ` ORDER BY category, name`;

    const disciplinesResult = await pool.query(disciplinesQuery, params);
    const disciplinesData = disciplinesResult.rows || [];

    // Fetch subtypes separately and attach to disciplines (matching PSATool approach)
    const subtypesQuery = `
      SELECT 
        id,
        name,
        code,
        description,
        discipline_id,
        is_active,
        created_at,
        updated_at
      FROM discipline_subtypes
      WHERE is_active = true
      ORDER BY name
    `;

    const subtypesResult = await pool.query(subtypesQuery);
    const subtypesData = subtypesResult.rows || [];

    // Group subtypes by discipline_id (matching PSATool's grouping logic exactly)
    // Convert IDs to strings to ensure proper matching (UUIDs might be returned as different types)
    const subtypesByDiscipline: Record<string, any[]> = {};
    subtypesData.forEach((subtype: any) => {
      const discId = String(subtype.discipline_id || ''); // Ensure string conversion
      if (!discId) {
        console.warn(`[API /api/reference/disciplines] Subtype ${subtype.id} has no discipline_id`);
        return;
      }
      if (!subtypesByDiscipline[discId]) {
        subtypesByDiscipline[discId] = [];
      }
      // Include all subtype fields (matching PSATool: "Include all subtype fields including extended information")
      subtypesByDiscipline[discId].push(subtype);
    });
    
    // Debug: Log grouping results
    console.log(`[API /api/reference/disciplines] Grouped subtypes by discipline_id:`, {
      totalSubtypes: subtypesData.length,
      disciplinesWithSubtypes: Object.keys(subtypesByDiscipline).length,
      sampleKeys: Object.keys(subtypesByDiscipline).slice(0, 3)
    });

    // Deduplicate disciplines by ID and name (matching PSATool's deduplication logic)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueDisciplines = disciplinesData.filter((discipline: any) => {
      // Deduplicate by ID
      if (discipline.id && seenIds.has(discipline.id)) {
        console.warn(`Duplicate discipline ID found: ${discipline.name} (ID: ${discipline.id})`);
        return false;
      }
      if (discipline.id) {
        seenIds.add(discipline.id);
      }

      // Also deduplicate by name (case-insensitive)
      const name = (discipline.name || '').trim().toLowerCase();
      if (name && seenNames.has(name)) {
        console.warn(`Duplicate discipline name found: ${discipline.name} (ID: ${discipline.id})`);
        return false;
      }
      if (name) {
        seenNames.add(name);
      }

      return true;
    });

    // Attach subtypes to each discipline (matching PSATool's mapping exactly: "Attach subtypes to each discipline")
    // Convert discipline.id to string for matching
    const normalizedDisciplines = uniqueDisciplines.map((discipline: any) => {
      const discId = String(discipline.id || ''); // Ensure string conversion for matching
      const subtypes = subtypesByDiscipline[discId] || [];
      
      // Debug: Log if discipline has subtypes
      if (subtypes.length > 0) {
        console.log(`[API /api/reference/disciplines] Discipline "${discipline.name}" (ID: ${discId}) has ${subtypes.length} subtypes:`, 
          subtypes.map((st: any) => ({ id: st.id, name: st.name, discipline_id: st.discipline_id }))
        );
      } else {
        // Also log when no subtypes found to help debug
        console.log(`[API /api/reference/disciplines] Discipline "${discipline.name}" (ID: ${discId}) has NO subtypes. Available keys:`, Object.keys(subtypesByDiscipline).slice(0, 5));
      }
      
      return {
        ...discipline,
        discipline_subtypes: subtypes // Ensure this is always an array
      };
    });
    
    // Log total subtypes found
    const totalSubtypes = normalizedDisciplines.reduce((sum: number, d: any) => sum + (d.discipline_subtypes?.length || 0), 0);
    console.log(`[API /api/reference/disciplines] Fetched ${normalizedDisciplines.length} disciplines with ${totalSubtypes} total subtypes`);

    return NextResponse.json({
      success: true,
      disciplines: normalizedDisciplines
    });
  } catch (error) {
    console.error('[API /api/reference/disciplines] Error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Database service unavailable',
        message: error instanceof Error ? error.message : 'Failed to fetch disciplines',
        disciplines: [] 
      },
      { status: 503 }
    );
  }
}

