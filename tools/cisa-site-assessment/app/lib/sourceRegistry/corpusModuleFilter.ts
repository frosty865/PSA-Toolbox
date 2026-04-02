/**
 * Canonical rule for Source Registry visibility:
 *
 *   Assessment Corpus = source_registry rows where module_code IS NULL
 *   Module Sources   = source_registry rows where module_code IS NOT NULL
 *
 * source_registry has no top-level module_code column. We derive from:
 * - scope_tags->>'module_code' (set by backfill and Python module ingestion)
 * - source_key prefix 'module:' (backfill) or 'MOD_IN_' (Python ingestion)
 *
 * Use these helpers in any query that lists source_registry so assessment
 * corpus never shows module sources and module lists never show assessment-only rows.
 */

const ALIAS = 'sr';

/**
 * SQL fragment: source_registry rows that are assessment corpus (module_code IS NULL).
 * Use when context = 'assessment' (e.g. Corpus (Assessment Data) tab).
 * Excludes any row with scope indicating Module Upload (module_code, source_key prefix, or source_type MODULE_UPLOAD).
 */
export function assessmentCorpusWhereFragment(alias: string = ALIAS): string {
  const a = alias;
  return `(
    (${a}.scope_tags->>'module_code' IS NULL OR ${a}.scope_tags->>'module_code' = '')
    AND (${a}.scope_tags->>'source_type' IS NULL OR ${a}.scope_tags->>'source_type' <> 'MODULE_UPLOAD')
    AND (${a}.source_key IS NULL OR (${a}.source_key NOT LIKE 'module:%' AND ${a}.source_key NOT LIKE 'MOD_IN_%'))
  )`;
}

/**
 * SQL fragment: source_registry rows that are module sources (module_code IS NOT NULL).
 * Use when context = 'module'.
 */
export function moduleSourcesWhereFragment(alias: string = ALIAS): string {
  const a = alias;
  return `(
    (${a}.scope_tags->>'module_code' IS NOT NULL AND ${a}.scope_tags->>'module_code' <> '')
    OR ${a}.source_key LIKE 'module:%'
    OR ${a}.source_key LIKE 'MOD_IN_%'
  )`;
}

/**
 * Context for shared source list: enforce filters in the helper/API, not in the UI.
 */
export type SourceListContext = 'assessment' | 'module';
