import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import { extractStatusFromNotes } from '@/app/lib/sourceRegistry/schema';
import { DISPLAY_MISSING_PUBLISHER, FILTER_NO_PUBLISHER, isUnacceptablePublisher, extractPublisherFromUrl } from '@/app/lib/sourceRegistry/publisherNormalizer';
import { normalizeScopeTags, scopeTagsToDisplayNames, legacyScopeTagsToDisplayNames } from '@/app/lib/sourceRegistry/scope_tags';
import { getSectorTaxonomy } from '@/app/lib/taxonomy/get_sector_taxonomy';
import { tierFromPublisherAndUrl } from '@/app/lib/sourceRegistry/tierFromPublisher';
import { assessmentCorpusWhereFragment, moduleSourcesWhereFragment } from '@/app/lib/sourceRegistry/corpusModuleFilter';
import { getAdminAuditContext, writeAdminAuditLog } from '@/app/lib/admin/audit';
import { columnExists, tableExists } from '@/app/lib/db/table_exists';

/** True if stored publisher looks like a document title (so we show URL-derived publisher instead). */
function publisherLooksLikeTitle(publisher: string | null | undefined, title: string | null | undefined): boolean {
  const p = (publisher ?? '').trim();
  const t = (title ?? '').trim();
  if (!p) return false;
  if (p.length > 40) return true;
  if (p.split(/\s+/).length > 4) return true;
  if (t && (t === p || (t.length > 10 && (t.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(t.toLowerCase()))))) return true;
  return false;
}

export const dynamic = 'force-dynamic';

/** Detect CORPUS schema support for source-registry list (avoids hard failures on missing tables/columns). */
async function detectSchemaSupport(pool: { query: (sql: string, values?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }) {
  const out = {
    corpusDocumentsHasSourceRegistryId: false,
    moduleSourceDocumentsExists: false,
    corpusDocumentsHasDocumentRole: false,
    sourceRegistryHasIngestionStream: false,
  };
  try {
    const [
      corpusDocumentsExists,
      moduleSourceDocumentsExists,
      corpusDocumentsHasSourceRegistryId,
      corpusDocumentsHasDocumentRole,
      sourceRegistryHasIngestionStream,
    ] = await Promise.all([
      tableExists(pool, 'public', 'corpus_documents'),
      tableExists(pool, 'public', 'module_source_documents'),
      columnExists(pool, 'public', 'corpus_documents', 'source_registry_id'),
      columnExists(pool, 'public', 'corpus_documents', 'document_role'),
      columnExists(pool, 'public', 'source_registry', 'ingestion_stream'),
    ]);
    out.corpusDocumentsHasSourceRegistryId = corpusDocumentsExists && corpusDocumentsHasSourceRegistryId;
    out.moduleSourceDocumentsExists = moduleSourceDocumentsExists;
    out.corpusDocumentsHasDocumentRole = corpusDocumentsExists && corpusDocumentsHasDocumentRole;
    out.sourceRegistryHasIngestionStream = sourceRegistryHasIngestionStream;
  } catch {
    // If info_schema fails, assume minimal (no category filters, no chunk_count from cd)
  }
  return out;
}

/**
 * GET /api/admin/source-registry
 * List all sources in the registry
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publisher = searchParams.get('publisher');
    const tier = searchParams.get('tier');
    const sourceCategory = searchParams.get('category'); // 'module' or 'corpus'
    const moduleCode = searchParams.get('moduleCode'); // optional: filter module sources to this module_code
    const zeroChunkOnly = searchParams.get('zeroChunkOnly') === 'true';

    const pool = getCorpusPoolForAdmin();
    const schema = await detectSchemaSupport(pool);

    // Recursively fix publication_date from linked corpus_documents (only if corpus_documents has source_registry_id)
    if (schema.corpusDocumentsHasSourceRegistryId) {
      try {
        await pool.query(`
          WITH first_doc_date AS (
            SELECT DISTINCT ON (source_registry_id) source_registry_id, publication_date
            FROM public.corpus_documents
            WHERE source_registry_id IS NOT NULL AND publication_date IS NOT NULL
            ORDER BY source_registry_id, publication_date
          )
          UPDATE public.source_registry sr
          SET publication_date = f.publication_date, updated_at = now()
          FROM first_doc_date f
          WHERE sr.id = f.source_registry_id AND sr.publication_date IS NULL
        `);
      } catch (e) {
        console.warn('[API /api/admin/source-registry GET] publication_date backfill failed (non-fatal):', e instanceof Error ? e.message : e);
      }
    }

    const chunkCountExpr = schema.corpusDocumentsHasSourceRegistryId
      ? `(SELECT COALESCE(SUM(cd.chunk_count), 0)::int FROM public.corpus_documents cd WHERE cd.source_registry_id = sr.id) AS chunk_count`
      : `0 AS chunk_count`;

    const derivedCitationLabelExpr = schema.corpusDocumentsHasSourceRegistryId
      ? `, (SELECT COALESCE(cd.citation_short, cd.citation_full) FROM public.corpus_documents cd WHERE cd.source_registry_id = sr.id AND (cd.citation_short IS NOT NULL OR cd.citation_full IS NOT NULL) ORDER BY cd.title_confidence DESC NULLS LAST LIMIT 1) AS derived_citation_label`
      : '';

    let query = `
      SELECT 
        sr.id,
        sr.source_key,
        sr.publisher,
        sr.tier,
        sr.title,
        sr.publication_date,
        sr.source_type,
        sr.canonical_url,
        sr.local_path,
        sr.doc_sha256,
        sr.retrieved_at,
        sr.scope_tags,
        sr.notes,
        sr.created_at,
        sr.updated_at,
        ${chunkCountExpr}
        ${derivedCitationLabelExpr}
      FROM public.source_registry sr
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (publisher) {
      if (publisher === FILTER_NO_PUBLISHER || publisher === DISPLAY_MISSING_PUBLISHER || publisher === '—') {
        query += ` AND (sr.publisher IS NULL OR sr.publisher = '' OR sr.publisher ILIKE 'unknown' OR sr.publisher ILIKE 'local file' OR sr.publisher ILIKE 'module source' OR sr.publisher ILIKE 'unspecified' OR sr.publisher ILIKE '(no publisher)' OR sr.publisher ILIKE 'no publisher' OR sr.publisher = '—')`;
      } else {
        query += ` AND sr.publisher = $${paramIndex}`;
        params.push(publisher);
        paramIndex++;
      }
    }

    if (tier) {
      query += ` AND sr.tier = $${paramIndex}`;
      params.push(parseInt(tier, 10));
      paramIndex++;
    }

    const canUseCategoryFilters = schema.moduleSourceDocumentsExists && schema.corpusDocumentsHasDocumentRole;
    const moduleCodeFilter = sourceCategory === 'module' && moduleCode && typeof moduleCode === 'string' && moduleCode.trim();

    // Filter by source category when schema supports it (module_source_documents + document_role).
    // When moduleCode is set we only filter by scope/key below, so we don't require the EXISTS block here.
    if (canUseCategoryFilters && sourceCategory === 'module' && !moduleCodeFilter) {
      // "module" = already linked to a module OR OFC_SOURCE/note OR has ingested docs (chunk_count > 0) so wizard can show them
      query += ` AND (
        EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          JOIN public.module_source_documents msd ON cd.id = msd.corpus_document_id
          WHERE cd.source_registry_id = sr.id
        )
        OR (sr.notes IS NOT NULL AND sr.notes ILIKE '%Auto-registered from module-curated OFC import%')
        OR EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          WHERE cd.source_registry_id = sr.id
          AND cd.document_role = 'OFC_SOURCE'
        )
        OR EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          WHERE cd.source_registry_id = sr.id
          AND (cd.chunk_count IS NULL OR cd.chunk_count > 0)
        )
      )`;
    } else if (canUseCategoryFilters && sourceCategory === 'corpus') {
      query += ` AND NOT (
        EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          JOIN public.module_source_documents msd ON cd.id = msd.corpus_document_id
          WHERE cd.source_registry_id = sr.id
        )
        OR (sr.notes IS NOT NULL AND sr.notes ILIKE '%Auto-registered from module-curated OFC import%')
        OR EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          WHERE cd.source_registry_id = sr.id
          AND cd.document_role = 'OFC_SOURCE'
        )
        OR EXISTS (
          SELECT 1 
          FROM public.corpus_documents cd
          WHERE cd.source_registry_id = sr.id
          AND cd.document_role = 'TECHNOLOGY_LIBRARY'
        )
      )`;
    }

    // STEP 1 — Canonical rule: Corpus (Assessment Data) = source_registry where module_code IS NULL.
    // REQUIRED unconditionally when category=corpus (no dependency on canUseCategoryFilters).
    if (sourceCategory === 'corpus') {
      query += ` AND ${assessmentCorpusWhereFragment('sr')}`;
    }

    // When category=module, filter to module-only (shared helper enforces context).
    if (sourceCategory === 'module' && (canUseCategoryFilters || moduleCodeFilter)) {
      query += ` AND ${moduleSourcesWhereFragment('sr')}`;
    }
    // Optional: restrict to sources scoped to a specific module (scope_tags->>'module_code' or source_key prefix).
    if (moduleCodeFilter) {
      const code = (moduleCode as string).trim();
      // Match backfill (module:CODE:...) and legacy module ingestion (MOD_IN_CODE_...)
      query += ` AND (sr.scope_tags->>'module_code' = $${paramIndex} OR sr.source_key LIKE $${paramIndex + 1} OR sr.source_key LIKE $${paramIndex + 2})`;
      params.push(code, `module:${code}%`, `MOD_IN_${code}_%`);
      paramIndex += 3;
    } else if (canUseCategoryFilters && sourceCategory === 'technology') {
      query += ` AND EXISTS (
        SELECT 1 
        FROM public.corpus_documents cd
        WHERE cd.source_registry_id = sr.id
        AND cd.document_role = 'TECHNOLOGY_LIBRARY'
      )`;
    }

    // Optional filter: show only sources with 0 chunks (only when corpus_documents has source_registry_id)
    if (schema.corpusDocumentsHasSourceRegistryId && sourceCategory !== 'module' && zeroChunkOnly) {
      query += ` AND EXISTS (SELECT 1 FROM public.corpus_documents cd WHERE cd.source_registry_id = sr.id)
      AND (SELECT COALESCE(SUM(cd.chunk_count), 0) FROM public.corpus_documents cd WHERE cd.source_registry_id = sr.id) = 0`;
    }

    query += ` ORDER BY sr.tier, sr.publisher, sr.title`;

    const result = await pool.query(query, params);

    // Sector/subsector display: only canonical taxonomy names. Load taxonomy once.
    let taxonomy: Awaited<ReturnType<typeof getSectorTaxonomy>> = { sectors: [], subsectors: [] };
    try {
      taxonomy = await getSectorTaxonomy();
    } catch {
      // Non-blocking; if fetch fails we show codes or "—"
    }

    // When title is a hash (e.g. hex id), derive a display title from citation_label or URL for admin UI.
    function displayTitle(row: Record<string, unknown>): string | null {
      const title = row.title;
      if (!title || typeof title !== 'string') return null;
      const isHashLike = /^[a-f0-9]{12,}$/i.test(title.trim());
      if (!isHashLike) return null;
      const citationFromScope = row.scope_tags && typeof row.scope_tags === 'object' && typeof (row.scope_tags as Record<string, unknown>).citation_label === 'string'
        ? (row.scope_tags as Record<string, unknown>).citation_label as string
        : '';
      const citationDerived = typeof row.derived_citation_label === 'string' ? (row.derived_citation_label as string).trim() : '';
      const citation = (citationFromScope || citationDerived).trim();
      if (citation) {
        const afterParen = citation.replace(/^[^)]*\)\s*\.?\s*/, '').trim();
        if (afterParen.length > 3 && afterParen !== citation) return afterParen;
      }
      const url = row.canonical_url;
      if (url && typeof url === 'string') {
        try {
          const pathname = new URL(url).pathname;
          const segment = pathname.split('/').filter(Boolean).pop() || '';
          const base = segment.replace(/\.(pdf|html?)$/i, '').replace(/[-_]+/g, ' ').trim();
          if (base.length > 2) return base.replace(/\b\w/g, (c: string) => c.toUpperCase());
        } catch { /* ignore */ }
      }
      return null;
    }

    const sources = result.rows.map((row: Record<string, unknown>) => {
      const fromScopeTags = row.scope_tags && typeof row.scope_tags === 'object' && typeof (row.scope_tags as Record<string, unknown>).citation_label === 'string'
        ? (row.scope_tags as Record<string, unknown>).citation_label as string
        : null;
      const derived = typeof row.derived_citation_label === 'string' && (row.derived_citation_label as string).trim()
        ? (row.derived_citation_label as string).trim()
        : null;
      const citationLabel = fromScopeTags ?? derived;
      const rowTitle: string | null = row.title != null && typeof row.title === 'string' ? row.title : null;
      const displayTitleVal = displayTitle(row);
      const finalTitle = displayTitleVal ?? row.title;
      // Sector/subsector: canonical taxonomy names; fall back to legacy (string array / old object) when no ScopeTag[]
      const normalizedTags = normalizeScopeTags(row.scope_tags);
      const scopeTagsDisplay = normalizedTags.length > 0
        ? scopeTagsToDisplayNames(normalizedTags, taxonomy)
        : legacyScopeTagsToDisplayNames(row.scope_tags, taxonomy);
      // When stored publisher is unknown, use URL-derived or leave blank (do not return "—")
      let displayPublisherVal: string | null | undefined = typeof row.publisher === 'string' ? row.publisher : (row.publisher == null ? (row.publisher as null | undefined) : undefined);
      const titleForPublisher = typeof finalTitle === 'string' ? finalTitle : rowTitle;
      if (isUnacceptablePublisher(displayPublisherVal) || publisherLooksLikeTitle(displayPublisherVal, titleForPublisher)) {
        const fromUrl = row.canonical_url && typeof row.canonical_url === 'string'
          ? extractPublisherFromUrl(row.canonical_url)
          : null;
        displayPublisherVal = fromUrl ?? null;
      }
      const scopeTagsRaw = row.scope_tags;
      const isTechnologyLibrary = scopeTagsRaw && typeof scopeTagsRaw === 'object' && !Array.isArray(scopeTagsRaw)
        && (scopeTagsRaw as Record<string, unknown>)?.tags && typeof (scopeTagsRaw as Record<string, unknown>).tags === 'object'
        && ((scopeTagsRaw as Record<string, unknown>).tags as Record<string, unknown>)?.library === 'technology';

      // Tier for display: recompute from policy (publisher + .gov/.mil URL) so UI shows correct tier even if DB is stale
      const canonicalUrlForTier: string | null = typeof row.canonical_url === 'string' ? row.canonical_url : null;
      const displayTier = tierFromPublisherAndUrl(
        displayPublisherVal ?? (typeof row.publisher === 'string' ? row.publisher : null),
        canonicalUrlForTier
      );

      return {
        ...row,
        publisher: displayPublisherVal,
        tier: displayTier,
        scope_tags: scopeTagsDisplay,
        citation_label: citationLabel,
        title: finalTitle,
        status: extractStatusFromNotes(typeof row.notes === 'string' ? row.notes : null),
        is_technology_library: isTechnologyLibrary
      };
    });

    const body: { sources: unknown[]; total: number; schema_limit?: boolean } = {
      sources,
      total: sources.length
    };
    if (!schema.moduleSourceDocumentsExists || !schema.corpusDocumentsHasDocumentRole) {
      body.schema_limit = true; // Category filter (module/corpus/technology) skipped; run CORPUS migrations if needed
    }
    return NextResponse.json(body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/admin/source-registry GET] Error:', error);
    const hint =
      message.includes('source_registry') || message.includes('corpus_documents') || message.includes('relation') || message.includes('does not exist')
        ? ' Ensure CORPUS migrations are applied (source_registry, corpus_documents with source_registry_id, and optionally module_source_documents, document_role). Check /api/admin/diagnostics/source-registry-location for DB state.'
        : message.includes('CORPUS_DATABASE_URL') || message.includes('CORPUS')
          ? ' Check CORPUS_DATABASE_URL in .env and /api/admin/diagnostics/source-registry-location.'
          : '';
    return NextResponse.json(
      {
        error: 'Failed to fetch sources',
        message: message + (hint ? ' ' + hint : '')
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/source-registry
 * Create a new source in the registry
 */
export async function POST(request: NextRequest) {
  try {
    const audit = getAdminAuditContext(request);
    const body = await request.json();

    // Validate and normalize using Zod schema
    const { validateAndNormalizeCreate } = await import('@/app/lib/sourceRegistry/schema');
    const { createSourceRegistryRow } = await import('@/app/lib/sourceRegistry/repo');
    const { getCorpusPoolForAdmin } = await import('@/app/lib/db/corpus_client');

    let normalizedData;
    try {
      normalizedData = validateAndNormalizeCreate(body);
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

    // Check for duplicates before creating
    const pool = getCorpusPoolForAdmin();
    
    // Check by source_key
    const existingByKey = await pool.query(
      `SELECT source_key FROM public.source_registry WHERE source_key = $1`,
      [normalizedData.source_key]
    );
    
    if (existingByKey.rows.length > 0) {
      writeAdminAuditLog('source_registry_duplicate_rejected', audit, {
        source_key: normalizedData.source_key,
        reason: 'source_key',
      });
      return NextResponse.json(
        {
          error: 'DUPLICATE_SOURCE',
          message: `Source with source_key "${normalizedData.source_key}" already exists`,
          existing_source_key: existingByKey.rows[0].source_key
        },
        { status: 409 }
      );
    }
    
    // Check by canonical_url if provided
    if (normalizedData.url) {
      const existingByUrl = await pool.query(
        `SELECT source_key FROM public.source_registry WHERE canonical_url = $1`,
        [normalizedData.url]
      );
      
      if (existingByUrl.rows.length > 0) {
        writeAdminAuditLog('source_registry_duplicate_rejected', audit, {
          source_key: normalizedData.source_key,
          canonical_url: normalizedData.url,
          reason: 'canonical_url',
        });
        return NextResponse.json(
          {
            error: 'DUPLICATE_SOURCE',
            message: `Source with URL "${normalizedData.url}" already exists`,
            existing_source_key: existingByUrl.rows[0].source_key
          },
          { status: 409 }
        );
      }
    }
    
    // Check by publisher + title combination
    const existingByPublisherTitle = await pool.query(
      `SELECT source_key FROM public.source_registry 
       WHERE publisher = $1 AND title = $2`,
      [normalizedData.publisher, normalizedData.title]
    );
    
    if (existingByPublisherTitle.rows.length > 0) {
      writeAdminAuditLog('source_registry_duplicate_rejected', audit, {
        source_key: normalizedData.source_key,
        publisher: normalizedData.publisher,
        title: normalizedData.title,
        reason: 'publisher_title',
      });
      return NextResponse.json(
        {
          error: 'DUPLICATE_SOURCE',
          message: `Source with publisher "${normalizedData.publisher}" and title "${normalizedData.title}" already exists`,
          existing_source_key: existingByPublisherTitle.rows[0].source_key
        },
        { status: 409 }
      );
    }

    // Create in database
    const result = await createSourceRegistryRow(normalizedData);
    writeAdminAuditLog('source_registry_created', audit, {
      source_key: normalizedData.source_key,
      title: normalizedData.title,
      authority_tier: normalizedData.authority_tier,
      has_url: !!normalizedData.url,
    });

    // Trigger automatic ingestion if URL is provided
    // Do this asynchronously so we don't block the response
    if (normalizedData.url) {
      // Import ingestion utilities
      const {
        ingestDocumentFromUrl,
        updateSourceRegistryWithIngestion,
        mapAuthorityTierToScope,
      } = await import('@/app/lib/sourceRegistry/ingestion');

      // Trigger ingestion in background (don't await - return immediately)
      (async () => {
        try {
          console.log(`[API] Starting automatic ingestion for source: ${normalizedData.source_key}`);
          
          // Format year as ISO date (YYYY-MM-DD)
          const publishedAt = normalizedData.year ? `${normalizedData.year}-01-01` : null;
          
          const ingestionResult = await ingestDocumentFromUrl(
            normalizedData.url!,
            normalizedData.publisher,
            normalizedData.title,
            publishedAt,
            mapAuthorityTierToScope(normalizedData.authority_tier)
          );

          if (ingestionResult.success) {
            writeAdminAuditLog('source_registry_ingestion_completed', audit, {
              source_key: normalizedData.source_key,
              document_id: ingestionResult.documentId,
              chunks_count: ingestionResult.chunksCount,
            });
            console.log(`[API] ✅ Ingestion successful for ${normalizedData.source_key}:`, {
              documentId: ingestionResult.documentId,
              chunksCount: ingestionResult.chunksCount,
            });

            // Update source registry with ingestion results
            await updateSourceRegistryWithIngestion(
              normalizedData.source_key,
              ingestionResult
            );
          } else {
            writeAdminAuditLog('source_registry_ingestion_failed', audit, {
              source_key: normalizedData.source_key,
              error: ingestionResult.error,
            });
            console.warn(`[API] ⚠️ Ingestion failed for ${normalizedData.source_key}:`, ingestionResult.error);
            // Log to notes or a separate ingestion_errors field if needed
          }
        } catch (ingestionError) {
          writeAdminAuditLog('source_registry_ingestion_error', audit, {
            source_key: normalizedData.source_key,
            error: ingestionError instanceof Error ? ingestionError.message : String(ingestionError),
          });
          console.error(`[API] Error during automatic ingestion for ${normalizedData.source_key}:`, ingestionError);
          // Don't throw - ingestion failure shouldn't break source creation
        }
      })();
    }

    return NextResponse.json({
      success: true,
      source: result,
      ingestionTriggered: !!normalizedData.url,
    }, { status: 201 });

  } catch (error: unknown) {
    const audit = getAdminAuditContext(request);
    writeAdminAuditLog('source_registry_create_error', audit, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('[API /api/admin/source-registry POST] Error:', error);
    
    // Handle duplicate key error
    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: error.message,
          issues: [{ path: 'source_key', message: error.message }]
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create source',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

