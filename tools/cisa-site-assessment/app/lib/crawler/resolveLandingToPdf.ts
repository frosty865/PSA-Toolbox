/**
 * Resolve HTML landing page to PDF candidate URLs.
 * Fetches HTML with size cap; extracts .pdf links and common download patterns; returns up to 20 canonicalized URLs.
 */

import { canonicalizeUrl } from './urlCanonicalize';

const MAX_CANDIDATES = 20;

export async function resolveLandingToPdf(
  inputUrl: string,
  opts: { htmlTimeoutMs: number; maxBytes: number }
): Promise<string[]> {
  const { htmlTimeoutMs, maxBytes } = opts;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), htmlTimeoutMs);

  let response: Response;
  try {
    response = await fetch(inputUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)' },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
  clearTimeout(timeoutId);

  if (!response.ok) return [];
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('text/html')) return [];

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const n = parseInt(contentLength, 10);
    if (!Number.isNaN(n) && n > maxBytes) return [];
  }

  const reader = response.body?.getReader();
  if (!reader) return [];
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) return [];
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

  const base = new URL(inputUrl);
  const raw = extractPdfCandidates(html, base);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of raw) {
    if (out.length >= MAX_CANDIDATES) break;
    const canon = canonicalizeUrl(u);
    if (!canon.ok) continue;
    if (seen.has(canon.canonicalUrl)) continue;
    seen.add(canon.canonicalUrl);
    out.push(canon.canonicalUrl);
  }
  return out;
}

function extractPdfCandidates(html: string, base: URL): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function add(href: string) {
    const lower = href.toLowerCase();
    if (!lower.includes('.pdf') && !/\/download\/?/.test(lower) && !/\/files\//.test(lower) && !/attachment/i.test(href) && !/export=download/i.test(href)) return;
    try {
      const absolute = new URL(href, base).href;
      if (seen.has(absolute)) return;
      seen.add(absolute);
      if (absolute.toLowerCase().endsWith('.pdf')) {
        out.push(absolute);
        return;
      }
      if (/\/download\/?|download=1|\/files\/|attachment|export=download/i.test(absolute)) {
        out.push(absolute);
      }
    } catch {
      // ignore
    }
  }

  const hrefRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    add(m[1].trim());
  }
  const srcRe = /<[^>]+src\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcRe.exec(html)) !== null) {
    add(m[1].trim());
  }
  return out;
}
