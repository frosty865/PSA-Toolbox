import { NextResponse } from 'next/server';
import { getPool } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subtypeId = searchParams.get('subtype_id');
    const disciplineId = searchParams.get('discipline_id');
    const active = searchParams.get('active');

    const pool = getPool();

    // Select ALL columns to include extended fields (matching PSATool's .select('*') behavior)
    // This includes: overview, indicators_of_risk, common_failures, assessment_questions,
    // mitigation_guidance, standards_references, psa_notes, examples, use_cases, 
    // best_practices, key_features, related_standards, implementation_notes, etc.
    let query = `
      SELECT *
      FROM discipline_subtypes
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (subtypeId) {
      query += ` AND id = $${paramIndex}`;
      params.push(subtypeId);
      paramIndex++;
    }

    if (disciplineId) {
      query += ` AND discipline_id = $${paramIndex}`;
      params.push(disciplineId);
      paramIndex++;
    }

    if (active !== null) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY name`;

    let result;
    try {
      result = await pool.query(query, params);
    } catch (error: any) {
      // If SELECT * fails due to missing columns, try with explicit basic columns
      if (error.message && error.message.includes('does not exist')) {
        console.warn('[API /api/reference/discipline-subtypes] SELECT * failed, falling back to basic columns:', error.message);
        // Fallback to basic columns only
        query = query.replace('SELECT *', `
          SELECT 
            id,
            name,
            code,
            description,
            discipline_id,
            is_active,
            created_at,
            updated_at
        `);
        result = await pool.query(query, params);
      } else {
        throw error;
      }
    }

    // Return all subtype fields (including extended fields if they exist)
    const subtypes = result.rows || [];

    // Log sample to verify extended fields are present
    if (subtypes.length > 0) {
      const sampleFields = Object.keys(subtypes[0] || {});
      console.log(`[API /api/reference/discipline-subtypes] Returning ${subtypes.length} subtypes with fields:`, sampleFields);
    }

    return NextResponse.json({
      success: true,
      subtypes: subtypes
    });
  } catch (error) {
    console.error('[API /api/reference/discipline-subtypes] Error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Database service unavailable',
        message: error instanceof Error ? error.message : 'Failed to fetch subtypes',
        subtypes: [] 
      },
      { status: 503 }
    );
  }
}

