import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/runtime/ofc-library/[ofcId]/citations
 * 
 * Returns citations for a specific OFC library entry.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ofcId: string }> }
) {
  try {
    const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
    const { ofcId } = await params;

    if (!ofcId) {
      return NextResponse.json(
        { error: 'ofcId parameter is required' },
        { status: 400 }
      );
    }

    const runtimePool = getRuntimePool();
    const corpusPool = getCorpusPool();

    // STEP 1: Fetch all citations for ofcId in ONE query from RUNTIME
    const citationsResult = await runtimePool.query(`
      SELECT 
        olc.ofc_id,
        olc.source_key,
        olc.source_id,
        olc.excerpt,
        olc.locator,
        olc.page_locator,
        olc.locator_type,
        olc.retrieved_at,
        COALESCE(olc.order_index, 0) as order_index,
        COALESCE(olc.created_at, NOW()) as created_at
      FROM public.ofc_library_citations olc
      WHERE olc.ofc_id = $1
    `, [ofcId]);

    if (citationsResult.rows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    // Extract distinct source_keys and source_ids for batch fetching
    const sourceKeys = [...new Set(citationsResult.rows.map((r) => asString((r as Record<string, unknown>).source_key)).filter((v): v is string => !!v))];
    const sourceIds = [...new Set(citationsResult.rows.map((r) => asString((r as Record<string, unknown>).source_id)).filter((v): v is string => !!v))];

    // STEP 2: Batch fetch from CORPUS database (1-2 queries total)
    
    // Fetch all source_registry entries in ONE query using ANY() for efficiency
    const sourceRegistryMap = new Map<string, Record<string, unknown>>();
    if (sourceKeys.length > 0) {
      const sourceRegistryResult = await corpusPool.query(
        `SELECT * FROM public.source_registry WHERE source_key = ANY($1::text[])`,
        [sourceKeys]
      );
      sourceRegistryResult.rows.forEach((sr: Record<string, unknown>) => {
        const sourceKey = asString(sr.source_key);
        if (!sourceKey) return;
        sourceRegistryMap.set(sourceKey, {
          source_key: sourceKey, // Include source_key for provenance display
          source_title: sr.title,
          source_publisher: sr.publisher,
          source_published_date: sr.publication_date,
          source_type: sr.source_type,
          canonical_url: sr.canonical_url,
          source_tier: sr.tier
        });
      });
    }

    // Fetch all canonical_sources entries in ONE query (legacy fallback) using ANY()
    const canonicalSourcesMap = new Map<string, Record<string, unknown>>();
    if (sourceIds.length > 0) {
      const canonicalResult = await corpusPool.query(
        `SELECT * FROM public.canonical_sources WHERE source_id = ANY($1::uuid[])`,
        [sourceIds]
      );
      canonicalResult.rows.forEach((cs: Record<string, unknown>) => {
        const sourceId = asString(cs.source_id);
        if (!sourceId) return;
        canonicalSourcesMap.set(sourceId, {
          source_title: cs.title,
          source_publisher: cs.publisher,
          source_published_date: cs.published_date,
          source_type: cs.source_type,
          canonical_url: cs.uri,
          citation_text: cs.citation_text
        });
      });
    }

    // STEP 3: Join citation data with source data and detect missing source_keys
    const missingSourceKeys: string[] = [];
    type CitationMerged = Record<string, unknown> & {
      order_index?: number;
      created_at?: string | null;
      _sort_order: number;
      _created_at?: string | null;
    };
    const citations: CitationMerged[] = citationsResult.rows.map((citation: Record<string, unknown>, index: number) => {
      let sourceData: Record<string, unknown> = {};
      
      // Try source_registry first (new schema)
      const citationSourceKey = asString(citation.source_key);
      const citationSourceId = asString(citation.source_id);
      if (citationSourceKey) {
        if (sourceRegistryMap.has(citationSourceKey)) {
          sourceData = sourceRegistryMap.get(citationSourceKey) ?? {};
        } else {
          // Missing source_key in CORPUS - should not happen after validation
          missingSourceKeys.push(citationSourceKey);
        }
      }
      // Fallback to canonical_sources (legacy schema)
      else if (citationSourceId) {
        if (canonicalSourcesMap.has(citationSourceId)) {
          sourceData = canonicalSourcesMap.get(citationSourceId) ?? {};
        }
        // Note: Missing source_id is OK (legacy data may be incomplete)
      }
      
      return {
        ...citation,
        ...sourceData,
        _sort_order: Number(citation.order_index ?? index), // Preserve original order for stable sorting
        _created_at: asString(citation.created_at)
      };
    });

    // STEP 4: Handle missing source_keys (integrity violation)
    if (missingSourceKeys.length > 0) {
      console.error(
        `[API /api/runtime/ofc-library/[ofcId]/citations] Integrity violation: ` +
        `Citations reference source_keys missing from CORPUS: ${missingSourceKeys.join(', ')}. ` +
        `Run integrity audit: GET /api/admin/citations/integrity-audit`
      );
      return NextResponse.json(
        {
          error: 'Citation integrity violation detected',
          message: `Citations reference source_keys missing from CORPUS registry: ${missingSourceKeys.join(', ')}`,
          missing_source_keys: missingSourceKeys,
          audit_hint: 'Run integrity audit: GET /api/admin/citations/integrity-audit'
        },
        { status: 500 }
      );
    }

    // STEP 5: Stable ordering - by order_index if present, else created_at
    citations.sort((a, b) => {
      // Primary: order_index (if present)
      if (a.order_index !== undefined && b.order_index !== undefined) {
        if (a.order_index !== b.order_index) {
          return a.order_index - b.order_index;
        }
      } else if (a.order_index !== undefined) {
        return -1; // a has order_index, b doesn't - a comes first
      } else if (b.order_index !== undefined) {
        return 1; // b has order_index, a doesn't - b comes first
      }
      
      // Secondary: created_at (stable timestamp ordering)
      const createdAtA = new Date(a._created_at || asString(a.created_at) || 0).getTime();
      const createdAtB = new Date(b._created_at || asString(b.created_at) || 0).getTime();
      if (createdAtA !== createdAtB) {
        return createdAtA - createdAtB;
      }
      
      // Tertiary: preserve original array order (stable fallback)
      return (a._sort_order ?? 0) - (b._sort_order ?? 0);
    });

    // Remove internal sorting fields before returning
     
    const cleanedCitations = citations.map(({ _sort_order, _created_at, ...citation }) => citation);

    return NextResponse.json(cleanedCitations, { status: 200 });

  } catch (error) {
    console.error('[API /api/runtime/ofc-library/[ofcId]/citations GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch OFC citations',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

