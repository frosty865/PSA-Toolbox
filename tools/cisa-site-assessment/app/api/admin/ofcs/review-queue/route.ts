import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ofcs/review-queue
 * 
 * Returns OFC nominations with status IN ('SUBMITTED','UNDER_REVIEW').
 * Also includes mined candidates from ofc_candidate_queue (CORPUS) with status='PENDING'.
 * Sorted by submitted_at ASC (oldest first).
 * 
 * Note: This endpoint returns nominations from the ofc_nominations table (RUNTIME)
 * and candidates from ofc_candidate_queue (CORPUS).
 */
export async function GET(request: NextRequest) {
  try {
    const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const referenceUnresolvedFilter = searchParams.get('reference_unresolved');
    const submittedByFilter = searchParams.get('submitted_by');
    const disciplineFilter = searchParams.get('discipline_id');
    const subtypeFilter = searchParams.get('subtype_id');
    const originFilter = searchParams.get('origin'); // CORPUS | MODULE | ALL (admin only)

    let query = `
      SELECT 
        n.nomination_id::text as id,
        n.proposed_ofc_text as ofc_text,
        n.proposed_title as title,
        1 as version,
        n.status,
        n.status_reason,
        n.submitted_by,
        n.submitted_at,
        n.reference_unresolved,
        n.evidence_excerpt,
        d.name as discipline,
        d.id as discipline_id,
        ds.name as subtype,
        ds.id as subtype_id
      FROM public.ofc_nominations n
      LEFT JOIN public.disciplines d ON n.discipline_id = d.id
      LEFT JOIN public.discipline_subtypes ds ON n.discipline_subtype_id = ds.id
      WHERE 1=1
    `;

    const params: unknown[] = [];
    let paramIndex = 1;

    // Status filter
    if (statusFilter) {
      query += ` AND n.status = $${paramIndex}`;
      params.push(statusFilter);
      paramIndex++;
    } else {
      // Default: show SUBMITTED and UNDER_REVIEW
      query += ` AND n.status IN ('SUBMITTED', 'UNDER_REVIEW')`;
    }

    // Reference unresolved filter
    if (referenceUnresolvedFilter !== null) {
      query += ` AND n.reference_unresolved = $${paramIndex}`;
      params.push(referenceUnresolvedFilter === 'true');
      paramIndex++;
    }

    // Submitted by filter
    if (submittedByFilter) {
      query += ` AND n.submitted_by = $${paramIndex}`;
      params.push(submittedByFilter);
      paramIndex++;
    }

    // Discipline filter
    if (disciplineFilter) {
      query += ` AND n.discipline_id = $${paramIndex}`;
      params.push(disciplineFilter);
      paramIndex++;
    }

    // Subtype filter
    if (subtypeFilter) {
      query += ` AND n.discipline_subtype_id = $${paramIndex}`;
      params.push(subtypeFilter);
      paramIndex++;
    }

    query += ` ORDER BY n.submitted_at DESC NULLS LAST`;

    const nominationsResult = await runtimePool.query(query, params);

    // Also fetch mined candidates from CORPUS database (ofc_candidate_queue)
    // Default: only CORPUS origin (MODULE OFCs managed separately)
    let candidatesResult: { rows: Record<string, unknown>[] } = { rows: [] };
    try {
      let candidatesWhere = "ocq.status = 'PENDING'";
      const candidatesParams: unknown[] = [];
      let candidatesParamIndex = 1;
      
      // Filter by origin: default CORPUS, allow MODULE or ALL via query param (admin only)
      if (originFilter === 'MODULE') {
        candidatesWhere += ` AND ocq.ofc_origin = 'MODULE'`;
      } else if (originFilter === 'ALL') {
        // Show all origins (admin debug mode)
        // No additional filter
      } else {
        // Default: CORPUS only
        candidatesWhere += ` AND ocq.ofc_origin = 'CORPUS'`;
      }
      
      // Apply status filter to candidates if it matches PENDING, PROMOTED, or REJECTED
      if (statusFilter === 'PENDING' || statusFilter === 'PROMOTED' || statusFilter === 'REJECTED' || statusFilter === 'REVIEWED') {
        candidatesWhere = `ocq.status = $${candidatesParamIndex}`;
        candidatesParams.push(statusFilter);
        candidatesParamIndex++;
      } else if (!statusFilter) {
        // Default: show PENDING candidates when no filter
        candidatesWhere = "ocq.status = 'PENDING'";
      } else {
        // If filter is for nominations-only status, don't fetch candidates
        candidatesWhere = "1=0";
      }
      
      // Apply submitted_by filter if provided (but only if column exists - check dynamically)
      // For now, we'll infer source from source_id: IST source_id = IST_IMPORT, others = MINED
      if (submittedByFilter) {
        // If filtering by IST_IMPORT, filter by IST source_id
        if (submittedByFilter === 'IST_IMPORT') {
          // Get IST source_id
          const istSourceResult = await corpusPool.query(`
            SELECT source_id FROM public.canonical_sources
            WHERE title ILIKE '%IST%VOFC%' OR citation_text ILIKE '%IST%VOFC%'
            LIMIT 1
          `);
          if (istSourceResult.rows.length > 0) {
            candidatesWhere += ` AND ocq.source_id = $${candidatesParamIndex}`;
            candidatesParams.push(istSourceResult.rows[0].source_id);
            candidatesParamIndex++;
          } else {
            candidatesWhere = "1=0"; // No IST source found
          }
        } else if (submittedByFilter === 'MINED') {
          // For MINED, exclude IST source_id
          const istSourceResult = await corpusPool.query(`
            SELECT source_id FROM public.canonical_sources
            WHERE title ILIKE '%IST%VOFC%' OR citation_text ILIKE '%IST%VOFC%'
            LIMIT 1
          `);
          if (istSourceResult.rows.length > 0) {
            candidatesWhere += ` AND (ocq.source_id IS NULL OR ocq.source_id != $${candidatesParamIndex})`;
            candidatesParams.push(istSourceResult.rows[0].source_id);
            candidatesParamIndex++;
          }
        }
      }
      
      const candidatesQuery = `
        SELECT 
          ocq.candidate_id::text as id,
          ocq.snippet_text as ofc_text,
          ocq.title,
          1 as version,
          ocq.status,
          NULL as status_reason,
          ocq.ofc_origin,
          CASE 
            WHEN cs.title ILIKE '%IST%VOFC%' OR cs.citation_text ILIKE '%IST%VOFC%' THEN 'IST_IMPORT'
            ELSE 'MINED'
          END as submitted_by,
          ocq.created_at as submitted_at,
          false as reference_unresolved,
          ocq.excerpt as evidence_excerpt,
          NULL as discipline,
          NULL as discipline_id,
          NULL as subtype,
          NULL as subtype_id,
          ocq.document_chunk_id,
          ocq.source_id,
          cs.title as source_title,
          cs.citation_text,
          cs.publisher as source_publisher,
          cs.published_date as source_published_date,
          cs.source_type,
          cs.uri as source_uri,
          dc.document_id,
          d.title as document_title,
          dc.locator_type,
          dc.locator,
          dc.page_number
        FROM public.ofc_candidate_queue ocq
        LEFT JOIN public.document_chunks dc ON ocq.document_chunk_id = dc.chunk_id
        LEFT JOIN public.documents d ON dc.document_id = d.document_id
        LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
        WHERE ${candidatesWhere}
        ORDER BY ocq.created_at DESC
        LIMIT 500
      `;
      candidatesResult = await corpusPool.query(candidatesQuery, candidatesParams);
    } catch (corpusError) {
      console.warn('[API /api/admin/ofcs/review-queue] Could not fetch candidates from CORPUS:', corpusError);
      // Continue without candidates if CORPUS DB is unavailable
    }

    // Transform nominations to match expected format
    const nominations = nominationsResult.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      ofc_text: row.ofc_text || '',
      title: row.title || null,
      version: 1, // Nominations don't have versions
      status: row.status || 'SUBMITTED',
      status_reason: row.status_reason || null,
      submitted_by: row.submitted_by || null,
      submitted_at: asString(row.submitted_at) ? new Date(asString(row.submitted_at) as string).toISOString() : null,
      reference_unresolved: row.reference_unresolved || false,
      evidence_excerpt: row.evidence_excerpt || null,
      discipline: row.discipline || null,
      discipline_id: row.discipline_id || null,
      subtype: row.subtype || null,
      subtype_id: row.subtype_id || null,
      supersedes_ofc_id: null, // Nominations don't supersede
      supersedes_version: null, // Nominations don't supersede
      ofc_id: row.ofc_id || null, // May be linked to library OFC
      link_type: row.link_type || null,
      link_key: row.link_key || null,
      scope: row.scope || null,
      ofc_text_snapshot: row.ofc_text_snapshot || row.ofc_text || null,
      source: 'nomination' as const
    }));

    // Transform candidates to match expected format
    const candidates = candidatesResult.rows.map((row: Record<string, unknown>) => ({
      id: `candidate_${row.id}`, // Prefix to distinguish from nominations
      ofc_text: row.ofc_text || '',
      title: row.title || null,
      version: 1,
      status: row.status || 'PENDING',
      status_reason: null,
      ofc_origin: row.ofc_origin || 'CORPUS', // Explicit origin field
      submitted_by: row.submitted_by || 'MINED',
      submitted_at: asString(row.submitted_at) ? new Date(asString(row.submitted_at) as string).toISOString() : null,
      reference_unresolved: false,
      evidence_excerpt: row.evidence_excerpt || null,
      discipline: null,
      discipline_id: null,
      subtype: null,
      subtype_id: null,
      supersedes_ofc_id: null,
      supersedes_version: null,
      ofc_id: null,
      link_type: null,
      link_key: null,
      scope: null,
      ofc_text_snapshot: row.ofc_text || null,
      source: 'mined' as const,
      candidate_id: row.id, // Keep original candidate_id for reference
      // Citation information
      document_chunk_id: row.document_chunk_id || null,
      source_id: row.source_id || null,
      citation:
        (typeof row.citation_text === 'string' && row.citation_text.trim()) ||
        (typeof row.source_title === 'string' && row.source_title.trim()) ||
        null,
      source_title: row.source_title || null,
      source_publisher: row.source_publisher || null,
      source_published_date: row.source_published_date || null,
      source_type: row.source_type || null,
      source_uri: row.source_uri || null,
      document_title: row.document_title || null,
      locator_type: row.locator_type || null,
      locator: row.locator || null,
      page_number: row.page_number || null
    }));

    // Combine nominations and candidates, sort by submitted_at
    const allOfcs = [...nominations, ...candidates].sort((a, b) => {
      const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bTime - aTime; // Newest first
    });

    return NextResponse.json({
      success: true,
      ofcs: allOfcs
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/admin/ofcs/review-queue] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error details for debugging
    console.error('[API /api/admin/ofcs/review-queue] Full error:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch review queue',
        message: errorMessage
      },
      { status: 500 }
    );
  }
}


