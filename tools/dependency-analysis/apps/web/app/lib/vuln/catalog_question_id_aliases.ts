/**
 * Canonical question ID aliases for vulnerability catalog validation.
 * Maps legacy/alternate question IDs to canonical IDs used in assessment schema.
 * When validating triggers, resolve: canonical = QUESTION_ID_ALIASES[id] ?? id
 * Then validate canonical against QUESTION_IDS_BY_INFRA.
 */
export const QUESTION_ID_ALIASES: Record<string, string> = {
  // Communications: legacy keys produced by normalize_conditions or derived from PACE
  'CO-1_provider_identified': 'curve_primary_provider',
  'CO-3_multiple_pathways': 'comms_alternate_providers_or_paths',
  // IT: catalog triggers use short form; schema uses suffixed keys
  'IT-8': 'IT-8_backup_available',
  'IT-9': 'IT-11_restoration_coordination',
};
