/**
 * Canonical question IDs that require vulnerability mappings.
 * Build fails if any question in this inventory lacks an entry in QUESTION_VULN_MAP.
 * Expand as mappings are added; must stay in sync with QUESTION_VULN_MAP keys.
 */

/** Question IDs that must have at least one VulnTemplate in QUESTION_VULN_MAP. */
export const QUESTION_IDS: readonly string[] = [
  'E-2',
  'E-3',
  'E-3_more_than_one_connection',
  'E-8',
  'E-11',
  'W_Q6',
  'W_Q8',
  'W_Q15_backup_power_pumps',
  'WW_Q6',
  'WW_Q9_backup_power_pumps',
  'comm_restoration_coordination',
  'comm_single_point_voice_failure',
  'COMM-SP3_provider_coordination',
  'COMM-PRA_priority_restoration',
  'IT-1',
  'IT-3',
  'IT-11',
];
