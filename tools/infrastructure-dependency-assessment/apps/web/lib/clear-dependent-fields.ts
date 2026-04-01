/**
 * Clear dependent fields when a parent gate becomes false.
 * Prevents phantom data from hidden conditional questions.
 */

export type ClearSpec = { key: string; clearAs: 'null' | 'emptyArray' };

/**
 * Returns a new object with dependent keys set to null or empty array.
 * Does not mutate currentValue.
 */
export function clearDependentFields(
  currentValue: Record<string, unknown>,
  dependentKeysOrPaths: (string | ClearSpec)[]
): Record<string, unknown> {
  const next = { ...currentValue };
  for (const item of dependentKeysOrPaths) {
    if (typeof item === 'string') {
      next[item] = null;
    } else {
      next[item.key] = item.clearAs === 'emptyArray' ? [] : null;
    }
  }
  return next;
}

/** Keys to clear when requires_service becomes false. */
export const DEPENDENTS_WHEN_REQUIRES_SERVICE_FALSE = [
  'curve_primary_provider',
  'time_to_impact_hours',
  'loss_fraction_no_backup',
  'has_backup_any',
  'has_backup',
  'has_backup_generator',
  'backup_duration_hours',
  'loss_fraction_with_backup',
  'recovery_time_hours',
] as const;

/** Keys to clear when has_backup_any (or has_backup) becomes false. */
export const DEPENDENTS_WHEN_HAS_BACKUP_FALSE = [
  'has_backup_generator',
  'backup_duration_hours',
  'loss_fraction_with_backup',
  'redundancy_activation',
] as const;
