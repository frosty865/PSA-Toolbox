/**
 * Helpers for percent display: user sees 0–100, system stores 0–1.
 * Used only for fields with displayAs === 'percent' (e.g. loss_fraction_*).
 */

/** Convert stored fraction (0–1) to display value (0–100). Empty stored → ''. */
export function storedToDisplayPercent(stored: number | null | undefined): number | '' {
  if (stored == null) return '';
  return stored * 100;
}

/** Convert display value (0–100) to stored fraction (0–1). Empty input → null. */
export function displayToStoredPercent(display: string): number | null {
  const trimmed = display.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num / 100 : null;
}
