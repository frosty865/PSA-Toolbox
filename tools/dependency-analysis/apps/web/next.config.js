const path = require('path');

const repoRoot = path.resolve(__dirname, '../../../..');
const toolRoot = path.resolve(__dirname, '../..');
const packagesDir = path.join(toolRoot, 'packages');
const toolRootFromRepo = 'tools/dependency-analysis';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: repoRoot,
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
    root: repoRoot,
    resolveAlias: {
      engine: `${toolRootFromRepo}/packages/engine`,
      'engine/client': `${toolRootFromRepo}/packages/engine/dist/client.js`,
      schema: `${toolRootFromRepo}/packages/schema`,
      security: `${toolRootFromRepo}/packages/security`,
      ui: `${toolRootFromRepo}/packages/ui`,
    },
  },
  // Resolve workspace packages so client and server bundles can find them (pnpm may not link into apps/web/node_modules)
  webpack: (config) => {
    const enginePkg = path.join(packagesDir, 'engine');
    config.resolve.alias = {
      ...config.resolve.alias,
      // Subpath first so 'engine/client' matches before 'engine'
      'engine/client': path.join(enginePkg, 'dist', 'client.js'),
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
