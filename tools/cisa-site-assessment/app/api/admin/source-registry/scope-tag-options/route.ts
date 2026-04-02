import { NextResponse } from 'next/server';
import { getAllowedScopeTagValues, FALLBACK_TITLE_TAG, isNumericTag, type SectorOption, type SubsectorOption } from '@/app/lib/sourceRegistry/scopeTags';

export const dynamic = 'force-dynamic';

/** Max scope tags per source (precedence: sector → subsector → module). */
const MAX_SCOPE_TAGS = 2;

/** Exclude purely numeric strings from scope tag list (dropdown must not show numbers). */
function dropNumeric(arr: string[]): string[] {
  return arr.filter((s) => typeof s === 'string' && s.trim() !== '' && !isNumericTag(s));
}

function dropNumericSectorOptions(arr: SectorOption[]): SectorOption[] {
  return arr.filter((o) => !isNumericTag(o.value) && !isNumericTag(o.label));
}

function dropNumericSubsectorOptions(arr: SubsectorOption[]): SubsectorOption[] {
  return arr.filter((o) => !isNumericTag(o.value) && !isNumericTag(o.label));
}

/**
 * GET /api/admin/source-registry/scope-tag-options
 * Returns allowed scope tag values: discipline, subtype, module, sector (value/label), subsector (value/label/sector_id), plus fallback.
 * Subsectors include sector_id so the UI can filter by selected sector.
 */
export async function GET() {
  try {
    const allowed = await getAllowedScopeTagValues();
    return NextResponse.json({
      ok: true,
      maxScopeTags: MAX_SCOPE_TAGS,
      disciplines: dropNumeric(Array.from(allowed.disciplineCodes).sort()),
      subtypes: dropNumeric(Array.from(allowed.subtypeCodes).sort()),
      modules: dropNumeric(Array.from(allowed.moduleCodes).sort()),
      sectors: dropNumericSectorOptions(allowed.sectorOptions),
      subsectors: dropNumericSubsectorOptions(allowed.subsectorOptions),
      fallback: dropNumeric([FALLBACK_TITLE_TAG]),
    });
  } catch (error: unknown) {
    console.error('[API /api/admin/source-registry/scope-tag-options GET] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch scope tag options',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

