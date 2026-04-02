/**
 * Load sectors and subsectors from RUNTIME (canonical taxonomy).
 * CORPUS-only metadata extraction uses this for sector/subsector validation.
 * No hardcoding; no invention.
 */

import { getRuntimePool } from '@/app/lib/db/runtime_client';

export type SectorTaxonomy = { code: string; name: string };
export type SubsectorTaxonomy = { code: string; sector_code: string; name: string };

export type SectorTaxonomyResult = {
  sectors: SectorTaxonomy[];
  subsectors: SubsectorTaxonomy[];
};

/**
 * Load sectors and subsectors from RUNTIME public.sectors and public.subsectors.
 */
export async function getSectorTaxonomy(): Promise<SectorTaxonomyResult> {
  const pool = getRuntimePool();
  const [sectorsResult, subsectorsResult] = await Promise.all([
    pool.query<{ id: string; sector_name: string | null; name: string | null }>(
      `SELECT id, sector_name, name FROM public.sectors WHERE id IS NOT NULL AND (is_active = true OR is_active IS NULL) ORDER BY COALESCE(sector_name, name, id)`
    ),
    pool.query<{ id: string; name: string | null; sector_id: string | null }>(
      `SELECT id, name, sector_id FROM public.subsectors WHERE id IS NOT NULL AND is_active = true ORDER BY name`
    ),
  ]);

  const sectors: SectorTaxonomy[] = (sectorsResult.rows ?? [])
    .filter((r) => r.id?.trim())
    .map((r) => ({
      code: r.id.trim(),
      name: (r.sector_name ?? r.name ?? r.id).trim(),
    }));

  const subsectors: SubsectorTaxonomy[] = (subsectorsResult.rows ?? [])
    .filter((r) => r.id?.trim())
    .map((r) => ({
      code: r.id.trim(),
      sector_code: (r.sector_id != null && r.sector_id !== '' ? String(r.sector_id).trim() : ''),
      name: (r.name ?? r.id).trim(),
    }));

  return { sectors, subsectors };
}
