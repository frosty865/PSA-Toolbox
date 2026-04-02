import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/module-ofcs/update/[id]
 * 
 * Update a MODULE OFC in ofc_candidate_queue.
 * 
 * Body:
 * - ofc_text?: string
 * - title?: string
 * - discipline_subtype_id?: UUID
 * - discipline_id?: UUID (inferred from subtype if not provided)
 * - status?: 'PENDING' | 'REVIEWED' | 'PROMOTED' | 'REJECTED'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const pool = getCorpusPool();
    
    // Verify OFC exists and is MODULE origin
    const checkResult = await pool.query(`
      SELECT candidate_id, ofc_origin 
      FROM public.ofc_candidate_queue 
      WHERE candidate_id = $1
    `, [id]);
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'MODULE OFC not found' },
        { status: 404 }
      );
    }
    
    if (checkResult.rows[0].ofc_origin !== 'MODULE') {
      return NextResponse.json(
        { error: 'This endpoint is only for MODULE OFCs' },
        { status: 400 }
      );
    }
    
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (body.ofc_text !== undefined) {
      if (typeof body.ofc_text !== 'string' || body.ofc_text.trim().length === 0) {
        return NextResponse.json(
          { error: 'ofc_text must be a non-empty string' },
          { status: 400 }
        );
      }
      updates.push(`snippet_text = $${paramIndex}`);
      values.push(body.ofc_text.trim());
      paramIndex++;
    }
    
    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      values.push(body.title?.trim() || null);
      paramIndex++;
    }
    
    if (body.discipline_subtype_id !== undefined) {
      updates.push(`discipline_subtype_id = $${paramIndex}`);
      values.push(body.discipline_subtype_id);
      paramIndex++;
      
      // If discipline_id not provided, infer from subtype
      let disciplineId = body.discipline_id;
      if (!disciplineId) {
        const subtypeResult = await pool.query(`
          SELECT discipline_id 
          FROM public.discipline_subtypes 
          WHERE id = $1
        `, [body.discipline_subtype_id]);
        
        if (subtypeResult.rows.length === 0) {
          return NextResponse.json(
            { error: 'Invalid discipline_subtype_id' },
            { status: 400 }
          );
        }
        
        disciplineId = subtypeResult.rows[0].discipline_id;
      }
      
      updates.push(`discipline_id = $${paramIndex}`);
      values.push(disciplineId);
      paramIndex++;
    }
    
    if (body.status !== undefined) {
      if (!['PENDING', 'REVIEWED', 'PROMOTED', 'REJECTED'].includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }
      updates.push(`status = $${paramIndex}`);
      values.push(body.status);
      paramIndex++;
      
      if (body.status === 'REVIEWED' || body.status === 'PROMOTED') {
        updates.push(`reviewed_at = NOW()`);
      }
    }
    
    if (body.ofc_class !== undefined) {
      if (!['FOUNDATIONAL', 'OPERATIONAL', 'PHYSICAL'].includes(body.ofc_class)) {
        return NextResponse.json(
          { error: 'ofc_class must be FOUNDATIONAL, OPERATIONAL, or PHYSICAL' },
          { status: 400 }
        );
      }
      updates.push(`ofc_class = $${paramIndex}`);
      values.push(body.ofc_class);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }
    
    values.push(id);
    
    const result = await pool.query(`
      UPDATE public.ofc_candidate_queue
      SET ${updates.join(', ')}
      WHERE candidate_id = $${paramIndex} AND ofc_origin = 'MODULE'
      RETURNING 
        candidate_id::text as id,
        snippet_text as ofc_text,
        title,
        status,
        discipline_subtype_id,
        discipline_id,
        ofc_class,
        reviewed_at,
        updated_at
    `, values);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update MODULE OFC' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      ofc: result.rows[0]
    }, { status: 200 });
    
  } catch (error) {
    console.error('[API /api/admin/module-ofcs/update/[id] PATCH] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update MODULE OFC',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
