#!/usr/bin/env node
/**
 * Guardrail: when output is "export", fail if app/api contains route handlers
 * that are incompatible with static export (e.g. force-dynamic).
 *
 * Specifically: /api/vofc/generate must not exist (it used force-dynamic).
 * Other routes may use force-static; we only block the known-incompatible one.
 */
const path = require('path');
const fs = require('fs');

const webDir = path.resolve(__dirname, '..');
const nextConfigPath = path.join(webDir, 'next.config.js');
const apiDir = path.join(webDir, 'app', 'api');

function hasOutputExport() {
  if (!fs.existsSync(nextConfigPath)) return false;
  const content = fs.readFileSync(nextConfigPath, 'utf8');
  // Match output: 'export' or output: "export" or process.env.VERCEL ? undefined : 'export'
  if (content.includes("output: 'export'") || content.includes('output: "export"')) return true;
  if (content.includes("output: process.env.VERCEL ? undefined : 'export'")) return true;
  if (content.includes('output: process.env.VERCEL ? undefined : "export"')) return true;
  return false;
}

function vofcGenerateRouteExists() {
  const routePath = path.join(apiDir, 'vofc', 'generate', 'route.ts');
  const routePathJs = path.join(apiDir, 'vofc', 'generate', 'route.js');
  return fs.existsSync(routePath) || fs.existsSync(routePathJs);
}

function main() {
  if (!hasOutputExport()) {
    return 0;
  }
  if (vofcGenerateRouteExists()) {
    console.error(
      '[verify_no_app_api_in_export] ERROR: output is "export" but app/api/vofc/generate exists.',
      'Route handlers with force-dynamic cannot be used with static export.',
      'Remove this route or use client-side VOFC generation (app/lib/vofc/client_generate.ts).'
    );
    process.exit(1);
  }
  return 0;
}

main();
