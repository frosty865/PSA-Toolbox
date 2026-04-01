/**
 * Format hour count for display: "1 hour" vs "N hours".
 */
export function formatHours(n: number): string {
  return n === 1 ? '1 hour' : `${n} hours`;
}
