#!/usr/bin/env node
/**
 * Test All Pages Locally
 * 
 * Checks which pages exist and can be accessed
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');

// All pages that should exist based on navigation
const EXPECTED_PAGES = [
  { route: '/', file: 'app/page.tsx' },
  { route: '/assessments', file: 'app/assessments/page.tsx' },
  { route: '/assessments/[assessmentId]', file: 'app/assessments/[assessmentId]/page.tsx' },
  { route: '/assessments/[assessmentId]/results', file: 'app/assessments/[assessmentId]/results/page.tsx' },
  { route: '/assessment', file: 'app/assessment/page.tsx' },
  { route: '/ofcs', file: 'app/ofcs/page.tsx' },
  { route: '/coverage', file: 'app/coverage/page.tsx' },
  { route: '/coverage/[documentId]', file: 'app/coverage/[documentId]/page.tsx' },
  { route: '/sectors', file: 'app/sectors/page.tsx' },
  { route: '/disciplines', file: 'app/disciplines/page.tsx' },
  { route: '/reference/question-focus', file: 'app/reference/question-focus/page.tsx' },
  { route: '/reference/question-focus/[discipline]/[subtype]', file: 'app/reference/question-focus/[discipline]/[subtype]/page.tsx' },
  { route: '/admin', file: 'app/admin/page.tsx' },
];

function fileExists(filePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, filePath));
}

function checkPageContent(filePath) {
  if (!fileExists(filePath)) return { exists: false, hasContent: false };
  
  const content = fs.readFileSync(path.join(PROJECT_ROOT, filePath), 'utf-8');
  const hasExport = content.includes('export default');
  const hasComponent = content.includes('function') || content.includes('const') || content.includes('return');
  const isEmpty = content.trim().length < 50;
  const hasErrors = content.includes('TODO') || content.includes('FIXME') || content.includes('Not implemented');
  
  return {
    exists: true,
    hasContent: hasExport && hasComponent && !isEmpty,
    hasErrors
  };
}

console.log('\n=== PAGE EXISTENCE CHECK ===\n');

const results = {
  working: [],
  missing: [],
  broken: []
};

EXPECTED_PAGES.forEach(page => {
  const check = checkPageContent(page.file);
  
  if (!check.exists) {
    results.missing.push(page);
    console.log(`❌ ${page.route}: FILE MISSING (${page.file})`);
  } else if (!check.hasContent) {
    results.broken.push({ ...page, reason: 'Empty or invalid' });
    console.log(`⚠️  ${page.route}: EMPTY/INVALID`);
  } else if (check.hasErrors) {
    results.broken.push({ ...page, reason: 'Contains TODOs/errors' });
    console.log(`⚠️  ${page.route}: HAS ERRORS`);
  } else {
    results.working.push(page);
    console.log(`✅ ${page.route}: OK`);
  }
});

console.log('\n=== SUMMARY ===');
console.log(`✅ Working: ${results.working.length}`);
console.log(`❌ Missing: ${results.missing.length}`);
console.log(`⚠️  Broken: ${results.broken.length}`);

if (results.missing.length > 0) {
  console.log('\n❌ MISSING PAGES:');
  results.missing.forEach(page => {
    console.log(`  - ${page.route} (${page.file})`);
  });
}

if (results.broken.length > 0) {
  console.log('\n⚠️  BROKEN PAGES:');
  results.broken.forEach(page => {
    console.log(`  - ${page.route}: ${page.reason}`);
  });
}

// Check for pages that exist but aren't expected
console.log('\n=== UNEXPECTED PAGES ===');
const allPageFiles = [];
function findPages(dir, basePath = '') {
  const fullPath = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullPath)) return;
  
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  entries.forEach(entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findPages(entryPath, basePath);
    } else if (entry.name === 'page.tsx') {
      allPageFiles.push(entryPath);
      const expected = EXPECTED_PAGES.find(p => p.file === entryPath);
      if (!expected && !entryPath.includes('admin/')) {
        console.log(`  ⚠️  ${entryPath}: Not in expected list`);
      }
    }
  });
}

findPages('app');

module.exports = { results };

