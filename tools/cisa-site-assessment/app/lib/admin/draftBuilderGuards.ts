/**
 * Guards for the Automated Module Draft Builder.
 * DO NOT write to: module_ofcs, ofc_candidate_queue, ofc_library*.
 * Documents are evidence only; OFCs remain authored and explicit.
 */

export const FORBIDDEN_TABLES_IN_DRAFT_PATH = [
  'module_ofcs',
  'ofc_candidate_queue',
  'ofc_library',
] as const;

/**
 * Throws if the SQL string touches any forbidden table.
 * Call before executing any write in the draft create or publish code path.
 */
export function guardDraftSql(sql: string): void {
  const lower = sql.toLowerCase();
  if (lower.includes('module_ofcs') || lower.includes('ofc_candidate_queue') || lower.includes('ofc_library')) {
    throw new Error('Draft builder must not write to module_ofcs, ofc_candidate_queue, or ofc_library*. Documents are evidence only; OFCs remain authored.');
  }
}
