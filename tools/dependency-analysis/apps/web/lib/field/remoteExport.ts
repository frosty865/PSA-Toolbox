/**
 * Optional hybrid: browser UI POSTs final export to a trusted hosted DOCX reporter.
 * Baked at build time via NEXT_PUBLIC_REPORT_SERVICE_URL, NEXT_PUBLIC_HOST_REPORT_SERVICE_URL,
 * or legacy NEXT_PUBLIC_FIELD_EXPORT_BASE_URL.
 */
export function getBrowserReportServiceBaseUrl(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_REPORT_SERVICE_URL?.trim() ??
    process.env.NEXT_PUBLIC_HOST_REPORT_SERVICE_URL?.trim() ??
    process.env.NEXT_PUBLIC_FIELD_EXPORT_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : undefined;
}

export function getFieldExportBaseUrl(): string | undefined {
  return getBrowserReportServiceBaseUrl();
}

export function isFieldRemoteDocxEnabled(): boolean {
  return getBrowserReportServiceBaseUrl() !== undefined;
}
