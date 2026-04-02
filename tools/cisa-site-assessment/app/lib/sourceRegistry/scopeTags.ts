/**
 * Scope tags: only discipline, subtype, module, sector, or subsector.
 * Fetches allowed values from RUNTIME and validates/filters scope_tags.
 * Precedence for display/storage: Sector → Subsector → Discipline → Subtype. Max 2 tags.
 * "Physical Security" is allowed as fallback when none found and it appears in the title.
 */

import { getRuntimePool } from '@/app/lib/db/runtime_client';

/** Fallback tag when no sector/subsector/discipline/subtype found and title contains "physical security". */
export const FALLBACK_TITLE_TAG = 'Physical Security';

const ALLOWED_FALLBACK_TAGS = new Set([FALLBACK_TITLE_TAG]);

export type SectorOption = { value: string; label: string };
export type SubsectorOption = { value: string; label: string; sector_id: string };

export type ScopeTagAllowedSets = {
  disciplineCodes: Set<string>;
  subtypeCodes: Set<string>;
  moduleCodes: Set<string>;
  sectorIds: Set<string>;
  subsectorIds: Set<string>;
  /** Sector dropdown: value = id, label = sector_name or name. */
  sectorOptions: SectorOption[];
  /** Subsector dropdown: value = id (or name), label = name, sector_id for filtering. */
  subsectorOptions: SubsectorOption[];
  /** @deprecated Use sectorOptions; kept for compatibility. */
  sectorLabels: string[];
  /** @deprecated Use subsectorOptions; kept for compatibility. */
  subsectorLabels: string[];
};

/**
 * Fetch all allowed scope tag values from RUNTIME (disciplines, discipline_subtypes,
 * assessment_modules, sectors, subsectors). Used for validation and display filtering.
 */
export async function getAllowedScopeTagValues(): Promise<ScopeTagAllowedSets> {
  const pool = getRuntimePool();
  const disciplineCodes = new Set<string>();
  const subtypeCodes = new Set<string>();
  const moduleCodes = new Set<string>();
  const sectorIds = new Set<string>();
  const subsectorIds = new Set<string>();
  const sectorOptions: SectorOption[] = [];
  const subsectorOptions: SubsectorOption[] = [];
  const sectorLabels: string[] = [];
  const subsectorLabels: string[] = [];

  try {
    const [disc, sub, mod, sec, subsec] = await Promise.all([
      pool.query<{ code: string }>(
        `SELECT UPPER(TRIM(code)) AS code FROM public.disciplines WHERE is_active = true AND code IS NOT NULL AND TRIM(code) != ''`
      ),
      pool.query<{ code: string }>(
        `SELECT UPPER(TRIM(code)) AS code FROM public.discipline_subtypes WHERE is_active = true AND code IS NOT NULL AND TRIM(code) != ''`
      ),
      pool.query<{ module_code: string }>(
        `SELECT module_code FROM public.assessment_modules WHERE module_code IS NOT NULL AND TRIM(module_code) != ''`
      ),
      pool.query<{ id: string; sector_name: string; name: string }>(
        `SELECT id, sector_name, name FROM public.sectors WHERE id IS NOT NULL AND (is_active = true OR is_active IS NULL)`
      ),
      pool.query<{ id: string; name: string; sector_id: string | null }>(
        `SELECT id, name, sector_id FROM public.subsectors WHERE id IS NOT NULL AND is_active = true ORDER BY name`
      ),
    ]);

    (disc.rows || []).forEach((r) => {
      if (r.code && !isNumericTag(r.code)) disciplineCodes.add(r.code);
    });
    (sub.rows || []).forEach((r) => {
      if (r.code && !isNumericTag(r.code)) subtypeCodes.add(r.code);
    });
    (mod.rows || []).forEach((r) => {
      const code = r.module_code?.trim();
      if (code && !isNumericTag(code)) moduleCodes.add(code);
    });
    (sec.rows || []).forEach((r) => {
      const id = r.id?.trim();
      if (id && !isNumericTag(id)) sectorIds.add(id);
      const sn = r.sector_name?.trim();
      if (sn && !isNumericTag(sn)) sectorIds.add(sn);
      const n = r.name?.trim();
      if (n && !isNumericTag(n)) sectorIds.add(n);
      const label = sn || n || id;
      if (label && !isNumericTag(label)) sectorLabels.push(label);
      if (id && !isNumericTag(id) && label) sectorOptions.push({ value: id, label });
    });
    sectorOptions.sort((a, b) => a.label.localeCompare(b.label));
    sectorLabels.sort();
    (subsec.rows || []).forEach((r) => {
      const id = r.id?.trim();
      const sectorId = (r.sector_id != null && r.sector_id !== '') ? String(r.sector_id).trim() : '';
      if (id && !isNumericTag(id)) subsectorIds.add(id);
      const n = r.name?.trim();
      if (n && !isNumericTag(n)) subsectorIds.add(n);
      const label = n || id;
      if (label && !isNumericTag(label)) {
        subsectorLabels.push(label);
        subsectorOptions.push({ value: id, label, sector_id: sectorId });
      }
    });
    subsectorOptions.sort((a, b) => a.label.localeCompare(b.label));
    subsectorLabels.sort();
  } catch (e) {
    console.warn('[scopeTags] getAllowedScopeTagValues failed:', e instanceof Error ? e.message : e);
  }

  return {
    disciplineCodes,
    subtypeCodes,
    moduleCodes,
    sectorIds,
    subsectorIds,
    sectorOptions,
    subsectorOptions,
    sectorLabels,
    subsectorLabels,
  };
}

/**
 * Check if a single tag string is in any allowed set (case-insensitive for codes/ids where applicable).
 * Also allows FALLBACK_TITLE_TAG ("Physical Security") for display/validation.
 */
export function isAllowedScopeTag(tag: string, allowed: ScopeTagAllowedSets): boolean {
  if (!tag || typeof tag !== 'string') return false;
  const t = tag.trim();
  if (!t) return false;
  if (isNumericTag(t)) return false;
  if (ALLOWED_FALLBACK_TAGS.has(t)) return true;
  const upper = t.toUpperCase();
  return (
    allowed.disciplineCodes.has(upper) ||
    allowed.subtypeCodes.has(upper) ||
    allowed.moduleCodes.has(t) ||
    allowed.sectorIds.has(t) ||
    allowed.sectorIds.has(upper) ||
    allowed.subsectorIds.has(t) ||
    allowed.subsectorIds.has(upper)
  );
}

/** True if tag is purely numeric (e.g. "1", "42"). Such tags are filtered out. */
export function isNumericTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  return /^\d+$/.test(tag.trim());
}

export type ScopeTagTier = 'sector' | 'subsector' | 'module';

const TIER_ORDER: ScopeTagTier[] = ['sector', 'subsector', 'module'];

/**
 * Classify a tag into sector, subsector, or module. Returns null if not in any set.
 */
export function classifyTagTier(tag: string, allowed: ScopeTagAllowedSets): ScopeTagTier | null {
  if (!tag || typeof tag !== 'string') return null;
  const t = tag.trim();
  const upper = t.toUpperCase();
  if (allowed.sectorIds.has(t) || allowed.sectorIds.has(upper)) return 'sector';
  if (allowed.subsectorIds.has(t) || allowed.subsectorIds.has(upper)) return 'subsector';
  if (allowed.moduleCodes.has(t)) return 'module';
  return null;
}

const MAX_SCOPE_TAGS_STORED = 2;

/**
 * Normalize scope tags: Sector, Subsector, or Module. Filter out numeric tags.
 * Order: Sector → Subsector → Module, cap at 2. If result is empty and title contains "physical security", return ["Physical Security"].
 */
export function normalizeScopeTagsByPrecedence(
  tags: string[],
  allowed: ScopeTagAllowedSets,
  title?: string | null
): string[] {
  const filtered = (Array.isArray(tags) ? tags : [])
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map((t) => t.trim())
    .filter((t) => !isNumericTag(t));

  const byTier: Record<ScopeTagTier, string[]> = {
    sector: [],
    subsector: [],
    module: [],
  };
  const seen = new Set<string>();
  for (const t of filtered) {
    const tier = classifyTagTier(t, allowed);
    if (tier && !seen.has(t)) {
      seen.add(t);
      byTier[tier].push(t);
    }
  }

  const out: string[] = [];
  for (const tier of TIER_ORDER) {
    for (const t of byTier[tier]) {
      if (out.length >= MAX_SCOPE_TAGS_STORED) break;
      out.push(t);
    }
    if (out.length >= MAX_SCOPE_TAGS_STORED) break;
  }

  if (out.length === 0 && title && /physical\s+security/i.test(title.trim())) {
    return [FALLBACK_TITLE_TAG];
  }
  return out;
}

/**
 * Enforce sector–subsector hierarchy: when we have [sector, subsector], the subsector
 * must belong to that sector (subsector.sector_id === sector). Same logic as Edit form.
 * Used by automatic assignment (rerun-scope-tags) so assigned pairs are consistent.
 */
export function enforceSectorSubsectorConsistency(
  tags: string[],
  allowed: ScopeTagAllowedSets
): string[] {
  if (!Array.isArray(tags) || tags.length < 2) return tags;
  const first = tags[0].trim();
  const second = tags[1].trim();
  const tier1 = classifyTagTier(first, allowed);
  const tier2 = classifyTagTier(second, allowed);
  if (tier1 !== 'sector' || tier2 !== 'subsector') return tags;

  const sectorId =
    allowed.sectorOptions.find((o) => o.value === first || o.label === first)?.value ?? null;
  const subsectorOpt = allowed.subsectorOptions.find(
    (o) => o.value === second || o.label === second
  );
  const subsectorSectorId = subsectorOpt?.sector_id?.trim() ?? '';
  if (!sectorId || !subsectorSectorId) return tags;
  if (sectorId === subsectorSectorId) return tags;
  return [first];
}

/**
 * Validate scope_tags array: every string must be discipline, subtype, module, sector, or subsector.
 * Returns { valid: true } or { valid: false, invalid: string[] }.
 */
export async function validateScopeTags(tags: unknown): Promise<{ valid: true } | { valid: false; invalid: string[] }> {
  if (!Array.isArray(tags)) return { valid: false, invalid: ['scope_tags must be an array'] };
  const strings = tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
  const allowed = await getAllowedScopeTagValues();
  const invalid: string[] = [];
  for (const tag of strings) {
    if (!isAllowedScopeTag(tag, allowed)) invalid.push(tag);
  }
  if (invalid.length) return { valid: false, invalid };
  return { valid: true };
}

/**
 * Filter an array of scope tag display strings to only those that are allowed
 * (discipline, subtype, module, sector, subsector). Preserves citation_label etc.
 * when scope_tags is an object; for display we only show tags that are in allowed sets.
 */
export function filterScopeTagsToAllowed(tags: string[], allowed: ScopeTagAllowedSets): string[] {
  return tags.filter((t) => isAllowedScopeTag(t, allowed));
}

/** Sector/subsector check for top-tier-only display. */
function isSectorOrSubsectorTag(tag: string, allowed: ScopeTagAllowedSets): boolean {
  if (!tag || typeof tag !== 'string') return false;
  const t = tag.trim();
  const upper = t.toUpperCase();
  return (
    allowed.sectorIds.has(t) ||
    allowed.sectorIds.has(upper) ||
    allowed.subsectorIds.has(t) ||
    allowed.subsectorIds.has(upper)
  );
}

const MAX_DISPLAY_SCOPE_TAGS = 2;

/**
 * Resolve scope tag values to display names for the UI. Sector and subsector IDs (including UUIDs)
 * are mapped to their names; discipline, subtype, and module codes are returned as-is.
 */
export function resolveScopeTagsToDisplayNames(tags: string[], allowed: ScopeTagAllowedSets): string[] {
  return tags.map((tag) => {
    const t = tag.trim();
    const sectorOpt = allowed.sectorOptions.find((o) => o.value === t || o.label === t);
    if (sectorOpt) return sectorOpt.label;
    const subsectorOpt = allowed.subsectorOptions.find((o) => o.value === t || o.label === t);
    if (subsectorOpt) return subsectorOpt.label;
    return t;
  });
}

/** Display names that mean "no specific sector/subsector" — treat as missing for inference. */
const GENERIC_SCOPE_DISPLAY_NAMES = new Set(['General', 'General (All Sectors)']);

/**
 * True when the only scope tags are the generic "General" / "General (All Sectors)".
 * Used so we re-infer from title/content instead of keeping useless generic tags —
 * unless the document is basic physical security (then General,General is correct).
 */
export function isGenericSectorSubsectorOnly(tags: string[], allowed: ScopeTagAllowedSets): boolean {
  if (tags.length === 0) return false;
  const displayNames = resolveScopeTagsToDisplayNames(tags, allowed);
  return displayNames.length > 0 && displayNames.every((n) => GENERIC_SCOPE_DISPLAY_NAMES.has(n));
}

/** True when the title suggests a generic/basic physical security document (no sector-specific context). */
export function isBasicPhysicalSecurityTitle(title: string | null | undefined): boolean {
  if (!title || typeof title !== 'string') return false;
  return /physical\s+security/i.test(title.trim());
}

/**
 * Return the two scope tag values to store for "General, General (All Sectors)".
 * Use when a basic physical security document has no more specific sector/subsector.
 * Returns [sectorValue, subsectorValue] or null if General sector/subsector not in allowed sets.
 */
export function getGeneralSectorSubsectorTags(allowed: ScopeTagAllowedSets): string[] | null {
  const sectorOpt = allowed.sectorOptions.find((o) => o.label === 'General');
  const subsectorOpt = allowed.subsectorOptions.find((o) => o.label === 'General (All Sectors)');
  if (!sectorOpt || !subsectorOpt) return null;
  // Subsector must belong to General sector
  if (subsectorOpt.sector_id?.trim() && sectorOpt.value !== subsectorOpt.sector_id.trim()) return null;
  return [sectorOpt.value, subsectorOpt.value];
}

/**
 * For display: if any tag is sector or subsector (top tier), show only sector/subsector
 * and cap at MAX_DISPLAY_SCOPE_TAGS. Otherwise show allowed tags capped at same.
 * "If it tags at top tier, then it is done."
 */
export function preferTopTierForDisplay(tags: string[], allowed: ScopeTagAllowedSets): string[] {
  const filtered = filterScopeTagsToAllowed(tags, allowed);
  const hasTopTier = filtered.some((t) => isSectorOrSubsectorTag(t, allowed));
  const out: string[] = [];
  const add = (t: string) => {
    if (!out.includes(t) && out.length < MAX_DISPLAY_SCOPE_TAGS) out.push(t);
  };
  if (hasTopTier) {
    for (const t of filtered) if (isSectorOrSubsectorTag(t, allowed)) add(t);
  } else {
    for (const t of filtered) add(t);
  }
  return out;
}

const INTERNAL_SCOPE_KEYS = new Set([
  'citation_label', 'collection_key', 'source_type', 'title', 'tier', 'final_url', 'origin_url',
  'content_type', 'retrieved_at', 'authority_class', 'document_role', 'ingestion_stream', 'tags',
]);

/** UUID v4 pattern (hex segments 8-4-4-4-12). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Split malformed scope tag strings like "education_facilities, 15cea357-c472-461f-b103-83d826d2c076"
 * (sector or label concatenated with a UUID) into separate tags so they validate and display correctly.
 */
export function splitMalformedScopeTagString(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  if (!t.includes(', ')) return [t];
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return [t];
  const second = parts[1];
  if (!UUID_REGEX.test(second)) return [t];
  return [parts[0], second];
}

/**
 * Flatten an array of tag strings, splitting any "label, uuid" malformed entries into separate tags.
 */
function flattenAndSplitScopeTagStrings(strings: string[]): string[] {
  const out: string[] = [];
  for (const s of strings) {
    out.push(...splitMalformedScopeTagString(s));
  }
  return out;
}

/**
 * Extract all tag-like strings from raw scope_tags (array or JSONB object).
 * Used when rerunning scope tags to get current values before filtering to allowed only.
 * Splits malformed "sector, uuid" strings into separate tags.
 */
export function extractScopeTagStrings(scopeTags: unknown): string[] {
  if (Array.isArray(scopeTags)) {
    const raw = scopeTags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean);
    return flattenAndSplitScopeTagStrings(raw);
  }
  if (scopeTags && typeof scopeTags === 'object' && !Array.isArray(scopeTags)) {
    const obj = scopeTags as Record<string, unknown>;
    const out: string[] = [];
    // Prefer display array when present (e.g. Technology Library source: { display: [...], tags: { library: 'technology' } })
    if (Array.isArray(obj.display)) {
      obj.display.forEach((t) => {
        if (typeof t === 'string' && t.trim()) out.push(...splitMalformedScopeTagString(t.trim()));
      });
    }
    // Do NOT push citation_label — it is display-only (document title/citation), not a scope tag (sector/subsector).
    if (typeof obj.collection_key === 'string' && obj.collection_key.trim()) out.push(obj.collection_key);
    if (typeof obj.source_type === 'string' && obj.source_type.trim()) out.push(obj.source_type);
    const tags = obj.tags;
    if (Array.isArray(tags)) {
      tags.forEach((t) => {
        if (typeof t === 'string' && t.trim()) out.push(...splitMalformedScopeTagString(t.trim()));
        else if (t && typeof t === 'object' && typeof (t as { name?: string }).name === 'string') out.push((t as { name: string }).name);
      });
    } else if (tags && typeof tags === 'object' && !Array.isArray(tags)) {
      // Skip internal library marker (Technology Library) so it doesn't appear as a scope tag string
      const tagsObj = tags as Record<string, unknown>;
      if (tagsObj.library !== 'technology') {
        Object.values(tags).forEach((v) => {
          if (typeof v === 'string' && v.trim()) out.push(...splitMalformedScopeTagString(v.trim()));
        });
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (INTERNAL_SCOPE_KEYS.has(k)) continue;
      if (typeof v === 'string' && v.trim() && !v.startsWith('http') && !/^\d{4}-\d{2}-\d{2}/.test(v)) {
        out.push(...splitMalformedScopeTagString(v.trim()));
      } else if (typeof v === 'number' || typeof v === 'boolean') out.push(`${k}: ${v}`);
    }
    return out;
  }
  return [];
}
