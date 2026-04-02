/**
 * Source Registry Guard Functions
 * 
 * Hard guards to prevent untraceable corpus_documents from being created.
 */

export function assertSourceRegistryId(
  sourceRegistryId: string | null | undefined,
  context: string
): void {
  if (!sourceRegistryId || String(sourceRegistryId).trim().length < 10) {
    throw new Error(
      `Refusing to proceed without source_registry_id (${context}). ` +
      `All corpus_documents must be linked to Source Registry to be traceable.`
    );
  }
}
