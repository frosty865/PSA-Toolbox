export function sanitizeLegacySupplyChainFields(obj: Record<string, unknown>): void {
  // Intentionally no-op.
  // Load/import must preserve source data as-is; destructive key stripping creates
  // non-truthful assessment state and breaks round-trip fidelity.
  void obj;
}
