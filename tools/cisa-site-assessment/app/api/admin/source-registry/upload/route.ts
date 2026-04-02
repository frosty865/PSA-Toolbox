import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/source-registry/upload
 * Upload and ingest a local PDF file
 *
 * @deprecated This endpoint is deprecated. Use the deterministic router + intake wizard workflow instead.
 * See: services/router/README.md and tools/intake/README.md
 *
 * This endpoint has been disabled. To ingest documents:
 * 1. Drop PDFs into services/router/incoming/
 * 2. Run intake wizard: scripts/run_intake_wizard.ps1
 * 3. Router will route based on confirmed metadata
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js route signature
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'LEGACY_UPLOAD_DISABLED',
        message: 'Legacy upload API is disabled. Use deterministic router workflow.',
        migration: {
          step1: 'Drop PDFs into services/router/incoming/',
          step2: 'Run .\\scripts\\run_intake_wizard.ps1 to generate .meta.json',
          step3: 'Router will route into sources/ automatically after confirmation'
        }
      }
    },
    { status: 410 } // 410 Gone
  );
  
  /* DISABLED - Legacy code archived to D:\psa-workspace\archive\intake_deprecated_20260124\
  
  let tempFilePath: string | null = null;
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceRegistryId = formData.get('source_registry_id') as string;
    const sourceKey = formData.get('source_key') as string;
    const publisher = formData.get('publisher') as string;
    const title = formData.get('title') as string;
    const authorityTier = formData.get('authority_tier') as string;
    const year = formData.get('year') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Validate source_registry_id
    if (!sourceRegistryId || !sourceRegistryId.trim()) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          issues: [{ path: 'source_registry_id', message: 'Required' }]
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sourceRegistryId)) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          issues: [{ path: 'source_registry_id', message: 'Invalid UUID format' }]
        },
        { status: 400 }
      );
    }

    // Validate source exists and is ACTIVE
    const pool = getCorpusPoolForAdmin();
    const sourceCheck = await pool.query(
      `SELECT id, source_key, notes 
       FROM public.source_registry 
       WHERE id = $1`,
      [sourceRegistryId]
    );

    if (sourceCheck.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          issues: [{ path: 'source_registry_id', message: 'Source not found' }]
        },
        { status: 400 }
      );
    }

    const source = sourceCheck.rows[0];
    
    // Check if source is ACTIVE by extracting status from notes
    const status = extractStatusFromNotes(source.notes);
    if (status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          issues: [{ path: 'source_registry_id', message: 'Source is not ACTIVE' }]
        },
        { status: 400 }
      );
    }

    if (!sourceKey || !publisher || !title || !authorityTier) {
      return NextResponse.json(
        { error: 'source_key, publisher, title, and authority_tier are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 100MB)` },
        { status: 400 }
      );
    }

    // Save file to temporary location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    tempFilePath = join(tmpdir(), `psa-upload-${randomUUID()}.pdf`);
    await writeFile(tempFilePath, buffer);

    // Verify source_registry_id matches the source_key (if provided)
    // This ensures consistency
    if (source.source_key !== sourceKey) {
      console.warn(`[API] Source key mismatch: provided ${sourceKey}, but source_registry_id ${sourceRegistryId} has key ${source.source_key}`);
      // Don't fail - just log warning, use the source_registry_id's actual source_key
    }

    // Format date
    const publishedAt = year ? `${year}-01-01` : null;
    const authorityScope = mapAuthorityTierToScope(authorityTier);

    // Trigger ingestion
    console.log(`[API] Starting local file ingestion for source: ${sourceKey} (source_registry_id: ${sourceRegistryId})`);
    console.log(`[API] sourceRegistryId type: ${typeof sourceRegistryId}, value: "${sourceRegistryId}"`);
    
    const ingestionResult = await ingestDocumentFromFile(
      tempFilePath,
      publisher,
      title,
      publishedAt,
      authorityScope,
      sourceRegistryId // Pass source_registry_id to ingestion
    );

    if (ingestionResult.success && ingestionResult.documentId) {
      // Guard: Verify document has source_registry_id and source is ACTIVE (defense in depth)
      // This runs AFTER document creation but BEFORE we consider ingestion successful
      const guardResult = await guardDocumentSourceBeforeIngest({
        documentTable: 'corpus_documents', // Authoritative table
        documentId: ingestionResult.documentId,
      });

      if (guardResult) {
        // Guard failed - return error response
        console.error(`[API] Guard failed for document ${ingestionResult.documentId}:`, guardResult);
        return guardResult;
      }
    }

    if (ingestionResult.success) {
      // Update source registry with ingestion results
      await updateSourceRegistryWithIngestion(sourceKey, ingestionResult);

      console.log(`[API] ✅ Local file ingestion successful for ${sourceKey}:`, {
        documentId: ingestionResult.documentId,
        chunksCount: ingestionResult.chunksCount,
      });

      return NextResponse.json({
        success: true,
        message: 'Document uploaded and ingested successfully',
        ingestion: {
          documentId: ingestionResult.documentId,
          docSha256: ingestionResult.docSha256,
          chunksCount: ingestionResult.chunksCount,
        },
      });
    } else {
      console.warn(`[API] ⚠️ Local file ingestion failed for ${sourceKey}:`, ingestionResult.error);
      
      return NextResponse.json(
        {
          success: false,
          error: 'Ingestion failed',
          message: ingestionResult.error || 'Unknown error during ingestion',
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/upload POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload and ingest document',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      try {
        const { unlink } = await import('fs/promises');
        await unlink(tempFilePath);
      } catch (unlinkError) {
        console.warn(`[API] Failed to cleanup temp file ${tempFilePath}:`, unlinkError);
      }
    }
  }
  */
}

