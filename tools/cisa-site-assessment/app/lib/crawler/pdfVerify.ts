/**
 * Verify that a URL points to a usable PDF.
 * HEAD then Range bytes=0-1023; enforce 50KB–150MB; reject text/html; handle 429/503.
 */

export const MIN_PDF_BYTES = 50 * 1024;
export const MAX_PDF_BYTES = 150 * 1024 * 1024;
const PDF_SIGNATURE = '%PDF-';

export type PdfVerifyResult =
  | {
      ok: true;
      finalUrl: string;
      contentType: string;
      contentLength: number;
      redirects: number;
    }
  | {
      ok: false;
      rejectCode:
        | 'NOT_HTTP'
        | 'REDIRECT_LOOP'
        | 'NOT_PDF'
        | 'HTML_MASQUERADE'
        | 'TOO_SMALL'
        | 'TOO_LARGE'
        | 'TIMEOUT'
        | 'RATE_LIMITED'
        | 'VERIFY_FAILED';
      reason: string;
      finalUrl?: string;
      redirects?: number;
    };

function parseContentLength(value: string | null): number | null {
  if (value == null) return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function isPdfContentType(ct: string, url: string): boolean {
  const lower = ct.toLowerCase().split(';')[0].trim();
  if (lower === 'application/pdf') return true;
  if (lower === 'application/octet-stream' && url.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

function isHtmlContentType(ct: string): boolean {
  const lower = ct.toLowerCase().split(';')[0].trim();
  return lower === 'text/html';
}

export async function verifyPdfUrl(
  inputUrl: string,
  opts?: {
    maxRedirects?: number;
    headTimeoutMs?: number;
    rangeTimeoutMs?: number;
    minBytes?: number;
    maxBytes?: number;
  }
): Promise<PdfVerifyResult> {
  const maxRedirects = opts?.maxRedirects ?? 5;
  const headTimeoutMs = opts?.headTimeoutMs ?? 12_000;
  const rangeTimeoutMs = opts?.rangeTimeoutMs ?? 12_000;
  const minBytes = opts?.minBytes ?? MIN_PDF_BYTES;
  const maxBytes = opts?.maxBytes ?? MAX_PDF_BYTES;

  let currentUrl = inputUrl;
  let redirects = 0;

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; PSA-Tool/1.0; +https://psa-tool.com)' };

  while (redirects <= maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), headTimeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('abort') || msg.includes('timeout')) {
        return { ok: false, rejectCode: 'TIMEOUT', reason: 'Request timeout', redirects };
      }
      return { ok: false, rejectCode: 'VERIFY_FAILED', reason: msg, redirects };
    }
    clearTimeout(timeoutId);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location && redirects < maxRedirects) {
        currentUrl = new URL(location, currentUrl).href;
        redirects++;
        continue;
      }
      return { ok: false, rejectCode: 'REDIRECT_LOOP', reason: 'Too many redirects', redirects };
    }

    if (response.status === 429 || response.status === 503) {
      const retryAfter = response.headers.get('retry-after');
      const reason = retryAfter ? `Rate limited; Retry-After: ${retryAfter}` : 'Rate limited';
      return {
        ok: false,
        rejectCode: 'RATE_LIMITED',
        reason,
        finalUrl: currentUrl,
        redirects,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        rejectCode: 'VERIFY_FAILED',
        reason: `${response.status} ${response.statusText}`,
        finalUrl: currentUrl,
        redirects,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (isHtmlContentType(contentType)) {
      return {
        ok: false,
        rejectCode: 'HTML_MASQUERADE',
        reason: 'Content-Type is text/html',
        finalUrl: currentUrl,
        redirects,
      };
    }

    const contentLength = parseContentLength(response.headers.get('content-length'));
    if (contentLength != null) {
      if (contentLength < minBytes) {
        return {
          ok: false,
          rejectCode: 'TOO_SMALL',
          reason: `Content-Length ${contentLength} below ${minBytes}`,
          finalUrl: currentUrl,
          redirects,
        };
      }
      if (contentLength > maxBytes) {
        return {
          ok: false,
          rejectCode: 'TOO_LARGE',
          reason: `Content-Length ${contentLength} above ${maxBytes}`,
          finalUrl: currentUrl,
          redirects,
        };
      }
    }

    if (!isPdfContentType(contentType, currentUrl)) {
      return {
        ok: false,
        rejectCode: 'NOT_PDF',
        reason: `Content-Type ${contentType} not application/pdf`,
        finalUrl: currentUrl,
        redirects,
      };
    }

    const acceptRanges = response.headers.get('accept-ranges');

    let rangeResponse: Response;
    const rangeController = new AbortController();
    const rangeTimeoutId = setTimeout(() => rangeController.abort(), rangeTimeoutMs);
    try {
      rangeResponse = await fetch(currentUrl, {
        method: 'GET',
        headers: { ...headers, 'Range': 'bytes=0-1023' },
        redirect: 'follow',
        signal: rangeController.signal,
      });
    } catch (e) {
      clearTimeout(rangeTimeoutId);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('abort') || msg.includes('timeout')) {
        return { ok: false, rejectCode: 'TIMEOUT', reason: 'Range request timeout', redirects };
      }
      return { ok: false, rejectCode: 'VERIFY_FAILED', reason: msg, redirects };
    }
    clearTimeout(rangeTimeoutId);

    const body = await rangeResponse.text();
    if (!body.startsWith(PDF_SIGNATURE)) {
      return {
        ok: false,
        rejectCode: 'VERIFY_FAILED',
        reason: 'First bytes do not start with %PDF-',
        finalUrl: currentUrl,
        redirects,
      };
    }

    if (contentLength == null && !acceptRanges && rangeResponse.status !== 206) {
      return {
        ok: false,
        rejectCode: 'VERIFY_FAILED',
        reason: 'Content-Length missing and range support not confirmed',
        finalUrl: currentUrl,
        redirects,
      };
    }

    return {
      ok: true,
      finalUrl: currentUrl,
      contentType,
      contentLength: contentLength ?? 0,
      redirects,
    };
  }

  return { ok: false, rejectCode: 'REDIRECT_LOOP', reason: 'Too many redirects', redirects };
}

export function verifyPdfBuffer(buffer: Buffer | Uint8Array): boolean {
  if (buffer.length < 5) return false;
  const sig = buffer.slice(0, 5).toString('ascii');
  return sig === PDF_SIGNATURE;
}
