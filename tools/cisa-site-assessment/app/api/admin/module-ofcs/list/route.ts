import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { ensureRuntimePoolConnected } from '@/app/lib/db/runtime_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/module-ofcs/list
 * 
 * Returns MODULE OFCs from ofc_candidate_queue (where ofc_origin = 'MODULE').
 * 
 * Query params:
 * - status: 'PENDING' | 'REVIEWED' | 'PROMOTED' | 'REJECTED'
 * - discipline_id: UUID (filter by discipline)
 * - subtype_id: UUID (filter by subtype)
 * - search: string (search in snippet_text)
 */
export async function GET(request: NextRequest) {
  try {
    const corpusPool = getCorpusPool();
    const runtimePool = await ensureRuntimePoolConnected();
    
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const disciplineFilter = searchParams.get('discipline_id');
    const subtypeFilter = searchParams.get('subtype_id');
    const searchFilter = searchParams.get('search');
    
    // Check if optional columns exist (discipline_id, discipline_subtype_id may be nullable)
    // ofc_origin is now REQUIRED (NOT NULL + CHECK) - no need to check
    const columnCheck = await corpusPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'ofc_candidate_queue'
        AND column_name IN ('discipline_id', 'discipline_subtype_id')
    `);
    
    const hasDisciplineId = columnCheck.rows.some((r: Record<string, unknown>) => r.column_name === 'discipline_id');
    const hasSubtypeId = columnCheck.rows.some((r: Record<string, unknown>) => r.column_name === 'discipline_subtype_id');
    
    // Build SELECT fields - ofc_origin is guaranteed to exist (NOT NULL + CHECK)
    const selectFields = [
      'ocq.candidate_id::text as id',
      'ocq.snippet_text as ofc_text',
      'ocq.title',
      'ocq.status',
      'ocq.created_at',
      'ocq.reviewed_at',
      'ocq.reviewed_by',
    ];
    
    if (hasDisciplineId) {
      selectFields.push('ocq.discipline_id');
    }
    if (hasSubtypeId) {
      selectFields.push('ocq.discipline_subtype_id');
    }
    
    // HARD FILTER: ofc_origin='MODULE' is REQUIRED (enforced by NOT NULL + CHECK constraint)
    let query = `
      SELECT ${selectFields.join(', ')}
      FROM public.ofc_candidate_queue ocq
      WHERE ocq.ofc_origin = 'MODULE'
    `;
    
    const params: unknown[] = [];
    let paramIndex = 1;
    
    // Status filter
    if (statusFilter) {
      query += ` AND ocq.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    }
    
    // Discipline filter (only if column exists)
    if (disciplineFilter && hasDisciplineId) {
      query += ` AND ocq.discipline_id = $${paramIndex}`;
      params.push(disciplineFilter);
      paramIndex++;
    }
    
    // Subtype filter (only if column exists)
    if (subtypeFilter && hasSubtypeId) {
      query += ` AND ocq.discipline_subtype_id = $${paramIndex}`;
      params.push(subtypeFilter);
      paramIndex++;
    }
    
    // Search filter
    if (searchFilter) {
      query += ` AND ocq.snippet_text ILIKE $${paramIndex}`;
      params.push(`%${searchFilter}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY ocq.created_at DESC LIMIT 500`;
    
    const result = await corpusPool.query(query, params);
    
    // Fetch disciplines and subtypes from RUNTIME database
    const disciplinesMap: Map<string, { id: string; name: string; code: string }> = new Map();
    const subtypesMap: Map<string, { id: string; name: string; code: string; discipline_id: string }> = new Map();
    
    try {
      const disciplinesResult = await runtimePool.query(`
        SELECT id, name, code 
        FROM public.disciplines
        WHERE is_active = true
      `);
      disciplinesResult.rows.forEach((row: Record<string, unknown>) => {
        disciplinesMap.set(String(row.id ?? ''), row as { id: string; name: string; code: string });
      });
      
      const subtypesResult = await runtimePool.query(`
        SELECT id, name, code, discipline_id
        FROM public.discipline_subtypes
        WHERE is_active = true
      `);
      subtypesResult.rows.forEach((row: Record<string, unknown>) => {
        subtypesMap.set(String(row.id ?? ''), row as { id: string; name: string; code: string; discipline_id: string });
      });
    } catch (runtimeError) {
      console.warn('[API /api/admin/module-ofcs/list] Failed to fetch disciplines/subtypes from RUNTIME:', runtimeError);
      // Continue without discipline/subtype data
    }
    
    // Join the data in application code
    interface OfcRow { id: string; ofc_text?: string; title?: string; status?: string; created_at?: string; reviewed_at?: string | null; reviewed_by?: string | null; discipline_id?: string; discipline_subtype_id?: string; discipline?: string; subtype?: string; discipline_name?: string; discipline_subtype_name?: string; subtype_id?: string }
    const ofcs = result.rows.map((row: Record<string, unknown>) => {
      const ofc: OfcRow = {
        id: String(row.id ?? ''),
        ofc_text: row.ofc_text != null ? String(row.ofc_text) : undefined,
        title: row.title != null ? String(row.title) : undefined,
        status: row.status != null ? String(row.status) : undefined,
        created_at: row.created_at != null ? String(row.created_at) : undefined,
        reviewed_at: row.reviewed_at != null ? String(row.reviewed_at) : null,
        reviewed_by: row.reviewed_by != null ? String(row.reviewed_by) : null,
      };
      
      // Add discipline info if available
      if (hasDisciplineId && row.discipline_id) {
        const discipline = disciplinesMap.get(String(row.discipline_id));
        if (discipline) {
          ofc.discipline_id = discipline.id;
          ofc.discipline = discipline.name;
        }
      }
      
      // Add subtype info if available
      if (hasSubtypeId && row.discipline_subtype_id) {
        const subtype = subtypesMap.get(String(row.discipline_subtype_id));
        if (subtype) {
          ofc.subtype_id = subtype.id;
          ofc.subtype = subtype.name;
          
          // Also set discipline_id from subtype if not already set
          if (!ofc.discipline_id && subtype.discipline_id) {
            const discipline = disciplinesMap.get(String(subtype.discipline_id));
            if (discipline) {
              ofc.discipline_id = discipline.id;
              ofc.discipline = discipline.name;
            }
          }
        }
      }
      
      return ofc;
    });
    
    return NextResponse.json({
      success: true,
      ofcs
    }, { status: 200 });
    
  } catch (error: unknown) {
    console.error('[API /api/admin/module-ofcs/list GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch MODULE OFCs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

