import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Reverse-proxy Modular Site Assessment (PSA, basePath /cisa-site-assessment) through this app.
 * Implemented as a Route Handler so we avoid Next.js middleware/proxy adapter bugs (Invalid URL on some dev requests).
 *
 * - **Local dev:** default upstream `http://127.0.0.1:3001` (run `pnpm dev` from tools/dependency-analysis so PSA starts; it uses `--hostname 127.0.0.1`).
 * - **Vercel:** set `PSA_SITE_ASSESSMENT_ORIGIN` to your deployed PSA origin (e.g. `https://<psa>.vercel.app`) — there is no localhost on the platform.
 */
function resolveUpstream(): { origin: string } | { response: NextResponse } {
  const raw = process.env.PSA_SITE_ASSESSMENT_ORIGIN?.trim();
  if (raw) {
    try {
      const u = new URL(raw);
      return { origin: `${u.protocol}//${u.host}` };
    } catch {
      return {
        response: new NextResponse('PSA_SITE_ASSESSMENT_ORIGIN is not a valid absolute URL (include https://).', {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
      };
    }
  }
  if (process.env.VERCEL === '1') {
    return {
      response: new NextResponse(
        [
          'Modular Site Assessment is not configured for this deployment.',
          '',
          'Deploy tools/cisa-site-assessment as its own Vercel project (or another HTTPS host),',
          'then add environment variable PSA_SITE_ASSESSMENT_ORIGIN on this project to that origin, e.g.',
          '  https://your-psa-project.vercel.app',
          '(no trailing slash; paths like /cisa-site-assessment/... are forwarded automatically).',
          '',
          'Local dev does not need this: run pnpm dev from tools/dependency-analysis so PSA listens on :3001.',
        ].join('\n'),
        {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        },
      ),
    };
  }
  return { origin: 'http://127.0.0.1:3001' };
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function forward(request: NextRequest): Promise<NextResponse> {
  const resolved = resolveUpstream();
  if ('response' in resolved) {
    return resolved.response;
  }
  const UPSTREAM = resolved.origin;

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
    const isVercel = process.env.VERCEL === '1';
    return new NextResponse(
      [
        'Modular Site Assessment is not reachable.',
        '',
        isVercel
          ? 'Check PSA_SITE_ASSESSMENT_ORIGIN points to a running HTTPS deployment and that project is up.'
          : [
              'Start the unified dev servers from tools/dependency-analysis:',
              '  pnpm dev',
              '(not only pnpm --filter web dev — that skips PSA on :3001.)',
              'Ensure tools/cisa-site-assessment has node_modules: pnpm install there once.',
            ].join('\n'),
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
