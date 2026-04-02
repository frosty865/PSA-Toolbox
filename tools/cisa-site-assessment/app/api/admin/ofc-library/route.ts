import { NextRequest, NextResponse } from 'next/server';
import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { guardOFCRequiresCitations, guardCitationsNotEmpty } from '@/app/lib/citation/guards';
import { assertSourceKeysExistInCorpus } from '@/app/lib/citation/validateSourceKeys';
import type { Citation } from '@/app/lib/citation/validation';
import { assertOfcWriteAllowed } from '@/app/lib/ofc_write_guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ofc-library
 * Create a new OFC in the library (with citations)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      scope,
      sector,
      subsector,
      link_type,
      link_key,
      trigger_response,
      ofc_text,
      solution_role,
      status,
      citations
    } = body;

    // Validation
    if (!scope || !['BASELINE', 'SECTOR', 'SUBSECTOR'].includes(scope)) {
      return NextResponse.json(
        { error: 'scope is required and must be BASELINE, SECTOR, or SUBSECTOR' },
        { status: 400 }
      );
    }

    if (!link_type || !['PRIMARY_QUESTION', 'EXPANSION_QUESTION'].includes(link_type)) {
      return NextResponse.json(
        { error: 'link_type is required and must be PRIMARY_QUESTION or EXPANSION_QUESTION' },
        { status: 400 }
      );
    }

    if (!link_key || typeof link_key !== 'string') {
      return NextResponse.json(
        { error: 'link_key is required (string)' },
        { status: 400 }
      );
    }

    if (!ofc_text || typeof ofc_text !== 'string') {
      return NextResponse.json(
        { error: 'ofc_text is required (string)' },
        { status: 400 }
      );
    }

    if (!solution_role || !['PARTIAL', 'COMPLETE'].includes(solution_role)) {
      return NextResponse.json(
        { error: 'solution_role is required and must be PARTIAL or COMPLETE' },
        { status: 400 }
      );
    }

    // HARD GUARD: Citations required
    const citationsGuard = guardCitationsNotEmpty(citations);
    if (!citationsGuard.valid) {
      return NextResponse.json(
        { error: citationsGuard.error },
        { status: 400 }
      );
    }

    // Validate citation structure and source_keys
    const citationValidation = await guardOFCRequiresCitations(citations);
    if (!citationValidation.valid) {
      return NextResponse.json(
        { error: citationValidation.error },
        { status: 400 }
      );
    }

    // HARD GUARD: Assert all source_keys exist in CORPUS BEFORE any database writes
    // This prevents creating OFCs with invalid citations
    const sourceKeys = (citations as Citation[]).map(c => c.source_key).filter(Boolean);
    if (sourceKeys.length > 0) {
      try {
        await assertSourceKeysExistInCorpus(sourceKeys);
      } catch (error: unknown) {
        const err = error && typeof error === "object" ? error as { message?: string; missing_keys?: string[]; status?: number } : {};
        return NextResponse.json(
          {
            error: err.message ?? "Source key validation failed",
            missing_keys: err.missing_keys,
          },
          { status: err.status ?? 400 }
        );
      }
    }

    // Validate scope constraints
    if (scope === 'BASELINE' && (sector || subsector)) {
      return NextResponse.json(
        { error: 'BASELINE OFCs must not have sector or subsector' },
        { status: 400 }
      );
    }

    if (scope === 'SECTOR' && !sector) {
      return NextResponse.json(
        { error: 'SECTOR OFCs must have sector set' },
        { status: 400 }
      );
    }

    if (scope === 'SECTOR' && subsector) {
      return NextResponse.json(
        { error: 'SECTOR OFCs must not have subsector' },
        { status: 400 }
      );
    }

    if (scope === 'SUBSECTOR' && (!sector || !subsector)) {
      return NextResponse.json(
        { error: 'SUBSECTOR OFCs must have both sector and subsector set' },
        { status: 400 }
      );
    }

    assertOfcWriteAllowed({ source: 'ADMIN_AUTHORING' });

    const pool = getRuntimePool();

    // Insert OFC (all citations validated above - no partial writes possible)
    const ofcResult = await pool.query(
      `INSERT INTO public.ofc_library (
        scope,
        sector,
        subsector,
        link_type,
        link_key,
        trigger_response,
        ofc_text,
        solution_role,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING ofc_id`,
      [
        scope,
        sector || null,
        subsector || null,
        link_type,
        link_key,
        trigger_response || 'NO',
        ofc_text,
        solution_role,
        status || 'ACTIVE'
      ]
    );

    const ofcId = ofcResult.rows[0].ofc_id;

    // Insert citations (all source_keys validated above)
    for (const citation of citations as Citation[]) {
      await pool.query(
        `INSERT INTO public.ofc_library_citations (
          ofc_id,
          source_key,
          locator_type,
          locator,
          excerpt,
          retrieved_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          ofcId,
          citation.source_key,
          citation.locator_type,
          citation.locator,
          citation.excerpt,
          citation.retrieved_at || null
        ]
      );
    }

    return NextResponse.json({
      success: true,
      ofc_id: ofcId,
      citations_added: citations.length
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API /api/admin/ofc-library POST] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create OFC',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

