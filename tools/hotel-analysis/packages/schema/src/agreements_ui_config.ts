/**
 * Static UI config for SLA/PRA agreements block.
 * Placement: after supply sources, before time_to_impact_hours.
 * Same labels across all non-CP dependency categories.
 * SLA and PRA are separate: SLA = contractual Service Level Agreement; PRA = Federal or SLTT Priority Restoration (not paid/contractual).
 */
export const AGREEMENTS_LABELS = {
  has_sla: 'Service Level Agreement (SLA) in place?',
  sla_hours: 'SLA restoration target (hours)',
  has_pra: 'Priority Restoration Agreement (PRA) — Federal or SLTT in place?',
  pra_category: 'PRA priority category',
  pra_category_other: 'If Other, specify',
} as const;

/** Field order in the Agreements block. */
export const AGREEMENTS_FIELD_ORDER = [
  'has_sla',
  'sla_hours',
  'has_pra',
  'pra_category',
  'pra_category_other',
] as const;

export const PRA_CATEGORY_OPTIONS = [
  { value: 'UNKNOWN', label: 'UNKNOWN' },
  { value: 'TIER_1', label: 'TIER_1' },
  { value: 'TIER_2', label: 'TIER_2' },
  { value: 'TIER_3', label: 'TIER_3' },
  { value: 'OTHER', label: 'OTHER' },
] as const;
