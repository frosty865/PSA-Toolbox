#!/usr/bin/env node
/**
 * Writes host-report-env.js so static HOST V3 sets window.HOST_REPORT_SERVICE_URL (Railway /render base, no local Python).
 *
 * Vercel: the toolbox already uses REPORT_SERVICE_URL for server-side API routes — we read the same at *build time*
 * so the static HOST bundle gets the URL. Optional duplicate: NEXT_PUBLIC_HOST_REPORT_SERVICE_URL.
 *
 * Resolution order: NEXT_PUBLIC_HOST_REPORT_SERVICE_URL → REPORT_SERVICE_URL → apps/web/.env.local (either key).
 */
const fs = require('fs');
const path = require('path');

const webRoot = path.join(__dirname, '..');
const publicHostDir = path.join(webRoot, 'public', 'hotel-analysis');
/** tools/hotel-analysis (sibling of tools/dependency-analysis) */
const hotelAnalysisRoot = path.join(webRoot, '..', '..', '..', 'hotel-analysis');
const outPublic = path.join(publicHostDir, 'host-report-env.js');
const outHotelAnalysis = path.join(hotelAnalysisRoot, 'host-report-env.js');

/** @param {string} raw @param {string} key */
function parseEnvLine(raw, key) {
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(.+)$`, 'm');
  const m = raw.match(re);
  if (!m) return '';
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

function readEnvLocal() {
  const p = path.join(webRoot, '.env.local');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return (
      parseEnvLine(raw, 'NEXT_PUBLIC_HOST_REPORT_SERVICE_URL') ||
      parseEnvLine(raw, 'REPORT_SERVICE_URL') ||
      ''
    );
  } catch {
    return '';
  }
}

function resolveUrl() {
  const a = String(process.env.NEXT_PUBLIC_HOST_REPORT_SERVICE_URL || '').trim();
  if (a) return a;
  const b = String(process.env.REPORT_SERVICE_URL || '').trim();
  if (b) return b;
  return readEnvLocal();
}

const url = resolveUrl();
const body = url
  ? `(function(){var u=${JSON.stringify(url)};if(typeof window!=="undefined"){window.HOST_REPORT_SERVICE_URL=window.HOST_REPORT_SERVICE_URL||u;}})();`
  : `(function(){/* DOCX: set REPORT_SERVICE_URL or NEXT_PUBLIC_HOST_REPORT_SERVICE_URL in Vercel (Railway base URL), then rebuild. Or meta host-report-service-url / localStorage HOST_REPORT_SERVICE_URL. */})();`;

fs.mkdirSync(publicHostDir, { recursive: true });
fs.writeFileSync(outPublic, body, 'utf8');
try {
  fs.mkdirSync(hotelAnalysisRoot, { recursive: true });
  fs.writeFileSync(outHotelAnalysis, body, 'utf8');
} catch (e) {
  console.warn('inject-host-report-env: could not write tools/hotel-analysis/host-report-env.js', e.message);
}
