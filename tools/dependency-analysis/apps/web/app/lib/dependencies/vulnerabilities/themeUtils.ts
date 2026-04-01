/**
 * Centralized helpers for theme resolution.
 * Tolerant of answer encodings (boolean vs "Yes"/"No"/"Unknown").
 */

export type NormalizedYesNoUnknown = 'YES' | 'NO' | 'UNKNOWN' | undefined;

/**
 * Normalizes various answer encodings to a canonical form.
 */
export function normalizeYesNoUnknown(value: unknown): NormalizedYesNoUnknown {
  if (value === undefined || value === null) return 'UNKNOWN';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  const s = String(value).toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return 'YES';
  if (s === 'no' || s === 'false' || s === '0') return 'NO';
  if (s === 'unknown') return 'UNKNOWN';
  return 'UNKNOWN';
}

/** Returns true if value is NO or UNKNOWN (worst-case for "no" triggers). */
export function isNoOrUnknown(value: unknown): boolean {
  const n = normalizeYesNoUnknown(value);
  return n === 'NO' || n === 'UNKNOWN';
}

/** Returns true if value is YES. */
export function isYes(value: unknown): boolean {
  return normalizeYesNoUnknown(value) === 'YES';
}
