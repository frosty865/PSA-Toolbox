/**
 * Overlay Loader
 * 
 * Loads sector/subsector overlay spines from overlay_spines_runtime table.
 * Overlays are additive questions that apply when an assessment has sector/subsector assigned.
 */

import { ensureRuntimePoolConnected } from './db/runtime_client';
import { getSubtypeInfo, getDisciplineName } from './taxonomy/subtype_guidance';

export type OverlaySpine = {
  canon_id: string;
  layer: 'SECTOR' | 'SUBSECTOR';
  sector_id: string | null;
  subsector_id: string | null;
  discipline_code: string;
  subtype_code?: string | null;
  discipline_subtype_id?: string | null;
  question_text: string;
  response_enum: ["YES", "NO", "N_A"];
  order_index: number;
  // Guidance content derived from taxonomy at runtime (not stored in DB)
  subtype_name?: string | null;
  subtype_guidance?: unknown;
  discipline_name?: string | null;
};

/**
 * Load overlay spines for a given sector/subsector.
 * 
 * @param sectorId - Sector ID (TEXT code from sectors.id). If provided, loads SECTOR layer overlays.
 * @param subsectorId - Subsector ID (TEXT code from subsectors.id). If provided, loads SUBSECTOR layer overlays.
 * @param activeOnly - Only return active overlays (default: true)
 * @returns Array of overlay spine objects
 */
export async function loadOverlays(
  sectorId: string | null,
  subsectorId: string | null,
  activeOnly: boolean = true
): Promise<OverlaySpine[]> {
  const pool = await ensureRuntimePoolConnected();
  
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (activeOnly) {
    conditions.push('is_active = true');
  }

  // Build query for SECTOR layer overlays
  if (sectorId) {
    conditions.push(`(layer = 'SECTOR' AND sector_id = $${paramIndex})`);
    params.push(sectorId);
    paramIndex++;
  }

  // Build query for SUBSECTOR layer overlays
  if (subsectorId) {
    conditions.push(`(layer = 'SUBSECTOR' AND subsector_id = $${paramIndex})`);
    params.push(subsectorId);
    paramIndex++;
  }

  // If no sector/subsector provided, return empty array
  if (conditions.length === (activeOnly ? 1 : 0)) {
    return [];
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' OR ')}` : '';
  
  const query = `
    SELECT 
      canon_id,
      layer,
      sector_id,
      subsector_id,
      discipline_code,
      subtype_code,
      discipline_subtype_id,
      question_text,
      response_enum,
      order_index
    FROM public.overlay_spines_runtime
    ${whereClause}
    ORDER BY discipline_code, layer, order_index, canon_id
  `;

  const result = await pool.query(query, params);
  
  // Map rows to OverlaySpine objects with runtime guidance
  const spines: OverlaySpine[] = result.rows.map((row: Record<string, unknown>) => {
    // Parse response_enum (stored as jsonb)
    let responseEnum = row.response_enum;
    if (typeof responseEnum === 'string') {
      try {
        responseEnum = JSON.parse(responseEnum);
      } catch {
        responseEnum = ["YES", "NO", "N_A"];
      }
    }
    if (!Array.isArray(responseEnum) || responseEnum.length !== 3) {
      responseEnum = ["YES", "NO", "N_A"];
    }

    // Attach subtype guidance and names from taxonomy at runtime
    const subtypeCode = typeof row.subtype_code === 'string' ? row.subtype_code : null;
    const disciplineCode = typeof row.discipline_code === 'string' ? row.discipline_code : '';
    const subtypeInfo = subtypeCode ? getSubtypeInfo(subtypeCode) : null;
    const subtypeGuidance = subtypeInfo?.guidance || null;
    const subtypeName = subtypeInfo?.name || null;
    
    // Get discipline_name
    const disciplineName = getDisciplineName(disciplineCode);

    return {
      canon_id: String(row.canon_id ?? ''),
      layer: row.layer as 'SECTOR' | 'SUBSECTOR',
      sector_id: typeof row.sector_id === 'string' ? row.sector_id : null,
      subsector_id: typeof row.subsector_id === 'string' ? row.subsector_id : null,
      discipline_code: disciplineCode,
      subtype_code: subtypeCode,
      discipline_subtype_id: typeof row.discipline_subtype_id === 'string' ? row.discipline_subtype_id : null,
      question_text: String(row.question_text ?? ''),
      response_enum: responseEnum as ["YES", "NO", "N_A"],
      order_index: Number(row.order_index) || 0,
      subtype_name: subtypeName,
      subtype_guidance: subtypeGuidance,
      discipline_name: disciplineName
    };
  });

  return spines;
}
