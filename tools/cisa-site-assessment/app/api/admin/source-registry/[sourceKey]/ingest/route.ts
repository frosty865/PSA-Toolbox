import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPoolForAdmin } from '@/app/lib/db/corpus_client';
import {
  ingestDocumentFromUrl,
  updateSourceRegistryWithIngestion,
} from '@/app/lib/sourceRegistry/ingestion';
import { inferScopeTagsFromContentForSource, getChunkExcerptForSource } from '@/app/lib/sourceRegistry/analyzeScopeTags';
import { guardDocumentSourceBeforeIngest } from '@/app/lib/corpus/ingestGuards';
import { screenCandidateUrl } from '@/app/lib/crawler/screenCandidateUrl';
import { getSectorTaxonomy } from '@/app/lib/taxonomy/get_sector_taxonomy';
import { extractDocumentMetadata } from '@/app/lib/metadata/extract_document_metadata';
import { applyExtractedMetadataToSourceRegistry, applyExtractedMetadataToCorpusDocument } from '@/app/lib/metadata/apply_extracted_metadata';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/source-registry/[sourceKey]/ingest
 * Trigger ingestion for an existing source
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceKey: string }> }
) {
  try {
    const { sourceKey } = await params;

    if (!sourceKey) {
      return NextResponse.json(
        { error: 'sourceKey is required' },
        { status: 400 }
      );
    }

    // Fetch source from registry
    const pool = getCorpusPoolForAdmin();
    const sourceResult = await pool.query(
      `SELECT 
        id,
        source_key,
        publisher,
        title,
        publication_date,
        tier,
        canonical_url
      FROM public.source_registry
      WHERE source_key = $1`,
      [sourceKey]
    );

    if (sourceResult.rows.length === 0) {
      return NextResponse.json(
        { error: `Source with key "${sourceKey}" not found` },
        { status: 404 }
      );
    }

    const source = sourceResult.rows[0];

    // Check if URL is available
    if (!source.canonical_url) {
      return NextResponse.json(
        { error: 'Source does not have a URL (canonical_url) to ingest' },
        { status: 400 }
      );
    }

    const screen = await screenCandidateUrl(source.canonical_url, {
      target: { kind: 'corpus' },
      strictness: 'strict',
      resolveLandingToPdf: true,
    });
    if (!screen.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'URL did not pass screening',
          rejectCode: screen.rejectCode,
          reasons: screen.reasons,
          canonicalUrl: screen.canonicalUrl,
        },
        { status: 400 }
      );
    }
    const urlToIngest = screen.finalUrl;

    // Map tier to authority scope
    const tierToScope: Record<number, string> = {
      1: 'BASELINE_AUTHORITY',
      2: 'SECTOR_AUTHORITY',
      3: 'SUBSECTOR_AUTHORITY',
    };
    const authorityScope = tierToScope[source.tier] || 'BASELINE_AUTHORITY';

    // Trigger ingestion
    console.log(`[API] Starting manual ingestion for source: ${sourceKey}`);
    
    // Format publication_date to ISO format (YYYY-MM-DD) if it exists
    let publishedAt: string | null = null;
    if (source.publication_date) {
      // Handle both Date objects and string dates
      const date = new Date(source.publication_date);
      if (!isNaN(date.getTime())) {
        // Format as YYYY-MM-DD
        publishedAt = date.toISOString().split('T')[0];
      } else if (typeof source.publication_date === 'string' && source.publication_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in correct format
        publishedAt = source.publication_date;
      }
    }
    
    const sourceRegistryId = source.id != null ? String(source.id) : undefined;
    // Coerce to strings so ingestion script never receives null/undefined
    const publisher = source.publisher != null ? String(source.publisher) : '';
    const title = source.title != null ? String(source.title) : '';
    const ingestionResult = await ingestDocumentFromUrl(
      urlToIngest,
      publisher,
      title,
      publishedAt,
      authorityScope,
      sourceRegistryId
    );

    if (ingestionResult.success && ingestionResult.documentId) {
      const guardResult = await guardDocumentSourceBeforeIngest({
        documentTable: 'corpus_documents',
        documentId: ingestionResult.documentId,
      });

      if (guardResult) {
        console.error(`[API] Guard failed for document ${ingestionResult.documentId}:`, guardResult);
        return guardResult;
      }

      try {
        await updateSourceRegistryWithIngestion(sourceKey, ingestionResult);
      } catch (updateErr) {
        console.error(`[API] Failed to update source_registry after ingestion:`, updateErr);
        return NextResponse.json(
          {
            error: 'Ingestion succeeded but source registry update failed',
            message: updateErr instanceof Error ? updateErr.message : 'Unknown error',
          },
          { status: 500 }
        );
      }

      // PSA metadata extraction (psa-metadata:latest): title, publisher, date, synopsis, sector/subsector. Guarded write-back.
      let metadataApplied: boolean | undefined;
      try {
        const taxonomy = await getSectorTaxonomy();
        const excerpt = await getChunkExcerptForSource(pool, String(source.id), { maxChunks: 15, maxChars: 12000 });
        const extracted = await extractDocumentMetadata({
          excerpt: excerpt || undefined,
          taxonomy,
        });
        await applyExtractedMetadataToSourceRegistry(pool, String(source.id), extracted);
        if (ingestionResult.documentId) {
          await applyExtractedMetadataToCorpusDocument(pool, String(ingestionResult.documentId), extracted);
        }
        metadataApplied = true;
      } catch (metaErr) {
        console.warn(`[API] Metadata extraction skipped for ${sourceKey}:`, metaErr instanceof Error ? metaErr.message : metaErr);
      }

      // Infer sector/subsector from document content (title then chunk excerpt via Ollama)
      let scopeTagsInferred: { updated: boolean; from?: string } | undefined;
      try {
        const scopeResult = await inferScopeTagsFromContentForSource(pool, String(source.id));
        if (scopeResult.updated) {
          scopeTagsInferred = { updated: true, from: scopeResult.from };
          console.log(`[API] Scope tags inferred for ${sourceKey} from ${scopeResult.from}`);
        }
      } catch (scopeErr) {
        console.warn(`[API] Scope-tag inference skipped for ${sourceKey}:`, scopeErr instanceof Error ? scopeErr.message : scopeErr);
      }

      console.log(`[API] ✅ Manual ingestion successful for ${sourceKey}:`, {
        documentId: ingestionResult.documentId,
        chunksCount: ingestionResult.chunksCount,
      });

      return NextResponse.json({
        success: true,
        message: 'Document ingested successfully',
        ingestion: {
          documentId: ingestionResult.documentId,
          docSha256: ingestionResult.docSha256,
          chunksCount: ingestionResult.chunksCount,
          metadataApplied,
          scopeTagsInferred,
        },
      });
    }

    const errMsg = ingestionResult.error || 'Unknown error during ingestion';
    console.warn(`[API] ⚠️ Manual ingestion failed for ${sourceKey}:`, errMsg);

    const isClientError =
      /unsupported file type|only pdf|not a pdf|failed to download|download timeout|content-type/i.test(errMsg) ||
      /only PDF files are supported/i.test(errMsg);

    return NextResponse.json(
      {
        success: false,
        error: 'Ingestion failed',
        message: errMsg,
      },
      { status: isClientError ? 400 : 500 }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[API /api/admin/source-registry/[sourceKey]/ingest POST] Error:', err.message);
    console.error('[API /api/admin/source-registry/[sourceKey]/ingest POST] Stack:', err.stack);
    return NextResponse.json(
      {
        error: 'Failed to ingest document',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
