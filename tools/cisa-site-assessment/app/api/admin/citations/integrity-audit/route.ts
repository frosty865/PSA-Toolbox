import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/citations/integrity-audit
 * 
 * Audits citation integrity across CORPUS and RUNTIME databases.
 * Returns statistics and identifies any source_keys referenced in citations
 * that don't exist in CORPUS source_registry.
 */
export async function GET(
   
  _request: NextRequest
) {
  try {
    const toStringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

    let runtimePool;
    let corpusPool;
    try {
      runtimePool = getRuntimePool();
      corpusPool = getCorpusPool();
    } catch (poolError) {
      const msg = poolError instanceof Error ? poolError.message : String(poolError);
      console.error('[API /api/admin/citations/integrity-audit GET] Pool error:', poolError);
      return NextResponse.json(
        {
          error: 'Database unavailable',
          message: msg,
          hint: 'Ensure RUNTIME_DATABASE_URL and CORPUS_DATABASE_URL (or CORPUS_DATABASE_URL) are set and reachable.'
        },
        { status: 503 }
      );
    }

    // Check if ofc_library_citations exists in RUNTIME
    const tableCheck = await runtimePool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ofc_library_citations'
      ) AS table_exists
    `);
    if (!tableCheck.rows[0]?.table_exists) {
      return NextResponse.json(
        {
          error: 'Table not found',
          message: 'public.ofc_library_citations does not exist in RUNTIME',
          hint: 'Run database migrations to create ofc_library_citations in the RUNTIME database.'
        },
        { status: 503 }
      );
    }

    // Query RUNTIME: Get all distinct source_keys from citations
    const citationsResult = await runtimePool.query(`
      SELECT DISTINCT source_key 
      FROM public.ofc_library_citations 
      WHERE source_key IS NOT NULL
    `);

    const citationSourceKeys = (citationsResult.rows || [])
      .map((r: Record<string, unknown>) => toStringOrNull(r.source_key))
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    const distinctSourceKeys = [...new Set(citationSourceKeys)];

    // Get total citation count
    const countResult = await runtimePool.query(`
      SELECT COUNT(*) as total 
      FROM public.ofc_library_citations 
      WHERE source_key IS NOT NULL
    `);
    const totalCitations = parseInt(countResult.rows?.[0]?.total ?? '0', 10) || 0;

    // Query CORPUS: Check which source_keys exist in source_registry
    let missingInCorpus: string[] = [];
    
    if (distinctSourceKeys.length > 0) {
      const corpusResult = await corpusPool.query(
        `SELECT source_key FROM public.source_registry WHERE source_key = ANY($1::text[])`,
        [distinctSourceKeys]
      );

      const foundKeys = new Set(
        corpusResult.rows
          .map((r: Record<string, unknown>) => toStringOrNull(r.source_key))
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      );
      missingInCorpus = distinctSourceKeys.filter(key => !foundKeys.has(key));
    }

    // Get total sources in registry
    const registryCountResult = await corpusPool.query(`
      SELECT COUNT(*) as total FROM public.source_registry
    `);
    const totalSourcesInRegistry = parseInt(registryCountResult.rows?.[0]?.total ?? '0', 10) || 0;

    // Fetch sample orphan citations (up to 25 rows) for missing source_keys
    let sampleOrphans: Array<{ ofc_id: string; source_key: string; created_at: string | null }> = [];
    if (missingInCorpus.length > 0) {
      const orphansResult = await runtimePool.query(`
        SELECT 
          olc.ofc_id,
          olc.source_key,
          olc.created_at
        FROM public.ofc_library_citations olc
        WHERE olc.source_key = ANY($1::text[])
        ORDER BY olc.created_at DESC NULLS LAST
        LIMIT 25
      `, [missingInCorpus]);

      sampleOrphans = orphansResult.rows
        .map((r: Record<string, unknown>) => {
          const ofcId = toStringOrNull(r.ofc_id);
          const sourceKey = toStringOrNull(r.source_key);
          const createdAt = toStringOrNull(r.created_at);
          if (!ofcId || !sourceKey) return null;
          return {
            ofc_id: ofcId,
            source_key: sourceKey,
            created_at: createdAt ? new Date(createdAt).toISOString() : null
          };
        })
        .filter((v): v is { ofc_id: string; source_key: string; created_at: string | null } => v !== null);
    }

    return NextResponse.json({
      integrity_ok: missingInCorpus.length === 0,
      total_citations: totalCitations,
      distinct_source_keys: distinctSourceKeys.length,
      total_sources_in_registry: totalSourcesInRegistry,
      missing_in_corpus: missingInCorpus,
      missing_count: missingInCorpus.length,
      sample_orphans: sampleOrphans
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API /api/admin/citations/integrity-audit GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to audit citation integrity',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

