/**
 * OFC write guard: only explicit admin/module authoring may create OFCs.
 * Corpus ingestion, mining, parsing, and engine code must never write to ofc_library.
 * Call assertOfcWriteAllowed(context) before any INSERT/UPDATE to public.ofc_library.
 */

export type OfcWriteSource = 'ADMIN_AUTHORING' | 'MODULE_ADMIN';

export interface OfcWriteContext {
  source: OfcWriteSource;
}

const ALLOWED_SOURCES: OfcWriteSource[] = ['ADMIN_AUTHORING', 'MODULE_ADMIN'];

const GUARD_MESSAGE =
  '[GUARD] OFC creation blocked: corpus pipeline is evidence-only. Require context.source = ADMIN_AUTHORING | MODULE_ADMIN.';

/**
 * Throws if context is missing or source is not ADMIN_AUTHORING or MODULE_ADMIN.
 * Call before any write to public.ofc_library.
 */
export function assertOfcWriteAllowed(
  context: OfcWriteContext | undefined | null
): asserts context is OfcWriteContext {
  if (context == null || typeof context !== 'object') {
    throw new Error(GUARD_MESSAGE);
  }
  if (
    !context.source ||
    !ALLOWED_SOURCES.includes(context.source as OfcWriteSource)
  ) {
    throw new Error(GUARD_MESSAGE);
  }
}
