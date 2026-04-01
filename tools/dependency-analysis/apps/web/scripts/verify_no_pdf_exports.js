#!/usr/bin/env node
/**
 * Regression guard: fail if PDF export mode creeps back.
 * Exports are DOCX + JSON only.
 */
const fs = require('fs');
const path = require('path');

const webRoot = path.resolve(__dirname, '..');
const errors = [];

function checkFile(filePath, pattern, message) {
  const abs = path.join(webRoot, filePath);
  if (!fs.existsSync(abs)) return;
  const content = fs.readFileSync(abs, 'utf8');
  if (pattern.test(content)) {
    errors.push(`${filePath}: ${message}`);
  }
}

// Export menu items or routes with "pdf"
checkFile(
  'components/ReviewExportSection.tsx',
  /\bPDF\b/i,
  'ReviewExportSection must not contain "PDF"'
);

// app/api/export/* paths with pdf
const exportDir = path.join(webRoot, 'app', 'api', 'export');
if (fs.existsSync(exportDir)) {
  const entries = fs.readdirSync(exportDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && /pdf/i.test(e.name)) {
      errors.push(`app/api/export/${e.name}: PDF export route must not exist`);
    }
  }
}

if (errors.length > 0) {
  console.error('verify_no_pdf_exports.js failed:');
  errors.forEach((e) => console.error('  -', e));
  process.exit(1);
}
