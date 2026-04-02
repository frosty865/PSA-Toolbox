/**
 * URL canonicalization for crawler screening.
 * Allow http/https only; strip fragment and tracking params; normalize host; remove default ports.
 */

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'fbclid', 'mc_cid', 'mc_eid', 'ref', 'source', '_ga', '_gl', 'msclkid',
]);

function stripTrackingParams(searchParams: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, value] of searchParams) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower)) continue;
    if (lower.startsWith('utm_')) continue;
    out.append(key, value);
  }
  return out;
}

/**
 * Canonicalize a URL for screening and caching.
 * Returns { ok: true, canonicalUrl } or { ok: false, reason }.
 * Rules: http/https only; strip fragment; strip tracking params; lowercase host; remove default ports; do not rewrite paths.
 */
export function canonicalizeUrl(input: string):
  | { ok: true; canonicalUrl: string; reason?: never }
  | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: 'Invalid URL format' };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed' };
  }

  const host = url.hostname.toLowerCase();
  const port = url.port || '';
  const defaultPort = protocol === 'https:' ? '443' : '80';
  const portSuffix = port && port !== defaultPort ? `:${port}` : '';
  const pathname = url.pathname || '/';
  const searchParams = stripTrackingParams(url.searchParams);
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const canonicalUrl = `${protocol}//${host}${portSuffix}${pathname}${search}`;
  return { ok: true, canonicalUrl };
}

/**
 * Return whether the URL uses http or https.
 */
export function isHttpOrHttps(url: string): boolean {
  try {
    const p = new URL(url).protocol.toLowerCase();
    return p === 'http:' || p === 'https:';
  } catch {
    return false;
  }
}
