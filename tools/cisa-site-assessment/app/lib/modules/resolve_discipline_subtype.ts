/**
 * Resolve discipline_code + discipline_subtype_hint to discipline_id and discipline_subtype_id.
 * Exact name match > fuzzy match > fallback to discipline only (subtype null) with warning.
 * Used by 2-pass module generation when mapping PASS A output to export shape.
 */

import { getRuntimePool } from '@/app/lib/db/runtime_client';
import { guardModuleQuery } from '@/app/lib/modules/table_access_guards';

export type ResolveSubtypeResult = {
  discipline_id: string;
  discipline_subtype_id: string | null;
  /** Set when subtype was resolved by fuzzy match or fallback. */
  warning?: string;
};

/** Normalize for comparison: lowercase, collapse spaces, strip. */
function normalize(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Simple fuzzy: hint contained in name/code or name/code contained in hint. */
function fuzzyMatch(hint: string, name: string, code: string): boolean {
  const h = normalize(hint);
  const n = normalize(name);
  const c = normalize(code || '');
  if (!h) return false;
  return !!(n.includes(h) || c.includes(h) || h.includes(n) || (c ? h.includes(c) : false));
}

/**
 * Resolve discipline_code (e.g. PER, FAC, EAP) and discipline_subtype_hint (free text) to
 * discipline_id and discipline_subtype_id. Hard fail only if discipline_code is invalid or missing.
 */
export async function resolveDisciplineSubtypeId(
  discipline_code: string,
  discipline_subtype_hint: string
): Promise<ResolveSubtypeResult> {
  const runtimePool = getRuntimePool();
  const code = (discipline_code || '').trim().toUpperCase();
  const hint = (discipline_subtype_hint || '').trim();

  const discQuery = `SELECT id FROM public.disciplines WHERE is_active = true AND UPPER(TRIM(code)) = $1`;
  guardModuleQuery(discQuery, 'resolveDisciplineSubtypeId: disciplines');
  const discRows = await runtimePool.query<{ id: string }>(discQuery, [code]);
  if (!discRows.rows.length) {
    throw new Error(`Invalid or unknown discipline_code: ${discipline_code}`);
  }
  const discipline_id = discRows.rows[0].id;

  const subQuery = `SELECT id, name, code FROM public.discipline_subtypes WHERE discipline_id = $1 AND is_active = true ORDER BY name`;
  guardModuleQuery(subQuery, 'resolveDisciplineSubtypeId: discipline_subtypes');
  const subRows = await runtimePool.query<{ id: string; name: string | null; code: string | null }>(subQuery, [discipline_id]);
  const subtypes = subRows.rows;
  const firstSubtypeId = subtypes[0]?.id ?? null;

  if (!hint) {
    return {
      discipline_id,
      discipline_subtype_id: firstSubtypeId,
      warning: firstSubtypeId ? 'No subtype hint; using first subtype for discipline' : 'No subtype hint and no subtypes for discipline',
    };
  }

  const hintNorm = normalize(hint);
  let exact: { id: string } | null = null;
  let fuzzy: { id: string } | null = null;

  for (const row of subtypes) {
    const name = (row.name || '').trim();
    const subCode = (row.code || '').trim();
    if (normalize(name) === hintNorm || (subCode && normalize(subCode) === hintNorm)) {
      exact = { id: row.id };
      break;
    }
    if (fuzzyMatch(hint, name, subCode)) {
      fuzzy = fuzzy || { id: row.id };
    }
  }

  if (exact) {
    return { discipline_id, discipline_subtype_id: exact.id };
  }
  if (fuzzy) {
    return {
      discipline_id,
      discipline_subtype_id: fuzzy.id,
      warning: `Subtype resolved by fuzzy match for hint: ${discipline_subtype_hint}`,
    };
  }
  if (!firstSubtypeId) {
    throw new Error(
      `No discipline_subtype found for discipline_code=${discipline_code} (hint: "${discipline_subtype_hint}"). Add subtypes for this discipline in RUNTIME.`
    );
  }
  return {
    discipline_id,
    discipline_subtype_id: firstSubtypeId,
    warning: `No exact or fuzzy subtype match for "${discipline_subtype_hint}"; using first subtype for discipline`,
  };
}
