import { NextRequest, NextResponse } from 'next/server';
import { getCorpusPool } from '@/app/lib/db/corpus_client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/diagnostics/candidates/source-type-counts
 * 
 * Returns counts and samples of OFC candidates grouped by ofc_origin (MODULE vs CORPUS).
 * This diagnostic endpoint proves contamination is fixed.
 * 
 * Returns:
 * {
 *   ok: true,
 *   counts: {
 *     MODULE: <n>,
 *     CORPUS: <n>,
 *     OTHER: <n>
 *   },
 *   sample: {
 *     MODULE: [ {id, title, status, created_at, ofc_origin} ... ],
 *     CORPUS: [ ... ],
 *     OTHER: [ ... ]
 *   }
 * }
 */
export async function GET(
   
  _request: NextRequest
) {
  try {
    const pool = getCorpusPool();
    
    // ofc_origin is now REQUIRED (NOT NULL + CHECK) - guaranteed to exist after migration
    // Get counts by ofc_origin
    const countsResult = await pool.query(`
      SELECT 
        ofc_origin,
        COUNT(*) as count
      FROM public.ofc_candidate_queue
      GROUP BY ofc_origin
      ORDER BY ofc_origin
    `);
    
    const counts: Record<string, number> = {
      MODULE: 0,
      CORPUS: 0,
      OTHER: 0
    };
    
    countsResult.rows.forEach((row: Record<string, unknown>) => {
      const origin = row.ofc_origin; // NOT NULL - no need for fallback
      if (origin === 'MODULE' || origin === 'CORPUS') {
        counts[origin] = parseInt(String(row.count ?? 0), 10);
      } else {
        counts.OTHER += parseInt(String(row.count ?? 0), 10);
      }
    });
    
    // Get samples (up to 5 per origin)
    const sampleResult = await pool.query(`
      SELECT 
        candidate_id::text as id,
        title,
        status,
        created_at,
        ofc_origin,
        snippet_text
      FROM public.ofc_candidate_queue
      WHERE ofc_origin IN ('MODULE', 'CORPUS')
      ORDER BY ofc_origin, created_at DESC
    `);
    
    interface SampleItem { id: string; title: string | null; status: string; created_at: string; ofc_origin: string; snippet_preview: string | null }
    const sample: Record<string, SampleItem[]> = {
      MODULE: [],
      CORPUS: [],
      OTHER: []
    };
    
    const sampleLimit = 5;
    const moduleSamples: SampleItem[] = [];
    const corpusSamples: SampleItem[] = [];
    const otherSamples: SampleItem[] = [];
    
    sampleResult.rows.forEach((row: Record<string, unknown>) => {
      const origin = row.ofc_origin; // NOT NULL - no need for fallback
      const sampleItem: SampleItem = {
        id: String(row.id ?? ''),
        title: row.title != null ? String(row.title) : null,
        status: String(row.status ?? ''),
        created_at: String(row.created_at ?? ''),
        ofc_origin: String(origin),
        snippet_preview: row.snippet_text != null ? (String(row.snippet_text).substring(0, 100) + (String(row.snippet_text).length > 100 ? '...' : '')) : null
      };
      
      if (origin === 'MODULE' && moduleSamples.length < sampleLimit) {
        moduleSamples.push(sampleItem);
      } else if (origin === 'CORPUS' && corpusSamples.length < sampleLimit) {
        corpusSamples.push(sampleItem);
      } else if (origin !== 'MODULE' && origin !== 'CORPUS' && otherSamples.length < sampleLimit) {
        otherSamples.push(sampleItem);
      }
    });
    
    sample.MODULE = moduleSamples;
    sample.CORPUS = corpusSamples;
    sample.OTHER = otherSamples;
    
    // Check for contamination: MODULE candidates that might be CORPUS-derived
    const contaminationCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM public.ofc_candidate_queue ocq
      JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
      WHERE ocq.ofc_origin = 'MODULE'
        AND cs.source_type NOT IN ('OTHER', 'GUIDE')
        AND cs.title != 'MODULE RESEARCH'
    `);
    
    const contaminationCount = parseInt(contaminationCheck.rows[0]?.count || '0', 10);
    
    return NextResponse.json({
      ok: true,
      counts,
      sample,
      contamination_check: {
        suspicious_module_candidates: contaminationCount,
        note: contaminationCount > 0 
          ? `Warning: ${contaminationCount} MODULE candidates are linked to non-MODULE sources. This may indicate contamination.`
          : 'No contamination detected: All MODULE candidates are linked to MODULE sources or OTHER/GUIDE sources.'
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
    
  } catch (error: unknown) {
    console.error('[API /api/admin/diagnostics/candidates/source-type-counts GET] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch source type counts',
        message: error instanceof Error ? error.message : 'Unknown error',
        counts: {},
        sample: {}
      },
      { status: 500 }
    );
  }
}

