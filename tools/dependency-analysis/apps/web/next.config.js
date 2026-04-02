const path = require('path');

const toolRoot = path.resolve(__dirname, '../..');
const packagesDir = path.join(toolRoot, 'packages');
/**
 * File tracing root must match how paths are joined to the Git repo root on Vercel.
 * If this is only `toolRoot` (dependency-analysis), traces resolve `apps/web` under the
 * workspace and Vercel incorrectly maps them to `<repo>/apps/web` → missing `next` at runtime
 * (`noop.js`, Cannot find module `next/dist/compiled/next-server/server.runtime.prod.js`).
 * On Vercel, use the PSA Toolbox repo root so traced paths stay under `tools/dependency-analysis/...`.
 */
const repoRoot = path.resolve(__dirname, '../../../..');
const tracingRoot = process.env.VERCEL ? repoRoot : toolRoot;

/** POSIX path relative to tracingRoot (Turbopack expects forward slashes). */
function traceRel(absPath) {
  return path.relative(tracingRoot, absPath).split(path.sep).join('/');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: tracingRoot,
  outputFileTracingExcludes: {
    '/api/export/final': [
      '../../.venv-reporter/**',
      '../../archive/**',
      '../../docs/**',
      '../../audit/**',
      '../../services/reporter-api/**',
      '../../apps/reporter/build/**',
      '../../apps/reporter/tests/**',
      '../../apps/reporter/_test_out/**',
      '../../scripts/tests/**',
      '../../reporter_dead_code.txt',
      '../../reporter_orphans.txt',
      '../../tsconfig.tsbuildinfo',
      '../../**/__tests__/**',
      '../../**/*.test.*',
      '../../**/*.md',
    ],
    '/api/export/draft': [
      '../../.venv-reporter/**',
      '../../archive/**',
      '../../docs/**',
      '../../audit/**',
      '../../services/reporter-api/**',
      '../../apps/reporter/build/**',
      '../../apps/reporter/tests/**',
      '../../apps/reporter/_test_out/**',
      '../../scripts/tests/**',
      '../../reporter_dead_code.txt',
      '../../reporter_orphans.txt',
      '../../tsconfig.tsbuildinfo',
      '../../**/__tests__/**',
      '../../**/*.test.*',
      '../../**/*.md',
    ],
    '/api/template/check': [
      '../../archive/**',
      '../../docs/**',
      '../../audit/**',
      '../../services/reporter-api/**',
      '../../apps/reporter/build/**',
      '../../apps/reporter/tests/**',
      '../../apps/reporter/_test_out/**',
      '../../scripts/tests/**',
      '../../reporter_dead_code.txt',
      '../../reporter_orphans.txt',
      '../../tsconfig.tsbuildinfo',
      '../../**/__tests__/**',
      '../../**/*.test.*',
      '../../**/*.md',
    ],
  },
  async redirects() {
    return [
      // Legacy ADA-prefixed routes should map to current root routes.
      { source: '/ada', destination: '/', permanent: true },
      { source: '/ada/:path*', destination: '/:path*', permanent: true },
      { source: '/host-v3', destination: '/hotel-analysis/', permanent: true },
      { source: '/host-v3/', destination: '/hotel-analysis/', permanent: true },
    ];
  },
  /**
   * Public files live at /hotel-analysis/index.html, but Next does not automatically map /hotel-analysis/ to that file
   * (directory index). Without this, /hotel-analysis/ returns 404 and the HOST tool never loads.
   */
  async rewrites() {
    return [
      { source: '/hotel-analysis', destination: '/hotel-analysis/index.html' },
      { source: '/hotel-analysis/', destination: '/hotel-analysis/index.html' },
      { source: '/safe-3-0', destination: '/safe-3-0/index.html' },
      { source: '/safe-3-0/', destination: '/safe-3-0/index.html' },
      // CISA Site Assessment is proxied by app/cisa-site-assessment/[[...slug]]/route.ts; do not use external rewrites here.
    ];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
  transpilePackages: ['schema', 'engine', 'ui'],
  // Turbopack (Next 16 default) needs explicit root + resolveAlias for workspace packages.
  // Paths are relative to tracingRoot (workspace locally, repo root on Vercel).
  turbopack: {
    root: tracingRoot,
    resolveAlias: (() => {
      const enginePkg = path.join(packagesDir, 'engine');
      return {
        engine: traceRel(enginePkg),
        'engine/client': traceRel(path.join(enginePkg, 'dist', 'client.js')),
        'engine/summary': traceRel(path.join(enginePkg, 'dist', 'summary.js')),
        'engine/export/export_guard': traceRel(path.join(enginePkg, 'dist', 'export', 'export_guard.js')),
        schema: traceRel(path.join(packagesDir, 'schema')),
        security: traceRel(path.join(packagesDir, 'security')),
        ui: traceRel(path.join(packagesDir, 'ui')),
      };
    })(),
  },
  // Resolve workspace packages so client and server bundles can find them (pnpm may not link into apps/web/node_modules)
  webpack: (config) => {
    const enginePkg = path.join(packagesDir, 'engine');
    config.resolve.alias = {
      ...config.resolve.alias,
      // Subpaths must resolve to dist/*.js (package exports); the bare `engine` alias is the package root.
      'engine/client': path.join(enginePkg, 'dist', 'client.js'),
      'engine/summary': path.join(enginePkg, 'dist', 'summary.js'),
      'engine/export/export_guard': path.join(enginePkg, 'dist', 'export', 'export_guard.js'),
      engine: enginePkg,
      schema: path.join(packagesDir, 'schema'),
      security: path.join(packagesDir, 'security'),
      ui: path.join(packagesDir, 'ui'),
    };
    return config;
  },
  trailingSlash: true,
  // Keep security server-only; avoid bundling Node crypto into webpack chunks
  serverExternalPackages: ['security'],
};

module.exports = nextConfig;
