#!/usr/bin/env node
/**
 * Find Dead Pages
 * 
 * Finds:
 * 1. Pages documented in SITE_MAP.md that don't exist
 * 2. Pages that exist but aren't linked anywhere
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Pages documented in SITE_MAP.md
const DOCUMENTED_PAGES = [
  { route: '/', file: 'app/page.tsx' },
  { route: '/coverage', file: 'app/coverage/page.tsx' },
  { route: '/coverage/[documentId]', file: 'app/coverage/[documentId]/page.tsx' },
  { route: '/assessment', file: 'app/assessment/page.tsx' },
  { route: '/assessments', file: 'app/assessments/page.tsx' },
  { route: '/assessments/[assessmentId]', file: 'app/assessments/[assessmentId]/page.tsx' },
  { route: '/assessments/[assessmentId]/results', file: 'app/assessments/[assessmentId]/results/page.tsx' },
  { route: '/sectors', file: 'app/sectors/page.tsx' },
  { route: '/disciplines', file: 'app/disciplines/page.tsx' },
  { route: '/reference', file: 'app/reference/page.tsx' }, // DOCUMENTED BUT DOESN'T EXIST
  { route: '/reference/question-focus', file: 'app/reference/question-focus/page.tsx' },
  { route: '/reference/question-focus/[discipline]/[subtype]', file: 'app/reference/question-focus/[discipline]/[subtype]/page.tsx' },
  { route: '/ofcs', file: 'app/ofcs/page.tsx' },
  { route: '/admin', file: 'app/admin/page.tsx' },
];

// All actual page files
function findAllPages(dir = 'app', basePath = '') {
  const pages = [];
  const fullPath = path.join(PROJECT_ROOT, dir);
  
  if (!fs.existsSync(fullPath)) return pages;
  
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  
  entries.forEach(entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'api') {
      findAllPages(entryPath, basePath).forEach(p => pages.push(p));
    } else if (entry.name === 'page.tsx') {
      pages.push(entryPath);
    }
  });
  
  return pages;
}

// Find all links in codebase
function findAllLinks() {
  const links = new Set();
  const files = [];
  
  function searchDir(dir) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullPath)) return;
    
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    entries.forEach(entry => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        searchDir(entryPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
        files.push(entryPath);
      }
    });
  }
  
  searchDir('app');
  searchDir('src');
  
  files.forEach(file => {
    try {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf-8');
      // Find href= and Link href=
      const hrefMatches = content.matchAll(/href=["']([^"']+)["']/g);
      for (const match of hrefMatches) {
        const link = match[1];
        if (link.startsWith('/') && !link.startsWith('//')) {
          links.add(link.split('?')[0].split('#')[0]); // Remove query params and hash
        }
      }
      // Find router.push/replace
      const routerMatches = content.matchAll(/router\.(push|replace)\(["']([^"']+)["']/g);
      for (const match of routerMatches) {
        const link = match[2];
        if (link.startsWith('/') && !link.startsWith('//')) {
          links.add(link.split('?')[0].split('#')[0]);
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  });
  
  return Array.from(links);
}

function fileExists(filePath) {
  return fs.existsSync(path.join(PROJECT_ROOT, filePath));
}

function routeToFile(route) {
  if (route === '/') return 'app/page.tsx';
  if (route.includes('[')) {
    // Dynamic route - check if pattern matches
    const parts = route.split('/').filter(p => p);
    let filePath = 'app';
    parts.forEach(part => {
      if (part.startsWith('[') && part.endsWith(']')) {
        filePath = path.join(filePath, `[${part.slice(1, -1)}]`);
      } else {
        filePath = path.join(filePath, part);
      }
    });
    return path.join(filePath, 'page.tsx').replace(/\\/g, '/');
  }
  const parts = route.split('/').filter(p => p);
  return path.join('app', ...parts, 'page.tsx').replace(/\\/g, '/');
}

console.log('\n=== FINDING DEAD PAGES ===\n');

const allPages = findAllPages();
const allLinks = findAllLinks();

console.log(`Found ${allPages.length} page files`);
console.log(`Found ${allLinks.length} unique links\n`);

// Check documented pages
console.log('=== DOCUMENTED BUT MISSING ===');
const missing = [];
DOCUMENTED_PAGES.forEach(doc => {
  if (!fileExists(doc.file)) {
    missing.push(doc);
    console.log(`❌ ${doc.route} - Documented but file missing: ${doc.file}`);
  }
});

// Check pages that exist but aren't linked
console.log('\n=== EXIST BUT NOT LINKED ===');
const unlinked = [];
allPages.forEach(page => {
  // Convert file path to route
  let route = page.replace('app/', '/').replace('/page.tsx', '');
  if (route === '/page') route = '/';
  
  // Check if it's a dynamic route
  const isDynamic = page.includes('[');
  
  // Check if linked
  const isLinked = allLinks.some(link => {
    if (isDynamic) {
      // For dynamic routes, check if pattern matches
      const routePattern = route.replace(/\[.*?\]/g, '[id]');
      return link.startsWith(routePattern.split('[')[0]);
    }
    return link === route || link.startsWith(route + '/');
  });
  
  // Admin pages are OK (they're in registry)
  const isAdmin = page.startsWith('app/admin/');
  const isAdminRoot = page === 'app/admin/page.tsx';
  const isAdminDomain = /app\/admin\/(doctrine|data|analysis|system|utilities)\/page\.tsx$/.test(page);
  
  if (!isLinked && !isAdmin && !isAdminRoot && !isAdminDomain) {
    unlinked.push({ page, route });
    console.log(`⚠️  ${route} - Exists but not linked: ${page}`);
  }
});

console.log('\n=== SUMMARY ===');
console.log(`❌ Documented but missing: ${missing.length}`);
console.log(`⚠️  Exist but not linked: ${unlinked.length}`);

if (missing.length > 0) {
  console.log('\n❌ REMOVE FROM DOCUMENTATION:');
  missing.forEach(m => {
    console.log(`  - ${m.route} (${m.file})`);
  });
}

if (unlinked.length > 0) {
  console.log('\n⚠️  CONSIDER DELETING (not linked anywhere):');
  unlinked.forEach(u => {
    console.log(`  - ${u.route} (${u.page})`);
  });
}

module.exports = { missing, unlinked };

