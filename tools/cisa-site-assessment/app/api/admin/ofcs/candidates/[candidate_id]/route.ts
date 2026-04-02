import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { assertTableOnOwnerPool, assertTablesOnOwnerPools } from '@/app/lib/db/pool_guard';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

type DbErrorLike = { code?: string; message?: string; constraint?: string; detail?: unknown; column?: string };

/**
 * Maps database errors to HTTP status codes and error details
 */
function mapDbErrorToHttp(err: unknown): { status: number; code: string; message: string; details?: unknown } {
  const e = err && typeof err === "object" ? (err as DbErrorLike) : {};
  const code = e.code;
  const message = e.message ?? "Database error";

  if (code === "23505") {
    return {
      status: 409,
      code: "CONFLICT",
      message: "Unique constraint violation",
      details: { constraint: e.constraint, detail: e.detail },
    };
  }
  if (code === "23503") {
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Foreign key constraint violation",
      details: { constraint: e.constraint, detail: e.detail },
    };
  }
  if (code === "23502") {
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Required field is null",
      details: { column: e.column, detail: e.detail },
    };
  }
  if (code === "23514") {
    let msg = "Check constraint violation";
    if (e.constraint === "ofc_candidate_queue_approved_status_consistency") {
      msg = "Status and approved fields must be consistent: PROMOTED requires approved=true, other statuses require approved=false";
    }
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: msg,
      details: { constraint: e.constraint, detail: e.detail },
    };
  }
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Database error",
    details: { code, message },
  };
}

/**
 * PATCH /api/admin/ofcs/candidates/[candidate_id]
 * 
 * Update a CORPUS candidate from ofc_candidate_queue.
 * 
 * Body:
 * - status?: 'PENDING' | 'REVIEWED' | 'PROMOTED' | 'REJECTED'
 * - snippet_text?: string (for editing)
 * - reviewed_by?: string
 * 
 * Note: This route only handles CORPUS candidates. MODULE candidates must use
 * the module-specific promotion route.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidate_id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  try {
    // Hard guard: Assert CORPUS-owned tables are on correct pool
    await assertTablesOnOwnerPools([
      "public.ofc_candidate_queue",
      "public.ofc_candidate_targets",
      "public.ofc_library_citations"
    ]);
    
    const { candidate_id } = await params;
    
    // Safe body parsing - never throw
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} body parse failed, using empty object`);
    }
    
    console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} body=`, JSON.stringify(body));
    
    const pool = getCorpusPool();
    
    // 1. Load candidate and verify it exists and is CORPUS origin
    const candidateCheck = await pool.query(
      `SELECT candidate_id, ofc_origin, status, approved FROM public.ofc_candidate_queue WHERE candidate_id = $1`,
      [candidate_id]
    );
    
    if (candidateCheck.rows.length === 0) {
      console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} candidate not found`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'NOT_FOUND',
          message: 'Candidate not found'
        }
      }, { status: 404 });
    }
    
    const candidate = candidateCheck.rows[0];
    console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} candidate loaded: origin=${candidate.ofc_origin}, status=${candidate.status}`);
    
    // 2. Enforce module/corpus segregation
    if (candidate.ofc_origin === 'MODULE') {
      console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} BLOCKED: module candidate attempted via corpus route`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Module candidates must be promoted via the module promotion route',
          details: { candidate_id, ofc_origin: candidate.ofc_origin }
        }
      }, { status: 422 });
    }
    
    // 3. Validate status transitions (if status is being updated)
    const requestedStatus = typeof body.status === 'string' ? body.status : undefined;
    if (requestedStatus !== undefined) {
      if (!['PENDING', 'REVIEWED', 'PROMOTED', 'REJECTED'].includes(requestedStatus)) {
        console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} invalid status: ${body.status}`);
        return NextResponse.json({
          ok: false,
          requestId,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid status. Must be PENDING, REVIEWED, PROMOTED, or REJECTED',
            details: { provided: body.status }
          }
        }, { status: 422 });
      }
      
      // Check if already in target state (idempotency)
      if (requestedStatus === candidate.status && requestedStatus === 'PROMOTED') {
        console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} already promoted`);
        return NextResponse.json({
          ok: false,
          requestId,
          error: {
            code: 'CONFLICT',
            message: 'Candidate is already promoted',
            details: { current_status: candidate.status }
          }
        }, { status: 409 });
      }
    }
    
    // 4. Build update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (requestedStatus !== undefined) {
      updates.push(`status = $${paramIndex}`);
      values.push(requestedStatus);
      paramIndex++;
      
      // If status is REVIEWED or PROMOTED, set reviewed_at
      if (requestedStatus === 'REVIEWED' || requestedStatus === 'PROMOTED') {
        updates.push(`reviewed_at = NOW()`);
      }
      
      // If status is PROMOTED, must also set approved=true (check constraint requirement)
      if (requestedStatus === 'PROMOTED') {
        updates.push(`approved = true`);
      }
      
      // If status is REJECTED, set approved=false (check constraint requirement)
      if (requestedStatus === 'REJECTED') {
        updates.push(`approved = false`);
      }
    }
    
    if (body.snippet_text !== undefined) {
      if (typeof body.snippet_text !== 'string' || body.snippet_text.trim().length === 0) {
        console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} invalid snippet_text`);
        return NextResponse.json({
          ok: false,
          requestId,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'snippet_text must be a non-empty string',
            details: { provided_type: typeof body.snippet_text }
          }
        }, { status: 422 });
      }
      updates.push(`snippet_text = $${paramIndex}`);
      values.push(body.snippet_text.trim());
      paramIndex++;
    }
    
    if (body.reviewed_by !== undefined) {
      updates.push(`reviewed_by = $${paramIndex}`);
      values.push(body.reviewed_by);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} no updates provided`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No updates provided'
        }
      }, { status: 422 });
    }
    
    values.push(candidate_id);
    
    // 5. Execute update with CORPUS origin guard
    const query = `
      UPDATE public.ofc_candidate_queue
      SET ${updates.join(', ')}
      WHERE candidate_id = $${paramIndex} AND ofc_origin = 'CORPUS'
      RETURNING candidate_id, snippet_text, status, reviewed_at, reviewed_by, created_at, ofc_origin, approved
    `;
    
    console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} executing update`);
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      // This shouldn't happen if we checked above, but handle it defensively
      console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} update returned no rows (possible race condition or origin mismatch)`);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: 'NOT_FOUND',
          message: 'Candidate not found or not a CORPUS candidate'
        }
      }, { status: 404 });
    }
    
    const updatedCandidate = result.rows[0];
    const duration = Date.now() - startTime;
    console.log(`[PATCH /api/admin/ofcs/candidates/${candidate_id}] requestId=${requestId} success in ${duration}ms`);
    
    return NextResponse.json({
      ok: true,
      requestId,
      result: updatedCandidate
    }, { status: 200 });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const err = error && typeof error === "object" ? error as { name?: string; message?: string; code?: string; stack?: string } : {};
    console.error(`[PATCH /api/admin/ofcs/candidates] requestId=${requestId} error after ${duration}ms:`, {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
    });

    if (typeof err.code === "string" && err.code.startsWith("23")) {
      const mapped = mapDbErrorToHttp(error);
      return NextResponse.json({
        ok: false,
        requestId,
        error: {
          code: mapped.code,
          message: mapped.message,
          details: mapped.details
        }
      }, { status: mapped.status });
    }
    
    // Unexpected error
    return NextResponse.json({
      ok: false,
      requestId,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error'
      }
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/ofcs/candidates/[candidate_id]
 * 
 * Get a single mined candidate by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidate_id: string }> }
) {
  try {
    // Hard guard: Assert CORPUS-owned tables are on correct pool
    await assertTableOnOwnerPool("public.ofc_candidate_queue");
    
    const { candidate_id } = await params;
    const pool = getCorpusPool();
    
    const result = await pool.query(`
      SELECT 
        ocq.candidate_id,
        ocq.snippet_text,
        ocq.status,
        ocq.reviewed_at,
        ocq.reviewed_by,
        ocq.created_at,
        ocq.document_chunk_id,
        ocq.excerpt,
        ocq.page_locator,
        cs.title as source_title,
        cs.citation_text,
        cs.source_type
      FROM public.ofc_candidate_queue ocq
      LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.candidate_id = $1
    `, [candidate_id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      candidate: result.rows[0]
    }, { status: 200 });
    
  } catch (error) {
    console.error('[API /api/admin/ofcs/candidates/[candidate_id] GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch candidate',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
