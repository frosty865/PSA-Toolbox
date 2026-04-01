/**
 * Shared options for the backup clarification questions (Q-BACKUP-CAPACITY, Q-BACKUP-METHOD).
 * Used by Energy, Communications, IT, Water, Wastewater dependency UIs and report narrative.
 */
export const BACKUP_PRIMARY_METHOD_OPTIONS = [
  { value: 'Generator', label: 'Generator' },
  { value: 'UPS / Battery', label: 'UPS / Battery' },
  { value: 'Alternate service provider', label: 'Alternate service provider' },
  { value: 'Stored supply', label: 'Stored supply' },
  { value: 'Manual workaround', label: 'Manual workaround' },
  { value: 'Other', label: 'Other' },
  { value: 'Unknown', label: 'Unknown' },
] as const;

export type BackupPrimaryMethodValue = (typeof BACKUP_PRIMARY_METHOD_OPTIONS)[number]['value'];
