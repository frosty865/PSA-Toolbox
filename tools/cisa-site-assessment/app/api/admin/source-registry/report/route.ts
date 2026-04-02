import { NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';
import { isUnacceptablePublisher } from '@/app/lib/sourceRegistry/publisherNormalizer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/source-registry/report
 * Generate a comprehensive sources report for SES and Director review
 * 
 * Returns:
 * - Summary statistics by tier and publisher
 * - List of all sources with key metadata
 * - Duplicate detection report
 * - Sources missing critical information
 */
export async function GET() {
  try {
    const pool = getCorpusPool();

    // Get all sources
    const allSourcesResult = await pool.query(`
      SELECT 
        source_key,
        publisher,
        tier,
        title,
        publication_date,
        source_type,
        canonical_url,
        doc_sha256,
        retrieved_at,
        scope_tags,
        created_at,
        updated_at
      FROM public.source_registry
      ORDER BY tier, publisher, title
    `);

    type SourceRow = {
      source_key: string; publisher: string; tier: number; title: string | null; publication_date: string | null;
      source_type: string | null; canonical_url: string | null; doc_sha256: string | null; retrieved_at: unknown;
      scope_tags: unknown; created_at: unknown; updated_at: unknown;
    };
    const sources = (allSourcesResult.rows as SourceRow[]).map((row) => ({
      ...row,
      scope_tags: Array.isArray(row.scope_tags) ? row.scope_tags : (row.scope_tags ? [row.scope_tags] : [])
    }));

    // Calculate statistics
    const stats = {
      total: sources.length,
      by_tier: {
        1: sources.filter((s) => s.tier === 1).length,
        2: sources.filter((s) => s.tier === 2).length,
        3: sources.filter((s) => s.tier === 3).length,
      },
      by_publisher: {} as Record<string, number>,
      by_type: {
        pdf: sources.filter((s) => s.source_type === 'pdf').length,
        web: sources.filter((s) => s.source_type === 'web').length,
        doc: sources.filter((s) => s.source_type === 'doc').length,
      },
      ingested: sources.filter((s) => s.doc_sha256 !== null).length,
      not_ingested: sources.filter((s) => s.doc_sha256 === null && s.canonical_url !== null).length,
    };

    // Count by publisher
    sources.forEach((source) => {
      const pub = source.publisher?.trim() && !isUnacceptablePublisher(source.publisher) ? source.publisher : '';
      stats.by_publisher[pub] = (stats.by_publisher[pub] || 0) + 1;
    });

    // Detect potential duplicates
    const duplicates: Array<{
      type: 'url' | 'publisher_title';
      sources: Array<{ source_key: string; publisher: string; title: string | null; canonical_url: string | null }>;
    }> = [];

    // Check for duplicate URLs
    const urlMap = new Map<string, Array<{ source_key: string; publisher: string; title: string | null }>>();
    sources.forEach((source) => {
      if (source.canonical_url) {
        const normalizedUrl = normalizeUrl(source.canonical_url);
        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl)!.push({
          source_key: source.source_key,
          publisher: source.publisher,
          title: source.title,
        });
      }
    });

    urlMap.forEach((sources, url) => {
      if (sources.length > 1) {
        duplicates.push({
          type: 'url',
          sources: sources.map(s => ({
            ...s,
            canonical_url: url,
          })),
        });
      }
    });

    // Check for duplicate publisher + title combinations
    const publisherTitleMap = new Map<string, Array<{ source_key: string; publisher: string; title: string | null; canonical_url: string | null }>>();
    sources.forEach((source) => {
      const key = `${source.publisher}|||${source.title}`.toLowerCase();
      if (!publisherTitleMap.has(key)) {
        publisherTitleMap.set(key, []);
      }
      publisherTitleMap.get(key)!.push({
        source_key: source.source_key,
        publisher: source.publisher,
        title: source.title,
        canonical_url: source.canonical_url,
      });
    });

    publisherTitleMap.forEach((sources) => {
      if (sources.length > 1) {
        duplicates.push({
          type: 'publisher_title',
          sources,
        });
      }
    });

    // Find sources missing critical information
    const missingInfo = {
      no_publisher: sources.filter((s) => !s.publisher || s.publisher.trim() === ''),
      no_title: sources.filter((s) => !s.title || (String(s.title).trim() === '')),
      no_url: sources.filter((s) => !s.canonical_url && s.source_type === 'web'),
      no_publication_date: sources.filter((s) => !s.publication_date),
      not_ingested_with_url: sources.filter((s) => s.canonical_url && !s.doc_sha256),
    };

    // Generate report date
    const reportDate = new Date().toISOString();

    return NextResponse.json({
      success: true,
      report_date: reportDate,
      summary: {
        statistics: stats,
        duplicates_count: duplicates.length,
        missing_info_count: {
          no_publisher: missingInfo.no_publisher.length,
          no_title: missingInfo.no_title.length,
          no_url: missingInfo.no_url.length,
          no_publication_date: missingInfo.no_publication_date.length,
          not_ingested_with_url: missingInfo.not_ingested_with_url.length,
        },
      },
      duplicates,
      missing_info: missingInfo,
      all_sources: sources.map((s) => ({
        source_key: s.source_key,
        publisher: s.publisher,
        tier: s.tier,
        title: s.title,
        publication_date: s.publication_date,
        source_type: s.source_type,
        canonical_url: s.canonical_url,
        ingested: s.doc_sha256 !== null,
        retrieved_at: s.retrieved_at,
        created_at: s.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/report GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Normalize URL for duplicate detection
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove www prefix
    if (urlObj.hostname.startsWith('www.')) {
      urlObj.hostname = urlObj.hostname.substring(4);
    }
    // Remove trailing slash from pathname
    urlObj.pathname = urlObj.pathname.replace(/\/$/, '');
    // Normalize to https (for comparison purposes)
    urlObj.protocol = 'https:';
    return urlObj.toString().toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

