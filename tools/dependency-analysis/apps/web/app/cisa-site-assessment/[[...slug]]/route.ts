import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Reverse-proxy PSA Rebuild (port 3001, basePath /cisa-site-assessment) through :3000.
 * Implemented as a Route Handler so we avoid Next.js middleware/proxy adapter bugs (Invalid URL on some dev requests).
 */
const UPSTREAM = process.env.PSA_SITE_ASSESSMENT_ORIGIN ?? 'http://127.0.0.1:3001';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function forward(request: NextRequest): Promise<NextResponse> {
  const u = request.nextUrl;
  const pathAndQuery = `${u.pathname}${u.search}`;
  const target = `${UPSTREAM}${pathAndQuery}`;

  const headers = new Headers(request.headers);
  headers.set('host', new URL(UPSTREAM).host);
  headers.set('x-forwarded-host', request.headers.get('host') ?? 'localhost');
  headers.set('x-forwarded-proto', u.protocol.replace(':', '') || 'http');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    Object.assign(init, { duplex: 'half' });
  }

  try {
    const upstream = await fetch(target, init);
    const outHeaders = new Headers(upstream.headers);
    // Next/fetch may transparently decompress the upstream body while preserving
    // the original Content-Encoding header. If we forward that header, browsers
    // will try to decompress plain bytes and raise ERR_CONTENT_DECODING_FAILED.
    outHeaders.delete('content-encoding');
    outHeaders.delete('content-length');

    // Upstream may send Location: http://127.0.0.1:3001/cisa-site-assessment/... — follow on :3000 instead
    // (avoids leaving the unified dev server and prevents slash/host mismatch loops).
    if (upstream.status >= 300 && upstream.status < 400) {
      const loc = outHeaders.get('location');
      if (loc) {
        try {
          const upstreamOrigin = new URL(UPSTREAM).origin;
          const resolved = new URL(loc, `${upstreamOrigin}/`);
          if (resolved.origin === upstreamOrigin) {
            outHeaders.set('location', `${resolved.pathname}${resolved.search}`);
          }
        } catch {
          /* keep original Location */
        }
      }
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    console.error('[cisa-site-assessment proxy]', err);
    return new NextResponse(
      [
        'Modular Site Assessment is not reachable.',
        '',
        'Start: pnpm dev from tools/dependency-analysis (PSA on port 3001).',
        '',
        `Upstream: ${UPSTREAM}`,
      ].join('\n'),
      {
        status: 502,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return forward(request);
}

export async function HEAD(request: NextRequest) {
  return forward(request);
}

export async function POST(request: NextRequest) {
  return forward(request);
}

export async function PUT(request: NextRequest) {
  return forward(request);
}

export async function PATCH(request: NextRequest) {
  return forward(request);
}

export async function DELETE(request: NextRequest) {
  return forward(request);
}

export async function OPTIONS(request: NextRequest) {
  return forward(request);
}
