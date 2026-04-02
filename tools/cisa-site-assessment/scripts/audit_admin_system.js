#!/usr/bin/env node
/**
 * Admin System Audit Script
 * 
 * Tests all admin pages and APIs to identify:
 * - What works
 * - What's broken
 * - What needs to be deleted
 * 
 * Usage: node scripts/audit_admin_system.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Admin pages from registry
const REGISTRY_TOOLS = [
  { id: "doctrine-validation", route: "/admin/doctrine/validation", file: "app/admin/doctrine/validation/page.tsx" },
  { id: "doctrine-freeze", route: "/admin/doctrine/freeze", file: "app/admin/doctrine/freeze/page.tsx" },
  { id: "coverage-analysis", route: "/admin/data/coverage", file: "app/admin/data/coverage/page.tsx" },
  { id: "coverage-dashboard", route: "/admin/data/coverage-dashboard", file: "app/admin/data/coverage-dashboard/page.tsx" },
  { id: "gap-analysis", route: "/admin/data/gap-analysis", file: "app/admin/data/gap-analysis/page.tsx" },
  { id: "canonical-content", route: "/admin/data/canonical-content", file: "app/admin/data/canonical-content/page.tsx" },
  { id: "candidate-packages", route: "/admin/data/candidates", file: "app/admin/data/candidates/page.tsx" },
  { id: "library-ingestion-status", route: "/admin/data/library-ingestion", file: "app/admin/data/library-ingestion/page.tsx" },
  { id: "assessment-status", route: "/admin/analysis/assessments", file: "app/admin/analysis/assessments/page.tsx" },
  { id: "review-statements", route: "/admin/review-statements", file: "app/admin/review-statements/page.tsx" },
  { id: "gap-detection", route: "/admin/analysis/gap-detection", file: "app/admin/analysis/gap-detection/page.tsx" }
];

// All admin pages found
const ALL_ADMIN_PAGES = [
  "app/admin/page.tsx",
  "app/admin/doctrine/page.tsx",
  "app/admin/doctrine/validation/page.tsx",
  "app/admin/doctrine/freeze/page.tsx",
  "app/admin/data/page.tsx",
  "app/admin/data/coverage/page.tsx",
  "app/admin/data/coverage-dashboard/page.tsx",
  "app/admin/data/gap-analysis/page.tsx",
  "app/admin/data/canonical-content/page.tsx",
  "app/admin/data/candidates/page.tsx",
  "app/admin/data/library-ingestion/page.tsx",
  "app/admin/analysis/page.tsx",
  "app/admin/analysis/assessments/page.tsx",
  "app/admin/analysis/gap-detection/page.tsx",
  "app/admin/review-statements/page.tsx",
  "app/admin/system/page.tsx",
  "app/admin/utilities/page.tsx",
  "app/admin/coverage/page.tsx",
  "app/admin/ofcs/[ofc_code]/evidence/page.tsx"
];

// Admin API routes
const ADMIN_APIS = [
  { route: "/api/admin/validate/baseline", file: "app/api/admin/validate/baseline/route.ts" },
  { route: "/api/admin/validate/baseline-freeze", file: "app/api/admin/validate/baseline-freeze/route.ts" },
  { route: "/api/admin/validate/compound-clauses", file: "app/api/admin/validate/compound-clauses/route.ts" },
  { route: "/api/admin/validate/forbidden-terms", file: "app/api/admin/validate/forbidden-terms/route.ts" },
  { route: "/api/admin/validate/ofc-mirrors", file: "app/api/admin/validate/ofc-mirrors/route.ts" },
  { route: "/api/admin/assessments/status", file: "app/api/admin/assessments/status/route.ts" },
  { route: "/api/admin/coverage", file: "app/api/admin/coverage/route.ts" },
  { route: "/api/admin/coverage/sector-subsector", file: "app/api/admin/coverage/sector-subsector/route.ts" },
  { route: "/api/admin/analytics/coverage-dashboard", file: "app/api/admin/analytics/coverage-dashboard/route.ts" },
  { route: "/api/admin/analytics/gap-analysis", file: "app/api/admin/analytics/gap-analysis/route.ts" },
  { route: "/api/admin/analytics/gap-reports", file: "app/api/admin/analytics/gap-reports/route.ts" },
  { route: "/api/admin/analytics/gap-candidates", file: "app/api/admin/analytics/gap-candidates/route.ts" },
  { route: "/api/admin/analytics/canonical-content", file: "app/api/admin/analytics/canonical-content/route.ts" },
  { route: "/api/admin/candidates", file: "app/api/admin/candidates/route.ts" },
  { route: "/api/admin/candidates/[discipline]/[subtype]", file: "app/api/admin/candidates/[discipline]/[subtype]/route.ts" },
  { route: "/api/admin/library-ingestion-status", file: "app/api/admin/library-ingestion-status/route.ts" },
  { route: "/api/admin/ofc-evidence", file: "app/api/admin/ofc-evidence/route.ts" },
  { route: "/api/admin/taxonomy/disciplines", file: "app/api/admin/taxonomy/disciplines/route.ts" },
  { route: "/api/admin/taxonomy/subtypes", file: "app/api/admin/taxonomy/subtypes/route.ts" }
];

function fileExists(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  return fs.existsSync(fullPath);
}

function readFile(filePath) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function checkPageHasContent(pagePath) {
  const content = readFile(pagePath);
  if (!content) return false;
  
  // Check if it's a real page (not just a placeholder)
  const hasExport = content.includes('export default') || content.includes('export default function');
  const hasComponent = content.includes('function') || content.includes('const') || content.includes('return');
  const isEmpty = content.trim().length < 100;
  
  return hasExport && hasComponent && !isEmpty;
}

function checkAPIImplementsMethod(apiPath, method = 'GET') {
  const content = readFile(apiPath);
  if (!content) return false;
  
  // Check if it exports the method
  const hasExport = content.includes(`export async function ${method}`) || 
                    content.includes(`export function ${method}`) ||
                    (method === 'GET' && content.includes('export async function GET'));
  
  return hasExport;
}

function checkPageUsesAdminLayout(pagePath) {
  const content = readFile(pagePath);
  if (!content) return false;
  
  return content.includes('AdminLayout') || content.includes('adminLayout');
}

function checkPageHasErrors(pagePath) {
  const content = readFile(pagePath);
  if (!content) return false;
  
  // Check for common error patterns
  const hasError = content.includes('TODO') || 
                   content.includes('FIXME') ||
                   content.includes('Not implemented') ||
                   content.includes('placeholder') ||
                   content.includes('coming soon');
  
  return hasError;
}

function auditPages() {
  console.log('\n=== ADMIN PAGES AUDIT ===\n');
  
  const results = {
    inRegistry: [],
    notInRegistry: [],
    missing: [],
    broken: [],
    working: []
  };
  
  // Check registry tools
  console.log('Checking Registry Tools:');
  REGISTRY_TOOLS.forEach(tool => {
    const exists = fileExists(tool.file);
    const hasContent = exists ? checkPageHasContent(tool.file) : false;
    const hasErrors = exists ? checkPageHasErrors(tool.file) : false;
    const usesLayout = exists ? checkPageUsesAdminLayout(tool.file) : false;
    
    if (!exists) {
      results.missing.push(tool);
      console.log(`  ❌ ${tool.id}: FILE MISSING`);
    } else if (!hasContent) {
      results.broken.push({ ...tool, reason: 'Empty or placeholder' });
      console.log(`  ⚠️  ${tool.id}: EMPTY/PLACEHOLDER`);
    } else if (hasErrors) {
      results.broken.push({ ...tool, reason: 'Contains TODO/FIXME/Not implemented' });
      console.log(`  ⚠️  ${tool.id}: HAS ERRORS/TODOS`);
    } else if (!usesLayout) {
      results.broken.push({ ...tool, reason: 'Does not use AdminLayout' });
      console.log(`  ⚠️  ${tool.id}: NO ADMIN LAYOUT`);
    } else {
      results.working.push(tool);
      results.inRegistry.push(tool);
      console.log(`  ✅ ${tool.id}: OK`);
    }
  });
  
  // Check all admin pages
  console.log('\nChecking All Admin Pages:');
  ALL_ADMIN_PAGES.forEach(pagePath => {
    const exists = fileExists(pagePath);
    if (!exists) {
      console.log(`  ❌ ${pagePath}: MISSING`);
      return;
    }
    
    const inRegistry = REGISTRY_TOOLS.some(tool => tool.file === pagePath);
    if (!inRegistry && pagePath !== 'app/admin/page.tsx' && 
        !pagePath.includes('/page.tsx') || pagePath.includes('doctrine/page.tsx') ||
        pagePath.includes('data/page.tsx') || pagePath.includes('analysis/page.tsx') ||
        pagePath.includes('system/page.tsx') || pagePath.includes('utilities/page.tsx')) {
      // Domain landing pages are OK
      if (pagePath.match(/\/(doctrine|data|analysis|system|utilities)\/page\.tsx$/)) {
        console.log(`  ℹ️  ${pagePath}: Domain landing (OK)`);
      } else {
        results.notInRegistry.push(pagePath);
        console.log(`  ⚠️  ${pagePath}: NOT IN REGISTRY`);
      }
    }
  });
  
  return results;
}

function auditAPIs() {
  console.log('\n=== ADMIN APIs AUDIT ===\n');
  
  const results = {
    working: [],
    broken: [],
    missing: []
  };
  
  ADMIN_APIS.forEach(api => {
    const exists = fileExists(api.file);
    if (!exists) {
      results.missing.push(api);
      console.log(`  ❌ ${api.route}: FILE MISSING`);
      return;
    }
    
    const hasGET = checkAPIImplementsMethod(api.file, 'GET');
    const hasPOST = checkAPIImplementsMethod(api.file, 'POST');
    const hasMethod = hasGET || hasPOST;
    
    if (!hasMethod) {
      results.broken.push({ ...api, reason: 'No GET or POST export' });
      console.log(`  ⚠️  ${api.route}: NO METHOD EXPORT`);
    } else {
      results.working.push(api);
      console.log(`  ✅ ${api.route}: OK`);
    }
  });
  
  return results;
}

function generateReport(pageResults, apiResults) {
  console.log('\n=== AUDIT REPORT ===\n');
  
  console.log('PAGES:');
  console.log(`  ✅ Working: ${pageResults.working.length}`);
  console.log(`  ❌ Broken: ${pageResults.broken.length}`);
  console.log(`  ⚠️  Missing: ${pageResults.missing.length}`);
  console.log(`  ⚠️  Not in Registry: ${pageResults.notInRegistry.length}`);
  
  console.log('\nAPIs:');
  console.log(`  ✅ Working: ${apiResults.working.length}`);
  console.log(`  ❌ Broken: ${apiResults.broken.length}`);
  console.log(`  ⚠️  Missing: ${apiResults.missing.length}`);
  
  if (pageResults.broken.length > 0) {
    console.log('\n⚠️  BROKEN PAGES:');
    pageResults.broken.forEach(page => {
      console.log(`  - ${page.id || page}: ${page.reason || 'Unknown issue'}`);
    });
  }
  
  if (pageResults.notInRegistry.length > 0) {
    console.log('\n⚠️  PAGES NOT IN REGISTRY:');
    pageResults.notInRegistry.forEach(page => {
      console.log(`  - ${page}`);
    });
  }
  
  if (apiResults.broken.length > 0) {
    console.log('\n⚠️  BROKEN APIs:');
    apiResults.broken.forEach(api => {
      console.log(`  - ${api.route}: ${api.reason}`);
    });
  }
  
  if (apiResults.missing.length > 0) {
    console.log('\n⚠️  MISSING APIs:');
    apiResults.missing.forEach(api => {
      console.log(`  - ${api.route}`);
    });
  }
}

// Run audit
const pageResults = auditPages();
const apiResults = auditAPIs();
generateReport(pageResults, apiResults);

// Export results for further processing
module.exports = { pageResults, apiResults };

