const path = require('path');

const toolRoot = path.resolve(__dirname, '../..');
const packagesDir = path.join(toolRoot, 'packages');
/** Turbopack + file tracing use the tool root; on Vercel only this subtree is deployed (monorepo root would resolve to `/`). */
const tracingRoot = toolRoot;

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
  // Use root-relative paths with forward slashes (Turbopack does not support Windows absolute paths in aliases).
  turbopack: {
    root: tracingRoot,
    resolveAlias: {
      engine: 'packages/engine',
      'engine/client': 'packages/engine/dist/client.js',
      'engine/summary': 'packages/engine/dist/summary.js',
      'engine/export/export_guard': 'packages/engine/dist/export/export_guard.js',
      schema: 'packages/schema',
      security: 'packages/security',
      ui: 'packages/ui',
    },
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
