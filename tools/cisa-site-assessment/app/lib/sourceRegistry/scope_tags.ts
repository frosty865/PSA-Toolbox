/**
 * Strict scope_tags schema for source_registry.
 * ONLY canonical taxonomy codes (sector/subsector) and module codes.
 * No free-text categories; no string tags.
 */

import type { SectorTaxonomyResult } from '@/app/lib/taxonomy/get_sector_taxonomy';

export type ScopeTag =
  | { type: 'sector'; code: string }
  | { type: 'subsector'; code: string }
  | { type: 'module'; code: string };

const ALLOWED_TYPES = new Set<string>(['sector', 'subsector', 'module']);

export function isScopeTag(x: unknown): x is ScopeTag {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  const type = o.type;
  const code = o.code;
  return (
    typeof type === 'string' &&
    ALLOWED_TYPES.has(type) &&
    typeof code === 'string' &&
    code.trim() !== ''
  );
}

/**
 * Normalize raw scope_tags from DB to ScopeTag[].
 * - Non-arrays => []
 * - Strings => DROP (never allow string tags)
 * - Objects missing type/code or invalid type => DROP
 * - De-dup by (type, code)
 */
export function normalizeScopeTags(raw: unknown): ScopeTag[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ScopeTag[] = [];
  for (const item of raw) {
    if (typeof item === 'string') continue;
    if (!isScopeTag(item)) continue;
    const key = `${item.type}:${item.code.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: item.type, code: item.code.trim() });
  }
  return out;
}

/**
 * Filter tags to taxonomy; enforce sector–subsector consistency.
 * - sector tags: keep only if code in taxonomy.sectors[].code
 * - subsector tags: keep only if code in taxonomy.subsectors[].code and sector matches
 * - if subsector present, sector is set to subsector.sector_code
 * - module tags: keep untouched
 */
export function filterScopeTagsToTaxonomy(
  tags: ScopeTag[],
  taxonomy: SectorTaxonomyResult
): ScopeTag[] {
  const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
  const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];
  const validSectorCodes = new Set(sectors.map((s) => s.code));
  const validSubsectorCodes = new Set(subsectors.map((s) => s.code));
  const subsectorToSector = new Map(subsectors.map((s) => [s.code, s.sector_code]));

  const sectorTags = tags.filter((t) => t.type === 'sector' && validSectorCodes.has(t.code));
  const subsectorTags = tags.filter(
    (t) => t.type === 'subsector' && validSubsectorCodes.has(t.code)
  );
  const moduleTags = tags.filter((t) => t.type === 'module');

  const out: ScopeTag[] = [];
  let sectorCode: string | null = sectorTags.length > 0 ? sectorTags[0].code : null;
  if (subsectorTags.length > 0) {
    const implied = subsectorToSector.get(subsectorTags[0].code);
    if (implied && validSectorCodes.has(implied)) {
      sectorCode = implied;
      out.push({ type: 'sector', code: implied });
    } else if (sectorCode) {
      out.push({ type: 'sector', code: sectorCode });
    }
  } else if (sectorCode) {
    out.push({ type: 'sector', code: sectorCode });
  }
  for (const t of subsectorTags) {
    out.push(t);
  }
  for (const t of moduleTags) {
    out.push(t);
  }
  return out;
}

/**
 * Merge existing scope_tags with new sector/subsector (codes only), then normalize and filter.
 * Use this as the only way to write scope_tags when applying metadata or UI updates.
 */
export function upsertSectorSubsectorTags(
  existingRawScopeTags: unknown,
  sectorCodeOrNull: string | null,
  subsectorCodeOrNull: string | null,
  taxonomy: SectorTaxonomyResult
): ScopeTag[] {
  let tags = normalizeScopeTags(existingRawScopeTags);
  if (sectorCodeOrNull != null && String(sectorCodeOrNull).trim() !== '') {
    const code = String(sectorCodeOrNull).trim();
    tags = tags.filter((t) => !(t.type === 'sector'));
    tags.unshift({ type: 'sector', code });
  }
  if (subsectorCodeOrNull != null && String(subsectorCodeOrNull).trim() !== '') {
    const code = String(subsectorCodeOrNull).trim();
    tags = tags.filter((t) => !(t.type === 'subsector'));
    const sectorIdx = tags.findIndex((t) => t.type === 'sector');
    if (sectorIdx >= 0) {
      tags.splice(sectorIdx + 1, 0, { type: 'subsector', code });
    } else {
      tags.push({ type: 'subsector', code });
    }
  }
  return filterScopeTagsToTaxonomy(tags, taxonomy);
}

/**
 * Resolve ScopeTag[] to display strings for UI: sector name, subsector name, module codes.
 * Returns ["—"] when no valid sector/subsector/module tags.
 */
export function scopeTagsToDisplayNames(
  tags: ScopeTag[],
  taxonomy: SectorTaxonomyResult
): string[] {
  const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
  const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];
  const sectorByCode = new Map(sectors.map((s) => [s.code, s.name]));
  const subsectorByCode = new Map(subsectors.map((s) => [s.code, s.name]));
  const sectorTag = tags.find((t) => t.type === 'sector');
  const subsectorTag = tags.find((t) => t.type === 'subsector');
  const moduleTags = tags.filter((t) => t.type === 'module');
  const out: string[] = [];
  if (sectorTag) {
    out.push(sectorByCode.get(sectorTag.code) ?? sectorTag.code);
  }
  if (subsectorTag) {
    out.push(subsectorByCode.get(subsectorTag.code) ?? subsectorTag.code);
  }
  for (const t of moduleTags) {
    out.push(t.code);
  }
  return out.length > 0 ? out : ['—'];
}

/**
 * Convert legacy string[] (sector/subsector/module codes) to ScopeTag[], then filter to taxonomy.
 * Used by inferScopeTags and rerun-scope-tags to write strict ScopeTag[].
 */
export function scopeTagsFromStrings(
  strings: string[],
  taxonomy: SectorTaxonomyResult,
  moduleCodes: Set<string>
): ScopeTag[] {
  const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
  const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];
  const sectorCodes = new Set(sectors.map((s) => s.code));
  const subsectorCodes = new Set(subsectors.map((s) => s.code));
  const out: ScopeTag[] = [];
  for (const s of strings) {
    const t = s.trim();
    if (!t) continue;
    if (sectorCodes.has(t)) out.push({ type: 'sector', code: t });
    else if (subsectorCodes.has(t)) out.push({ type: 'subsector', code: t });
    else if (moduleCodes.has(t)) out.push({ type: 'module', code: t });
  }
  return filterScopeTagsToTaxonomy(out, taxonomy);
}

/** Extract string list from legacy scope_tags (array of strings or object with display/tags). */
function extractLegacyScopeTagStrings(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const out: string[] = [];
    if (Array.isArray(obj.display)) {
      obj.display.forEach((t) => {
        if (typeof t === 'string' && t.trim()) out.push(t.trim());
      });
    }
    const tags = obj.tags;
    if (Array.isArray(tags)) {
      tags.forEach((t) => {
        if (typeof t === 'string' && t.trim()) out.push(t.trim());
        else if (t && typeof t === 'object' && typeof (t as { name?: string }).name === 'string') out.push((t as { name: string }).name);
      });
    } else if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
      const tagObj = tags as Record<string, unknown>;
      if (tagObj.library !== 'technology') {
        if (typeof tagObj.sector === 'string' && tagObj.sector.trim()) out.push(tagObj.sector.trim());
        if (typeof tagObj.subsector === 'string' && tagObj.subsector.trim()) out.push(tagObj.subsector.trim());
        Object.values(tagObj).forEach((v) => {
          if (typeof v === 'string' && v.trim()) out.push(v.trim());
        });
      }
    }
    if (typeof obj.sector === 'string' && obj.sector.trim()) out.push(obj.sector.trim());
    if (typeof obj.subsector === 'string' && obj.subsector.trim()) out.push(obj.subsector.trim());
    return out;
  }
  return [];
}

/**
 * Display names for legacy scope_tags (string array or old object shape). Sector and subsector.
 */
export function legacyScopeTagsToDisplayNames(raw: unknown, taxonomy: SectorTaxonomyResult): string[] {
  const strings = extractLegacyScopeTagStrings(raw);
  if (strings.length === 0) return ['—'];
  const sectors = Array.isArray(taxonomy?.sectors) ? taxonomy.sectors : [];
  const subsectors = Array.isArray(taxonomy?.subsectors) ? taxonomy.subsectors : [];
  const sectorByCode = new Map(sectors.map((s) => [s.code, s.name]));
  const sectorByName = new Map(sectors.map((s) => [s.name.toLowerCase().trim(), s.name]));
  const subsectorByCode = new Map(subsectors.map((s) => [s.code, s.name]));
  const subsectorByName = new Map(subsectors.map((s) => [s.name.toLowerCase().trim(), s.name]));
  let sectorName: string | null = null;
  let subsectorName: string | null = null;
  for (const t of strings) {
    const key = t.toLowerCase().trim();
    if (!sectorName && (sectorByCode.get(t) || sectorByName.get(key))) {
      sectorName = sectorByCode.get(t) ?? sectorByName.get(key) ?? null;
    }
    if (!subsectorName && (subsectorByCode.get(t) || subsectorByName.get(key))) {
      subsectorName = subsectorByCode.get(t) ?? subsectorByName.get(key) ?? null;
    }
  }
  const out: string[] = [];
  if (sectorName) out.push(sectorName);
  if (subsectorName) out.push(subsectorName);
  return out.length > 0 ? out : ['—'];
}
