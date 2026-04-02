/**
 * Cheap "quick text" from PDF URL: first N bytes or first 1–2 pages.
 * Stub: firstPageText empty until tooling supports quick mode.
 */

export async function extractQuickTextFromPdfUrl(
  _finalUrl: string
): Promise<{ title?: string; firstPageText?: string }> {
  return { firstPageText: '' };
}
