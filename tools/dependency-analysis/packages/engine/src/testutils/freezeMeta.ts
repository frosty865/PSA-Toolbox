/**
 * Freeze collection metadata for deterministic snapshots.
 * Sets generated_at_iso and tool_version to fixed values; does not mutate input.
 */

/**
 * Deep-clone collection and set generated_at_iso = "2000-01-01T00:00:00Z", tool_version = "TEST".
 */
export function freezeCollectionMeta<
  T extends { generated_at_iso: string; tool_version: string }
>(collection: T): T {
  const cloned = JSON.parse(JSON.stringify(collection)) as T;
  cloned.generated_at_iso = "2000-01-01T00:00:00Z";
  cloned.tool_version = "TEST";
  return cloned;
}
