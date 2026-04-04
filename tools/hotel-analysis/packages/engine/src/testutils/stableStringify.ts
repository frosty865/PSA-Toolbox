/**
 * Deterministic JSON stringify: sorted object keys, arrays preserved in order.
 * For snapshot and regression tests that must be stable across OS and time.
 */

/**
 * Recursively sort object keys; preserve array order. Pretty-print with 2-space indent.
 */
export function stableStringify(obj: unknown): string {
  function visit(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) {
      sorted[k] = visit((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  const normalized = visit(obj);
  const out = JSON.stringify(normalized, null, 2);
  return out.endsWith("\n") ? out : out + "\n";
}
