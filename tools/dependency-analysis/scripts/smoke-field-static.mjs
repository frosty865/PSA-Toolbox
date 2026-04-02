/**
 * Serves apps/web/out on localhost and verifies the field bundle responds (HTTP 200 + expected HTML).
 * Uses Node only (no Python) — same toolchain as pnpm/build.
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'apps', 'web', 'out');
const port = Number(process.env.SMOKE_FIELD_PORT ?? '9949');
const basePath = (process.env.FIELD_STATIC_BASE_PATH ?? '').trim().replace(/\/$/, '');

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Map URL path to a file under root (Next static export: trailingSlash routes use .../index.html).
 */
function resolveStaticFile(root, pathname) {
  let p = pathname.replace(/^\/+/, '');
  if (p.endsWith('/')) p = p.slice(0, -1);
  if (!p) {
    const idx = path.join(root, 'index.html');
    return fs.existsSync(idx) ? idx : null;
  }
  const segments = p.split('/').filter(Boolean);
  const direct = path.join(root, ...segments);
  try {
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    const index = path.join(root, ...segments, 'index.html');
    if (fs.existsSync(index)) return index;
  } catch {
    return null;
  }
  return null;
}

function isInsideRoot(root, candidate) {
  const r = path.resolve(root);
  const c = path.resolve(candidate);
  return c === r || c.startsWith(r + path.sep);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
      })
      .on('error', reject);
  });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      // Full path under out/ (e.g. /idt/index.html when FIELD_STATIC_BASE_PATH is set at build time)
      const pathname = decodeURIComponent(url.pathname);
      const filePath = resolveStaticFile(outDir, pathname);
      if (!filePath || !isInsideRoot(outDir, filePath)) {
        res.writeHead(404);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': mimeType(filePath) });
        res.end(data);
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('[smoke-field-static] Missing', path.join(outDir, 'index.html'), '— run pnpm run verify:field-bundle first.');
    process.exit(1);
  }

  const rootHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  if (rootHtml.includes('"/_next/static/chunks/') || rootHtml.includes("'/_next/static/chunks/")) {
    console.error(
      '[smoke-field-static] Root index.html still has absolute /_next/ chunk paths — rewrite-field-static-for-file.mjs must run after field export.'
    );
    process.exit(1);
  }

  const server = await startStaticServer();
  await new Promise((r) => setTimeout(r, 100));

  try {
    const base = `http://127.0.0.1:${port}`;
    const homePath = basePath ? `${basePath}/` : '/';
    const home = await httpGet(`${base}${homePath}`);
    if (home.status !== 200) {
      throw new Error(`GET ${homePath} expected 200, got ${home.status}`);
    }
    if (!home.body.includes('Infrastructure Dependency Tool')) {
      throw new Error('Home HTML missing expected title text');
    }
    const m = home.body.match(/src="((?:[^"]*)\/_next\/static\/chunks\/[^"]+\.js)"/);
    if (!m) {
      throw new Error('Could not find a _next chunk script in index.html');
    }
    const chunkPath = m[1];
    const chunkUrl =
      chunkPath.startsWith('http') ? chunkPath : new URL(chunkPath, `${base}/`).href;
    const chunk = await httpGet(chunkUrl);
    if (chunk.status !== 200) {
      throw new Error(
        `GET ${m[1]} expected 200, got ${chunk.status} (wrong path or missing build — do not open index.html via file://; use HTTPS at site root or a subpath build with FIELD_STATIC_BASE_PATH)`
      );
    }
    console.log('[smoke-field-static] OK — home 200, chunk 200:', m[1]);
  } finally {
    await new Promise((resolve) => server.close(() => resolve(undefined)));
  }
}

main().catch((e) => {
  console.error('[smoke-field-static] FAIL:', e.message);
  process.exit(1);
});
