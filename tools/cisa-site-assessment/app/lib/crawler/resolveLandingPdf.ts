/**
 * Resolve an HTML landing page URL to a direct PDF link.
 * Fetches up to 2MB, extracts hrefs that point to PDFs, returns first absolute PDF URL.
 */

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const DEFAULT_HTML_MS = 15_000;

export async function resolveLandingToPdfUrl(
  landingUrl: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_HTML_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = opts.signal;
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      controller.abort();
    });
  }

  let response: Response;
  try {
    response = await fetch(landingUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)' },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
  clearTimeout(timeoutId);

  if (!response.ok) return null;
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('text/html')) return null;

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const n = parseInt(contentLength, 10);
    if (!Number.isNaN(n) && n > MAX_HTML_BYTES) return null;
  }

  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_HTML_BYTES) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const merged =
    chunks.length === 1
      ? chunks[0]
      : (() => {
          const u8 = new Uint8Array(total);
          let offset = 0;
          for (const c of chunks) {
            u8.set(c, offset);
            offset += c.length;
          }
          return u8;
        })();
  const html = decoder.decode(merged);

  const base = new URL(landingUrl);
  const pdfUrls = extractPdfLinks(html, base);
  return pdfUrls[0] ?? null;
}

function extractPdfLinks(html: string, base: URL): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const hrefRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href.toLowerCase().endsWith('.pdf')) continue;
    try {
      const absolute = new URL(href, base).href;
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      out.push(absolute);
    } catch {
      // ignore invalid URL
    }
  }
  return out;
}
