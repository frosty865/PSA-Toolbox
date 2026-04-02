import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getSectorTaxonomy } from '@/app/lib/taxonomy/get_sector_taxonomy';
import type { ScopeTag } from '@/app/lib/sourceRegistry/scope_tags';
import { filterScopeTagsToTaxonomy } from '@/app/lib/sourceRegistry/scope_tags';
import { splitMalformedScopeTagString } from '@/app/lib/sourceRegistry/scopeTags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/source-registry/[sourceKey]
 * Get a specific source by source_key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> }
) {
  try {
    const raw = (await params).sourceKey;
    const sourceKey = raw ? decodeURIComponent(String(raw)).trim() : undefined;

    if (!sourceKey) {
      return NextResponse.json(
        { error: 'sourceKey parameter is required' },
        { status: 400 }
      );
    }

    const pool = getCorpusPoolForAdmin();

    const result = await pool.query(
      `SELECT * FROM public.source_registry WHERE source_key = $1`,
      [sourceKey]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0] as Record<string, unknown>;
    // Resolve scope_tags to display names (sector only from taxonomy); fall back to legacy when no ScopeTag[]
    try {
      const { normalizeScopeTags, scopeTagsToDisplayNames, legacyScopeTagsToDisplayNames } = await import('@/app/lib/sourceRegistry/scope_tags');
      const taxonomy = await getSectorTaxonomy();
      const tags = normalizeScopeTags(row.scope_tags);
      row.scope_tags = tags.length > 0 ? scopeTagsToDisplayNames(tags, taxonomy) : legacyScopeTagsToDisplayNames(row.scope_tags, taxonomy);
    } catch (err) {
      console.warn('[API /api/admin/source-registry/[sourceKey] GET] scope_tags resolution failed:', err instanceof Error ? err.message : err);
      row.scope_tags = Array.isArray(row.scope_tags) ? row.scope_tags : ['—'];
    }
    // Tier for display: recompute from policy (publisher + .gov/.mil URL)
    try {
      const { tierFromPublisherAndUrl } = await import('@/app/lib/sourceRegistry/tierFromPublisher');
      row.tier = tierFromPublisherAndUrl(row.publisher as string | null, row.canonical_url as string | null);
    } catch {
      // Non-blocking; leave tier as-is
    }

    return NextResponse.json({
      source: row
    });
  } catch (error) {
    console.error('[API /api/admin/source-registry/[sourceKey] GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch source',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/source-registry/[sourceKey]
 * Update a source (source_key is immutable)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> }
) {
  try {
    const raw = (await params).sourceKey;
    const sourceKey = raw ? decodeURIComponent(String(raw)).trim() : undefined;
    const body = await request.json();

    if (!sourceKey) {
      return NextResponse.json(
        { error: 'sourceKey parameter is required' },
        { status: 400 }
      );
    }

    // Reject if source_key is present in body (immutable)
    if ('source_key' in body) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'source_key is immutable and cannot be changed',
          issues: [{ path: 'source_key', message: 'source_key is immutable and cannot be changed' }]
        },
        { status: 400 }
      );
    }

    // Validate and normalize using Zod schema
    const { validateAndNormalizeUpdate } = await import('@/app/lib/sourceRegistry/schema');
    const { updateSourceRegistryRow } = await import('@/app/lib/sourceRegistry/repo');

    let normalizedData;
    try {
      normalizedData = validateAndNormalizeUpdate(body);
    } catch (error: unknown) {
      const err = error && typeof error === "object" ? error as { message?: string; issues?: unknown } : {};
      if (err.message === "VALIDATION_ERROR" && err.issues) {
        return NextResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Invalid source registry payload",
            issues: err.issues,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Scope tags: only canonical sector/subsector/module codes. Convert UI string[] → ScopeTag[].
    if (normalizedData.scope_tags !== undefined) {
      const rawTags = Array.isArray(normalizedData.scope_tags) ? normalizedData.scope_tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean) : [];
      const tags = rawTags.flatMap((t) => splitMalformedScopeTagString(t)).filter((t) => !/^\d+$/.test(t));
      if (tags.length === 0) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'At least one scope tag is required (sector, subsector, or module)',
            issues: [{ path: 'scope_tags', message: 'scope_tags must have at least one value' }]
          },
          { status: 400 }
        );
      }
      const taxonomy = await getSectorTaxonomy();
      const sectorCodes = new Set(taxonomy.sectors.map((s) => s.code));
      const subsectorCodes = new Set(taxonomy.subsectors.map((s) => s.code));
      const { getAllowedScopeTagValues } = await import('@/app/lib/sourceRegistry/scopeTags');
      const allowed = await getAllowedScopeTagValues();
      const scopeTagList: ScopeTag[] = [];
      for (const t of tags) {
        if (sectorCodes.has(t)) scopeTagList.push({ type: 'sector', code: t });
        else if (subsectorCodes.has(t)) scopeTagList.push({ type: 'subsector', code: t });
        else if (allowed.moduleCodes.has(t)) scopeTagList.push({ type: 'module', code: t });
      }
      if (scopeTagList.length === 0) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: 'scope_tags may only contain canonical sector, subsector, or module codes',
            issues: [{ path: 'scope_tags', message: 'No valid sector/subsector/module codes' }]
          },
          { status: 400 }
        );
      }
      normalizedData.scope_tags = filterScopeTagsToTaxonomy(scopeTagList, taxonomy).map((tag) => tag.code);
    }

    // Update in database
    const result = await updateSourceRegistryRow(sourceKey, normalizedData);

    return NextResponse.json({
      success: true,
      source: result
    });
  } catch (error) {
    console.error('[API /api/admin/source-registry/[sourceKey] PATCH] Error:', error);
    
    if (error instanceof Error && error.message === 'Source not found') {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to update source',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/source-registry/[sourceKey]
 * Update a source (legacy endpoint, redirects to PATCH)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> }
) {
  return PATCH(request, { params });
}

/**
 * DELETE /api/admin/source-registry/[sourceKey]
 * Delete a source and all associated data (development mode - full deletion)
 * 
 * In development: deletes all associated data across both databases.
 * In production: will archive data instead (not yet implemented).
 * 
 * Uses advisory locks in both CORPUS and RUNTIME databases to prevent
 * race conditions during deletion.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> }
) {
  const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPoolForAdmin();
  let corpusLockAcquired = false;
  let runtimeLockAcquired = false;
  let sourceKey: string | undefined;
  let sourceRegistryId: string | undefined;

  try {
    const paramsResult = await params;
    const rawKey = paramsResult.sourceKey;
    sourceKey = rawKey ? decodeURIComponent(String(rawKey)).trim() : undefined;

    if (!sourceKey) {
      return NextResponse.json(
        { error: 'sourceKey parameter is required' },
        { status: 400 }
      );
    }

    // Step A: Acquire advisory locks in BOTH databases using PostgreSQL hashtext()
    // Lock order: CORPUS first, then RUNTIME (consistent order prevents deadlock)
    await corpusPool.query(`SELECT pg_advisory_lock(hashtext($1))`, [sourceKey]);
    corpusLockAcquired = true;

    await runtimePool.query(`SELECT pg_advisory_lock(hashtext($1))`, [sourceKey]);
    runtimeLockAcquired = true;

    // Step B: Get source_registry.id (UUID) from source_key for cross-database references
    const sourceCheck = await corpusPool.query(
      `SELECT id FROM public.source_registry WHERE source_key = $1`,
      [sourceKey]
    );

    if (sourceCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    sourceRegistryId = sourceCheck.rows[0].id;
    const sourceRegistryIdStr = typeof sourceRegistryId === 'string' ? sourceRegistryId : String(sourceRegistryId);

    // Step C: Delete all associated data in RUNTIME database
    // Use transactions for atomicity within each database
    const runtimeClient = await runtimePool.connect();
    try {
      await runtimeClient.query('BEGIN');

      // Delete citations that reference this source_key (if table exists)
      const hasOfcLibraryCitations = await runtimeClient.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ofc_library_citations'`
      );
      if (hasOfcLibraryCitations.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.ofc_library_citations WHERE source_key = $1`,
          [sourceKey]
        );
      }

      // Delete module_sources that reference this source via corpus_source_id (if column exists)
      const hasModuleSourcesCorpusId = await runtimeClient.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'module_sources' AND column_name = 'corpus_source_id'`
      );
      if (hasModuleSourcesCorpusId.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.module_sources WHERE corpus_source_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_ofc_citations that reference this source (if table exists)
      const hasModuleOfcCitations = await runtimeClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'module_ofc_citations'`
      );
      if (hasModuleOfcCitations.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.module_ofc_citations WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_corpus_links that reference this source (if table exists)
      const hasModuleCorpusLinks = await runtimeClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'module_corpus_links'`
      );
      if (hasModuleCorpusLinks.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.module_corpus_links WHERE corpus_source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_doc_source_link (RUNTIME bridge to CORPUS source_registry) that reference this source
      const hasModuleDocSourceLink = await runtimeClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'module_doc_source_link'`
      );
      if (hasModuleDocSourceLink.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.module_doc_source_link WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_chunk_comprehension entries that reference this source (if table exists)
      const hasModuleChunkComprehension = await runtimeClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'module_chunk_comprehension'`
      );
      if (hasModuleChunkComprehension.rows.length > 0) {
        await runtimeClient.query(
          `DELETE FROM public.module_chunk_comprehension WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Update module_questions to remove evidence anchors with this source_registry_id
      // Check if table and column exist first
      const hasModuleQuestions = await runtimeClient.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'module_questions' 
         AND column_name = 'evidence_anchors'`
      );

      if (hasModuleQuestions.rows.length > 0) {
        // This is a JSONB update, so we need to filter out matching entries
        // Compare UUID as text (elem->>'source_registry_id' returns text)
        await runtimeClient.query(
          `UPDATE public.module_questions
           SET evidence_anchors = (
             SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
             FROM jsonb_array_elements(evidence_anchors) elem
             WHERE elem->>'source_registry_id' != $1::text
           )
           WHERE evidence_anchors IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM jsonb_array_elements(evidence_anchors) elem
               WHERE elem->>'source_registry_id' = $1::text
             )`,
          [sourceRegistryIdStr]
        );
      }

      await runtimeClient.query('COMMIT');
    } catch (runtimeError) {
      await runtimeClient.query('ROLLBACK');
      throw runtimeError;
    } finally {
      runtimeClient.release();
    }

    // Step D: Delete all associated data in CORPUS database
    const corpusClient = await corpusPool.connect();
    try {
      await corpusClient.query('BEGIN');

      // Delete canonical_sources that reference this source_key (if table exists)
      const hasCanonicalSources = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name = 'canonical_sources'`
      );
      if (hasCanonicalSources.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.canonical_sources WHERE source_key = $1`,
          [sourceKey]
        );
      }

      // Delete rag_chunks for chunks belonging to this source's documents (before document_chunks)
      const hasRagChunks = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'rag_chunks'`
      );
      if (hasRagChunks.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.rag_chunks 
           WHERE chunk_id::text IN (
             SELECT chunk_id::text FROM public.document_chunks 
             WHERE document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)
           )`,
          [sourceRegistryIdStr]
        );
      }

      // Delete corpus_reprocess_queue for this source's documents
      const hasCorpusReprocessQueue = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'corpus_reprocess_queue'`
      );
      if (hasCorpusReprocessQueue.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.corpus_reprocess_queue 
           WHERE corpus_document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)`,
          [sourceRegistryIdStr]
        );
      }

      // Delete ofc_question_links that reference this source's corpus_documents (document_id = corpus_documents.id)
      const hasOfcQuestionLinks = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'ofc_question_links'`
      );
      if (hasOfcQuestionLinks.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.ofc_question_links 
           WHERE document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)`,
          [sourceRegistryIdStr]
        );
      }

      // Delete ofc_candidate_queue rows that reference this source's corpus_documents (document_id = corpus_documents.id)
      const hasOfcCandidateQueue = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'ofc_candidate_queue'`
      );
      if (hasOfcCandidateQueue.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.ofc_candidate_queue 
           WHERE document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)`,
          [sourceRegistryIdStr]
        );
      }

      // Delete question_candidate_queue rows that reference this source's corpus_documents
      const hasQuestionCandidateQueue = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'question_candidate_queue'`
      );
      if (hasQuestionCandidateQueue.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.question_candidate_queue 
           WHERE document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)`,
          [sourceRegistryIdStr]
        );
      }

      // Unlink module_standard_references that point at this source
      const hasModuleStandardReferences = await corpusClient.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'module_standard_references' AND column_name = 'source_registry_id'`
      );
      if (hasModuleStandardReferences.rows.length > 0) {
        await corpusClient.query(
          `UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_standard_citations that reference this source
      const hasModuleStandardCitations = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'module_standard_citations'`
      );
      if (hasModuleStandardCitations.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.module_standard_citations WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete module_standards that reference this source (before corpus_documents)
      const hasModuleStandardsSourceId = await corpusClient.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'module_standards' 
         AND column_name = 'source_registry_id'`
      );
      if (hasModuleStandardsSourceId.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.module_standards WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Delete dependents of corpus_documents BEFORE deleting corpus_documents (FK order)
      // 1. document_chunks references corpus_documents.id
      const hasDocumentChunks = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'document_chunks'`
      );
      if (hasDocumentChunks.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.document_chunks 
           WHERE document_id::text IN (SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text)`,
          [sourceRegistryIdStr]
        );
      }

      // 2. module_source_documents references corpus_documents.id (corpus_document_id)
      const hasModuleSourceDocuments = await corpusClient.query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'module_source_documents'`
      );
      if (hasModuleSourceDocuments.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.module_source_documents
           WHERE corpus_document_id::text IN (
             SELECT id::text FROM public.corpus_documents WHERE source_registry_id::text = $1::text
           )`,
          [sourceRegistryIdStr]
        );
      }

      // 3. Now safe to delete corpus_documents (source_registry_id column check)
      const hasSourceRegistryId = await corpusClient.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'corpus_documents' 
         AND column_name = 'source_registry_id'`
      );
      if (hasSourceRegistryId.rows.length > 0) {
        await corpusClient.query(
          `DELETE FROM public.corpus_documents WHERE source_registry_id::text = $1::text`,
          [sourceRegistryIdStr]
        );
      }

      // Finally, delete from source_registry
      const result = await corpusClient.query(
        `DELETE FROM public.source_registry WHERE source_key = $1 RETURNING source_key`,
        [sourceKey]
      );

      if (!result.rowCount || result.rows.length === 0) {
        await corpusClient.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Source not found or already deleted', message: `No row deleted for source_key: ${sourceKey}` },
          { status: 404 }
        );
      }

      await corpusClient.query('COMMIT');

      return NextResponse.json({
        success: true,
        deleted_source_key: result.rows[0].source_key
      }, { status: 200 });

    } catch (corpusError) {
      await corpusClient.query('ROLLBACK');
      throw corpusError;
    } finally {
      corpusClient.release();
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const details = error instanceof Error && (error as NodeJS.ErrnoException).code;
    console.error('[API /api/admin/source-registry/[sourceKey] DELETE] Error:', error);
    console.error('[API /api/admin/source-registry/[sourceKey] DELETE] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        error: 'Failed to delete source',
        message,
        ...(details && { code: details }),
        hint: 'Check CORPUS and RUNTIME DB connectivity and that source_registry, corpus_documents, document_chunks, and RUNTIME citation tables exist.'
      },
      { status: 500 }
    );
  } finally {
    // Step E: Always release locks in reverse order
    if (sourceKey) {
      try {
        if (runtimeLockAcquired) {
          await runtimePool.query(`SELECT pg_advisory_unlock(hashtext($1))`, [sourceKey]);
        }
      } catch (e) {
        console.error('[DELETE] Failed to release RUNTIME lock:', e);
      }

      try {
        if (corpusLockAcquired) {
          await corpusPool.query(`SELECT pg_advisory_unlock(hashtext($1))`, [sourceKey]);
        }
      } catch (e) {
        console.error('[DELETE] Failed to release CORPUS lock:', e);
      }
    }
  }
}
