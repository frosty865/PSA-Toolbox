import { NextRequest, NextResponse } from 'next/server';
import { normalizePublisherName } from '@/app/lib/sourceRegistry/publisherNormalizer';
import { verifyPdfBuffer } from '@/app/lib/crawler/pdfVerify';
import { extractPdfMetadataFromBuffer } from '@/app/lib/pdfExtractTitle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/source-registry/extract-pdf-metadata
 * Extract metadata from a PDF file.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!verifyPdfBuffer(buffer)) {
      return NextResponse.json(
        { error: 'File is not a valid PDF (missing %PDF- signature)' },
        { status: 400 }
      );
    }

    const result = await extractPdfMetadataFromBuffer(buffer);
    const rawPublisher = result.publisher || null;
    const normalizedPublisher = rawPublisher ? normalizePublisherName(rawPublisher) : null;

    return NextResponse.json({
      success: true,
      metadata: {
        title: result.title || null,
        publisher: normalizedPublisher || rawPublisher || null,
        year: null,
        description: null,
        citation_short: result.citation_short || null,
        citation_full: result.citation_full || null,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to extract PDF metadata',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
