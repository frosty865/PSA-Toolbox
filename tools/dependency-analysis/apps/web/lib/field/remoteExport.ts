/**
 * Optional hybrid: static field UI POSTs final export to a trusted hosted Next stack (DOCX).
 * Baked at build time via NEXT_PUBLIC_FIELD_EXPORT_BASE_URL.
 */
export function getFieldExportBaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_FIELD_EXPORT_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : undefined;
}

export function isFieldRemoteDocxEnabled(): boolean {
  return getFieldExportBaseUrl() !== undefined;
}
